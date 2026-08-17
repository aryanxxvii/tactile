export const CODE_RUNTIME_PROFILE_STORAGE_KEY = "tactile.code.runtimeProfiles.v1";

export const CODE_RUNTIME_TOOLS = Object.freeze([
  Object.freeze({ id: "python", label: "Python", command: "python3 / python / py" }),
  Object.freeze({ id: "gcc", label: "C compiler", command: "gcc" }),
  Object.freeze({ id: "gpp", label: "C++ compiler", command: "g++" }),
  Object.freeze({ id: "javac", label: "Java compiler", command: "javac" }),
  Object.freeze({ id: "java", label: "Java runtime", command: "java" }),
  Object.freeze({ id: "rustc", label: "Rust compiler", command: "rustc" }),
  Object.freeze({ id: "go", label: "Go", command: "go" }),
  Object.freeze({ id: "ruby", label: "Ruby", command: "ruby" }),
  Object.freeze({ id: "bash", label: "Bash", command: "bash" }),
]);

const TOOL_IDS = new Set(CODE_RUNTIME_TOOLS.map((tool) => tool.id));
const EMPTY_PROFILE = Object.freeze({ version: 1, paths: Object.freeze({}) });

export function normalizeCodeRuntimeProfile(value) {
  const paths = {};
  if (value?.paths && typeof value.paths === "object") {
    for (const [tool, path] of Object.entries(value.paths)) {
      if (TOOL_IDS.has(tool) && typeof path === "string" && path.trim()) paths[tool] = path.trim();
    }
  }
  return Object.freeze({ version: 1, paths: Object.freeze(paths) });
}

export function createCodeRuntimeProfileStore(storage) {
  const listeners = new Set();
  let snapshot;

  const read = () => {
    if (snapshot) return snapshot;
    try {
      snapshot = normalizeCodeRuntimeProfile(JSON.parse(storage?.getItem(CODE_RUNTIME_PROFILE_STORAGE_KEY) || "null"));
    } catch {
      snapshot = EMPTY_PROFILE;
    }
    return snapshot;
  };

  const write = (next) => {
    snapshot = normalizeCodeRuntimeProfile(next);
    try {
      storage?.setItem(CODE_RUNTIME_PROFILE_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // The in-memory profile remains usable when local storage is unavailable.
    }
    listeners.forEach((listener) => listener());
    return snapshot;
  };

  return Object.freeze({
    getSnapshot: read,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setToolPath(tool, path) {
      if (!TOOL_IDS.has(tool)) throw new Error(`Unknown code runtime tool: ${tool}`);
      const paths = { ...read().paths };
      const normalizedPath = typeof path === "string" ? path.trim() : "";
      if (normalizedPath) paths[tool] = normalizedPath;
      else delete paths[tool];
      return write({ version: 1, paths });
    },
  });
}

const defaultStorage = typeof globalThis === "undefined" ? null : globalThis.localStorage;
const defaultStore = createCodeRuntimeProfileStore(defaultStorage);

export const getCodeRuntimeProfile = defaultStore.getSnapshot;
export const subscribeCodeRuntimeProfile = defaultStore.subscribe;
export const setCodeRuntimePath = defaultStore.setToolPath;