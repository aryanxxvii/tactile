const DATABASE_NAME = "tactile-local-workspace";
const DATABASE_VERSION = 3;
const STORE_NAME = "workspaces";
const CURRENT_WORKSPACE_KEY = "current-v3";
const CACHE_KEY = "tactile.workspace.v3";

function openDatabase() {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.reject(new Error("IndexedDB is unavailable."));
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Unable to open local storage."));
  });
}

export function loadWorkspaceCache() {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.localStorage.getItem(CACHE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export async function loadWorkspace() {
  try {
    const database = await openDatabase();
    const result = await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(CURRENT_WORKSPACE_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Unable to read local workspace."));
    });
    database.close();
    return result || loadWorkspaceCache();
  } catch {
    return loadWorkspaceCache();
  }
}

export async function saveWorkspace(workspace) {
  try {
    const cache = {
      ...workspace,
      assets: Object.fromEntries(Object.entries(workspace.assets || {}).map(([id, asset]) => {
        const { dataUrl, blob, ...metadata } = asset;
        return [id, metadata];
      })),
    };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // IndexedDB remains the canonical browser store when the cache is unavailable.
  }

  try {
    const database = await openDatabase();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(workspace, CURRENT_WORKSPACE_KEY);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("Unable to save local workspace."));
    });
    database.close();
    return true;
  } catch {
    return false;
  }
}
