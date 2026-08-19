import { isTauriRuntime, resolveTauriInvoke } from "./platform/tauri/runtime.ts";

const DATABASE_NAME = "tactile-local-workspace";
const DATABASE_VERSION = 3;
const STORE_NAME = "workspaces";
const CURRENT_WORKSPACE_KEY = "current-v3";
const CACHE_KEY = "tactile.workspace.v3";
const NATIVE_WORKSPACE_PATH_KEY = "tactile.native.workspace.path";

export function loadNativeWorkspacePath() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(NATIVE_WORKSPACE_PATH_KEY) || "";
  } catch {
    return "";
  }
}

export function saveNativeWorkspacePath(path) {
  if (typeof window === "undefined") return;
  try {
    if (path) window.localStorage.setItem(NATIVE_WORKSPACE_PATH_KEY, String(path));
    else window.localStorage.removeItem(NATIVE_WORKSPACE_PATH_KEY);
  } catch {
    // The workspace folder itself remains the durable source of truth.
  }
}

async function loadNativeWorkspaceSnapshot(browserWorkspace) {
  if (!isTauriRuntime()) return null;
  const invoke = resolveTauriInvoke();
  if (!invoke) return null;
  let path = loadNativeWorkspacePath() || browserWorkspace?.settings?.nativeWorkspacePath || "";
  if (!path) {
    try {
      const remembered = await invoke("workspace_get_last_path", {});
      path = typeof remembered === "string" ? remembered : remembered?.path || "";
      if (path) saveNativeWorkspacePath(path);
    } catch {
      // Older native builds do not have the native marker command. The
      // browser marker and workspace snapshot remain valid fallbacks.
    }
  }
  if (!path) return null;
  try {
    const result = await invoke("workspace_read_snapshot", { path });
    const raw = typeof result === "string" ? result : result?.contents;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

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

export function saveWorkspaceCache(workspace) {
  try {
    const cache = {
      ...workspace,
      assets: Object.fromEntries(Object.entries(workspace.assets || {}).map(([id, asset]) => {
        const { dataUrl, blob, ...metadata } = asset;
        return [id, metadata];
      })),
    };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    return true;
  } catch {
    return false;
  }
}

export async function loadWorkspace() {
  const cachedWorkspace = loadWorkspaceCache();
  let browserWorkspace = null;
  try {
    const database = await openDatabase();
    const result = await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(CURRENT_WORKSPACE_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Unable to read local workspace."));
    });
    database.close();
    const storedTime = Date.parse(result?.updatedAt || "") || 0;
    const cachedTime = Date.parse(cachedWorkspace?.updatedAt || "") || 0;
    browserWorkspace = cachedTime > storedTime ? cachedWorkspace : result || cachedWorkspace;
  } catch {
    browserWorkspace = cachedWorkspace;
  }
  // A selected native folder is canonical. The browser cache is only a
  // fallback for a first launch or when the folder is temporarily unavailable.
  return (await loadNativeWorkspaceSnapshot(browserWorkspace)) || browserWorkspace;
}

export async function saveWorkspace(workspace) {
  saveWorkspaceCache(workspace);

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
