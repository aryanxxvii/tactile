import assert from "node:assert/strict";
import test from "node:test";

import { createBlankWorkspace, createCellRecord } from "../../../src/model.js";
import {
  BrowserPersistenceAdapter,
  AssetUrlRegistry,
  LEGACY_STORE_NAME,
  LEGACY_WORKSPACE_KEY,
  STORE_NAMES,
} from "../../../src/platform/browser/index.js";

class MemoryRequest {
  constructor(transaction = null) {
    this.transaction = transaction;
    this.result = undefined;
    this.error = null;
    this.onsuccess = null;
    this.onerror = null;
  }

  succeed(result) {
    this.result = result;
    this.onsuccess?.({ target: this });
  }

  fail(error) {
    this.error = error;
    this.onerror?.({ target: this });
  }
}

function keyFor(key) {
  return JSON.stringify(key);
}

function keyFromPath(record, keyPath) {
  return Array.isArray(keyPath) ? keyPath.map((part) => record[part]) : record[keyPath];
}

class MemoryTransaction {
  constructor(database, names, mode) {
    this.database = database;
    this.names = names;
    this.mode = mode;
    this.pending = 0;
    this.aborted = false;
    this.completed = false;
    this.oncomplete = null;
    this.onerror = null;
    this.onabort = null;
  }

  enqueue(work) {
    this.pending += 1;
    const request = new MemoryRequest(this);
    queueMicrotask(() => {
      if (this.aborted) return;
      try {
        const result = work();
        request.succeed(result);
        this.pending -= 1;
        this.completeIfIdle();
      } catch (error) {
        request.fail(error);
        this.pending -= 1;
        this.abort(error);
      }
    });
    return request;
  }

  completeIfIdle() {
    if (this.pending !== 0 || this.completed || this.aborted) return;
    queueMicrotask(() => {
      if (this.pending !== 0 || this.completed || this.aborted) return;
      this.completed = true;
      this.oncomplete?.({ target: this });
    });
  }

  abort(error = new Error("Transaction aborted.")) {
    if (this.aborted || this.completed) return;
    this.aborted = true;
    this.error = error;
    this.onerror?.({ target: this });
    this.onabort?.({ target: this });
  }

  objectStore(name) {
    return this.database.objectStore(name, this);
  }
}

class MemoryObjectStore {
  constructor(name, keyPath, database) {
    this.name = name;
    this.keyPath = keyPath;
    this.database = database;
    this.records = new Map();
  }

  request(work) {
    if (!this.transaction) throw new Error("A transaction is required.");
    return this.transaction.enqueue(work);
  }

  put(value, key) {
    const resolvedKey = key === undefined ? keyFromPath(value, this.keyPath) : key;
    return this.request(() => {
      this.records.set(keyFor(resolvedKey), structuredClone(value));
      return resolvedKey;
    });
  }

  get(key) {
    return this.request(() => {
      const value = this.records.get(keyFor(key));
      return value === undefined ? undefined : structuredClone(value);
    });
  }

  getAll() {
    return this.request(() => [...this.records.values()].map((value) => structuredClone(value)));
  }

  delete(key) {
    return this.request(() => this.records.delete(keyFor(key)));
  }
}

class MemoryDatabase {
  constructor(name) {
    this.name = name;
    this.stores = new Map();
    this.objectStoreNames = { contains: (storeName) => this.stores.has(storeName) };
  }

  createObjectStore(name, options = {}) {
    const store = new MemoryObjectStore(name, options.keyPath, this);
    this.stores.set(name, store);
    return store;
  }

  objectStore(name, transaction) {
    const store = this.stores.get(name);
    if (!store) throw new Error(`Missing store ${name}`);
    return new TransactionObjectStore(store, transaction);
  }

  transaction(names, mode) {
    return new MemoryTransaction(this, names, mode);
  }

  close() {}
}

class TransactionObjectStore {
  constructor(store, transaction) {
    this.store = store;
    this.transaction = transaction;
  }

  put(value, key) {
    return this.transaction.enqueue(() => {
      const resolvedKey = key === undefined ? keyFromPath(value, this.store.keyPath) : key;
      this.store.records.set(keyFor(resolvedKey), structuredClone(value));
      return resolvedKey;
    });
  }

  get(key) {
    return this.transaction.enqueue(() => {
      const value = this.store.records.get(keyFor(key));
      return value === undefined ? undefined : structuredClone(value);
    });
  }

  getAll() {
    return this.transaction.enqueue(() => [...this.store.records.values()].map((value) => structuredClone(value)));
  }

  delete(key) {
    return this.transaction.enqueue(() => this.store.records.delete(keyFor(key)));
  }
}

class MemoryIndexedDB {
  constructor() {
    this.databasesByName = new Map();
  }

  databases() {
    return Promise.resolve([...this.databasesByName.keys()].map((name) => ({ name })));
  }

  open(name, version) {
    const request = new MemoryRequest();
    queueMicrotask(() => {
      let database = this.databasesByName.get(name);
      const needsUpgrade = !database || version !== undefined;
      if (!database) {
        database = new MemoryDatabase(name);
        this.databasesByName.set(name, database);
      }
      request.result = database;
      if (needsUpgrade) request.onupgradeneeded?.({ target: request, oldVersion: 0, newVersion: version || 1 });
      request.onsuccess?.({ target: request });
    });
    return request;
  }

  seed(name, storeName, key, value) {
    const database = this.databasesByName.get(name) || new MemoryDatabase(name);
    this.databasesByName.set(name, database);
    const store = database.stores.get(storeName) || database.createObjectStore(storeName);
    store.records.set(keyFor(key), structuredClone(value));
  }

  get(name, storeName, key) {
    const database = this.databasesByName.get(name);
    const store = database?.stores.get(storeName);
    return store?.records.get(keyFor(key));
  }
}

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}

function transaction(revision, operations, dirtyRecords = []) {
  return {
    revision,
    dirtyRecords,
    forwardPatch: {
      id: `patch-${revision}`,
      baseRevision: "r0",
      targetRevision: revision,
      operations,
    },
  };
}

test("record commits persist cells without rewriting unrelated asset blobs", async () => {
  const indexedDB = new MemoryIndexedDB();
  const localStorage = new MemoryStorage();
  const workspace = createBlankWorkspace({ id: "workspace-c02" });
  const adapter = new BrowserPersistenceAdapter({
    indexedDB,
    localStorage,
    databaseName: "c02-records",
    autoMigrate: false,
  });

  await adapter.writeSnapshot(workspace, { revision: "r0", activate: true });
  await adapter.writeAsset({ record: { id: "asset-1", mime: "image/png" }, data: new Uint8Array([1, 2, 3]) });
  const database = await adapter.databaseHandle();
  const assetStore = database.stores.get(STORE_NAMES.assets);
  const writesBeforeCellEdit = assetStore.records.size;
  const cell = createCellRecord(0, 0, { value: "latest" });

  await adapter.commit({
    revision: "r1",
    transaction: transaction(
      "r1",
      [
        {
          kind: "replace-cell",
          objectId: "home",
          cellId: cell.id,
          before: null,
          after: cell,
        },
      ],
      [{ recordType: "cell", recordId: cell.id }],
    ),
  });

  assert.equal(assetStore.records.size, writesBeforeCellEdit);
  await adapter.close();

  const reloaded = new BrowserPersistenceAdapter({
    indexedDB,
    localStorage,
    databaseName: "c02-records",
    autoMigrate: false,
  });
  const snapshot = await reloaded.open({ workspaceId: workspace.id });
  assert.equal(snapshot.objects.home.cells[cell.id].value, "latest");
  assert.deepEqual([...(await reloaded.readAsset({ assetId: "asset-1" }).then((result) => result.data))], [1, 2, 3]);
});

test("snapshot replacement writes after cleanup and preserves omitted asset bytes", async () => {
  const indexedDB = new MemoryIndexedDB();
  const localStorage = new MemoryStorage();
  const workspace = createBlankWorkspace({ id: "workspace-snapshot-replace" });
  const oldCell = createCellRecord(0, 0, { value: "old" });
  const newCell = createCellRecord(1, 0, { value: "new" });
  workspace.objects.home.cells[oldCell.id] = oldCell;
  workspace.assets = {
    "asset-1": { id: "asset-1", mime: "image/png", size: 3 },
  };
  const adapter = new BrowserPersistenceAdapter({
    indexedDB,
    localStorage,
    databaseName: "c02-snapshot-replace",
    autoMigrate: false,
  });

  await adapter.writeSnapshot(workspace, { revision: "r0", activate: true });
  await adapter.writeAsset({ record: workspace.assets["asset-1"], data: new Uint8Array([7, 8, 9]) });

  const replacement = {
    ...workspace,
    objects: {
      ...workspace.objects,
      home: {
        ...workspace.objects.home,
        cells: { [newCell.id]: newCell },
      },
    },
  };
  await adapter.writeSnapshot(replacement, { revision: "r1", activate: true });

  const snapshot = await adapter.readSnapshot(workspace.id);
  assert.equal(snapshot.objects.home.cells[oldCell.id], undefined);
  assert.equal(snapshot.objects.home.cells[newCell.id].value, "new");
  assert.deepEqual([...(await adapter.readAsset({ assetId: "asset-1" }).then((result) => result.data))], [7, 8, 9]);
});

test("asset URLs are reference-counted and revoked after the final release", () => {
  const created = [];
  const revoked = [];
  const registry = new AssetUrlRegistry({
    createObjectURL: (blob) => {
      const url = `blob:c02-${created.length}`;
      created.push({ url, blob });
      return url;
    },
    revokeObjectURL: (url) => revoked.push(url),
  });
  const blob = new Blob([new Uint8Array([4])], { type: "image/png" });

  const first = registry.acquire("asset-1", blob);
  const second = registry.acquire("asset-1", blob);
  assert.equal(first.url, second.url);
  assert.equal(created.length, 1);
  assert.equal(first.release(), true);
  assert.deepEqual(revoked, []);
  assert.equal(second.release(), true);
  assert.deepEqual(revoked, [first.url]);
});

test("browser persistence exposes session metadata and asset handles for native-compatible previews", async () => {
  const indexedDB = new MemoryIndexedDB();
  const localStorage = new MemoryStorage();
  const revoked = [];
  const workspace = createBlankWorkspace({ id: "workspace-browser-handle" });
  const adapter = new BrowserPersistenceAdapter({
    indexedDB,
    localStorage,
    databaseName: "c02-browser-handle",
    autoMigrate: false,
    assetUrlRegistry: new AssetUrlRegistry({
      createObjectURL: () => "blob:c02-browser-handle",
      revokeObjectURL: (url) => revoked.push(url),
    }),
  });

  await adapter.writeSnapshot(workspace, { revision: "r0", activate: true });
  await adapter.writeAsset({ record: { id: "asset-1", mime: "image/png" }, data: new Uint8Array([5, 6]) });
  assert.equal(adapter.activeWorkspaceId, workspace.id);
  assert.equal(adapter.acknowledgedRevision, "r0");

  const handle = await adapter.acquireAssetHandle("asset-1");
  assert.equal(handle.handle, "blob:c02-browser-handle");
  assert.equal(handle.mime, "image/png");
  assert.equal(handle.size, 2);
  await handle.release();
  assert.deepEqual(revoked, ["blob:c02-browser-handle"]);

  await adapter.close();
  assert.equal(adapter.activeWorkspaceId, null);
  assert.equal(adapter.acknowledgedRevision, null);
});

test("legacy migration copies, verifies, switches, and retains the old store", async () => {
  const indexedDB = new MemoryIndexedDB();
  const localStorage = new MemoryStorage();
  const workspace = createBlankWorkspace({ id: "legacy-workspace" });
  const legacyCell = createCellRecord(0, 0, { value: "legacy" });
  workspace.objects.home.cells[legacyCell.id] = legacyCell;
  indexedDB.seed("legacy-c02", LEGACY_STORE_NAME, LEGACY_WORKSPACE_KEY, workspace);
  const adapter = new BrowserPersistenceAdapter({
    indexedDB,
    localStorage,
    databaseName: "new-c02",
    legacyDatabaseName: "legacy-c02",
  });

  const migrated = await adapter.open();
  assert.equal(migrated.objects.home.cells[legacyCell.id].value, "legacy");
  assert.ok(indexedDB.get("legacy-c02", LEGACY_STORE_NAME, LEGACY_WORKSPACE_KEY));
  assert.equal(JSON.parse(localStorage.getItem("tactile.browser.boot.v1")).activeWorkspaceId, workspace.id);
});

test("migration verification failure keeps the legacy record available", async () => {
  const indexedDB = new MemoryIndexedDB();
  const localStorage = new MemoryStorage();
  const workspace = createBlankWorkspace({ id: "legacy-failure" });
  indexedDB.seed("legacy-failure-db", LEGACY_STORE_NAME, LEGACY_WORKSPACE_KEY, workspace);
  const adapter = new BrowserPersistenceAdapter({
    indexedDB,
    localStorage,
    databaseName: "new-failure-db",
    legacyDatabaseName: "legacy-failure-db",
  });
  adapter.readSnapshot = async () => null;

  const fallback = await adapter.open();
  assert.equal(fallback.id, workspace.id);
  assert.equal(adapter.migrationError.phase, "verify");
  assert.ok(indexedDB.get("legacy-failure-db", LEGACY_STORE_NAME, LEGACY_WORKSPACE_KEY));
});
