import {
  ALL_STORE_NAMES,
  BROWSER_DATABASE_NAME,
  BROWSER_DATABASE_VERSION,
  STORE_NAMES,
} from "./constants.js";

export function indexedDbFor(indexedDB) {
  if (indexedDB !== undefined) return indexedDB;
  return typeof globalThis !== "undefined" ? globalThis.indexedDB : null;
}

export function ensureRecordStores(database) {
  if (!database.objectStoreNames.contains(STORE_NAMES.workspaceMeta)) {
    database.createObjectStore(STORE_NAMES.workspaceMeta, { keyPath: "workspaceId" });
  }
  if (!database.objectStoreNames.contains(STORE_NAMES.objects)) {
    database.createObjectStore(STORE_NAMES.objects, { keyPath: ["workspaceId", "objectId"] });
  }
  if (!database.objectStoreNames.contains(STORE_NAMES.cells)) {
    database.createObjectStore(STORE_NAMES.cells, { keyPath: ["workspaceId", "objectId", "cellId"] });
  }
  if (!database.objectStoreNames.contains(STORE_NAMES.assets)) {
    database.createObjectStore(STORE_NAMES.assets, { keyPath: ["workspaceId", "assetId"] });
  }
  if (!database.objectStoreNames.contains(STORE_NAMES.themes)) {
    database.createObjectStore(STORE_NAMES.themes, { keyPath: ["workspaceId", "themeId"] });
  }
}

export function openRecordDatabase({
  indexedDB,
  databaseName = BROWSER_DATABASE_NAME,
  version = BROWSER_DATABASE_VERSION,
  onUpgrade,
} = {}) {
  const factory = indexedDbFor(indexedDB);
  if (!factory) return Promise.reject(new Error("IndexedDB is unavailable."));
  return new Promise((resolve, reject) => {
    const request = factory.open(databaseName, version);
    request.onupgradeneeded = (event) => {
      ensureRecordStores(request.result);
      onUpgrade?.(request.result, event);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Unable to open the browser database."));
    request.onblocked = () => reject(new Error("The browser database is blocked by another tab."));
  });
}

export function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
  });
}

export function transactionResult(transaction, result) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted."));
  });
}

export function runRecordTransaction(database, mode, executor, storeNames = ALL_STORE_NAMES) {
  const transaction = database.transaction(storeNames, mode);
  const completed = transactionResult(transaction);
  let result;
  try {
    result = executor(transaction);
  } catch (error) {
    try { transaction.abort(); } catch { /* the transaction may already be closed */ }
    return Promise.reject(error);
  }
  return completed.then(() => result);
}

export async function readAllRecords(database, storeName) {
  const transaction = database.transaction([storeName], "readonly");
  const completed = transactionResult(transaction);
  const request = transaction.objectStore(storeName).getAll();
  const records = await requestResult(request);
  await completed;
  return records || [];
}

export async function readRecord(database, storeName, key) {
  const transaction = database.transaction([storeName], "readonly");
  const completed = transactionResult(transaction);
  const request = transaction.objectStore(storeName).get(key);
  const result = await requestResult(request);
  await completed;
  return result || null;
}
