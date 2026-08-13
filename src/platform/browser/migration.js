import { migratePortableWorkspace } from "../../compat/migrations.js";
import { clonePortableValue } from "../../compat/schema.js";
import {
  LEGACY_CACHE_KEY,
  LEGACY_DATABASE_NAME,
  LEGACY_STORE_NAME,
  LEGACY_WORKSPACE_KEY,
} from "./constants.js";
import { blobBytes, toNativeBlob } from "./assets.js";

export class BrowserStorageMigrationError extends Error {
  constructor(message, { phase = "read", cause } = {}) {
    super(message, { cause });
    this.name = "BrowserStorageMigrationError";
    this.phase = phase;
    this.cause = cause;
  }
}

function readLegacyLocalStorage(storage, key) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    throw new BrowserStorageMigrationError("The legacy local cache could not be decoded.", {
      phase: "read",
      cause: error,
    });
  }
}

function databaseExists(indexedDB, databaseName) {
  if (typeof indexedDB?.databases !== "function") return Promise.resolve(true);
  return indexedDB.databases().then((databases) => databases.some((entry) => entry.name === databaseName));
}

export async function readLegacyIndexedDb({
  indexedDB,
  databaseName = LEGACY_DATABASE_NAME,
  storeName = LEGACY_STORE_NAME,
  workspaceKey = LEGACY_WORKSPACE_KEY,
} = {}) {
  if (!indexedDB) return null;
  if (!(await databaseExists(indexedDB, databaseName))) return null;
  return new Promise((resolve, reject) => {
    let missingStore = false;
    const request = indexedDB.open(databaseName);
    request.onupgradeneeded = () => {
      missingStore = true;
    };
    request.onsuccess = () => {
      const database = request.result;
      if (missingStore || !database.objectStoreNames.contains(storeName)) {
        database.close();
        resolve(null);
        return;
      }
      try {
        const transaction = database.transaction([storeName], "readonly");
        const read = transaction.objectStore(storeName).get(workspaceKey);
        read.onsuccess = () => {
          const result = read.result || null;
          database.close();
          resolve(result);
        };
        read.onerror = () => {
          const error = read.error || new Error("Unable to read the legacy workspace.");
          database.close();
          reject(error);
        };
      } catch (error) {
        database.close();
        reject(error);
      }
    };
    request.onerror = () => reject(request.error || new Error("Unable to open the legacy workspace database."));
  });
}

export async function readLegacyWorkspace({
  indexedDB,
  localStorage,
  databaseName = LEGACY_DATABASE_NAME,
  storeName = LEGACY_STORE_NAME,
  workspaceKey = LEGACY_WORKSPACE_KEY,
  cacheKey = LEGACY_CACHE_KEY,
} = {}) {
  let legacyIndexedDb = null;
  try {
    legacyIndexedDb = await readLegacyIndexedDb({ indexedDB, databaseName, storeName, workspaceKey });
  } catch {
    // A malformed or blocked legacy database must not prevent a valid cache
    // copy from being considered, and neither source is ever removed here.
  }
  if (legacyIndexedDb) return { workspace: legacyIndexedDb, source: "indexeddb" };
  const legacyCache = readLegacyLocalStorage(localStorage, cacheKey);
  return legacyCache ? { workspace: legacyCache, source: "localstorage" } : null;
}

export function normalizeLegacyWorkspace(workspace) {
  try {
    return migratePortableWorkspace(clonePortableValue(workspace));
  } catch (error) {
    throw new BrowserStorageMigrationError("The legacy workspace is not compatible with the current model.", {
      phase: "read",
      cause: error,
    });
  }
}

function withoutBinary(value) {
  if (!value || typeof value !== "object") return value;
  const { blob: _blob, data: _data, dataUrl: _dataUrl, bytes: _bytes, ...metadata } = value;
  return metadata;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function comparableWorkspace(workspace) {
  const objects = Object.fromEntries(Object.keys(workspace.objects || {}).sort().map((id) => {
    const object = workspace.objects[id] || {};
    const { cells: _cells, ...record } = object;
    const cells = Object.fromEntries(Object.keys(object.cells || {}).sort().map((cellId) => [cellId, object.cells[cellId]]));
    return [id, { record, cells }];
  }));
  return stableValue({
    ...workspace,
    objects,
    assets: Object.fromEntries(Object.keys(workspace.assets || {}).sort().map((id) => [id, withoutBinary(workspace.assets[id])])),
    themes: Object.fromEntries(Object.keys(workspace.themes || {}).sort().map((id) => [id, workspace.themes[id]])),
  });
}

async function verifyAssetBytes(expected, actual, readAssetBlob) {
  const expectedBlob = toNativeBlob(expected?.blob || expected?.data || expected?.dataUrl, expected?.mime);
  if (!expectedBlob) return true;
  if (!readAssetBlob) return false;
  const actualBlob = await readAssetBlob(String(expected.id));
  if (!actualBlob) return false;
  const [expectedBytes, actualBytes] = await Promise.all([blobBytes(expectedBlob), blobBytes(actualBlob)]);
  if (expectedBytes.length !== actualBytes.length) return false;
  return expectedBytes.every((value, index) => value === actualBytes[index]);
}

export async function verifyMigratedWorkspace(expected, actual, { readAssetBlob } = {}) {
  if (JSON.stringify(comparableWorkspace(expected)) !== JSON.stringify(comparableWorkspace(actual))) return false;
  for (const asset of Object.values(expected.assets || {})) {
    if (!(await verifyAssetBytes(asset, actual.assets?.[asset.id], readAssetBlob))) return false;
  }
  return true;
}

export async function migrateLegacyWorkspace({
  adapter,
  legacyWorkspace,
  indexedDB,
  localStorage,
  legacyOptions,
} = {}) {
  if (!adapter) throw new BrowserStorageMigrationError("A browser persistence adapter is required.", { phase: "copy" });
  const source = legacyWorkspace
    ? { workspace: legacyWorkspace, source: "provided" }
    : await readLegacyWorkspace({ indexedDB, localStorage, ...legacyOptions });
  if (!source) return null;

  const normalized = normalizeLegacyWorkspace(source.workspace);
  const revision = `migration-${Date.now().toString(36)}`;
  try {
    await adapter.writeSnapshot(normalized, { revision, activate: false });
  } catch (error) {
    throw new BrowserStorageMigrationError("Legacy workspace copy failed; the legacy data was retained.", {
      phase: "copy",
      cause: error,
    });
  }

  let verified;
  try {
    const copied = await adapter.readSnapshot(normalized.id);
    verified = copied && await verifyMigratedWorkspace(normalized, copied, {
      readAssetBlob: (assetId) => adapter.readAssetBlob(assetId, normalized.id),
    });
  } catch (error) {
    throw new BrowserStorageMigrationError("Legacy workspace verification failed; the legacy data was retained.", {
      phase: "verify",
      cause: error,
    });
  }
  if (!verified) {
    throw new BrowserStorageMigrationError("Legacy workspace verification did not match; the legacy data was retained.", {
      phase: "verify",
    });
  }

  try {
    await adapter.activateWorkspace(normalized.id, revision);
  } catch (error) {
    throw new BrowserStorageMigrationError("Legacy workspace switch failed; the legacy data was retained.", {
      phase: "switch",
      cause: error,
    });
  }

  return {
    workspace: normalized,
    revision,
    source: source.source,
    legacyRetained: true,
  };
}
