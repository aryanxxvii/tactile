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

export const DEVICE_LANGUAGE_IDS = new Set([
  "python", "c", "cpp", "java", "rust", "go", "ruby", "bash",
]);

export const DEFAULT_CODE_RUNTIME_SELECTED = Object.freeze(["python"]);

export const EMPTY_CODE_RUNTIME_PROFILE = Object.freeze({
  version: 1,
  paths: Object.freeze({}),
  selected: DEFAULT_CODE_RUNTIME_SELECTED,
  discovery: null,
});

function normalizeDiscovery(value) {
  if (!value || !Array.isArray(value.tools)) return null;
  const tools = value.tools.filter((tool) => (
    tool
    && typeof tool === "object"
    && typeof tool.tool === "string"
    && TOOL_IDS.has(tool.tool)
    && typeof tool.available === "boolean"
  )).map((tool) => ({
    tool: tool.tool,
    command: typeof tool.command === "string" ? tool.command : "",
    configured: Boolean(tool.configured),
    available: tool.available,
    version: typeof tool.version === "string" ? tool.version : "",
    error: typeof tool.error === "string" ? tool.error : null,
  }));
  return {
    cachedAt: typeof value.cachedAt === "string" ? value.cachedAt : "",
    tools,
  };
}

/**
 * The code runtime profile lives on the workspace object (`settings.codeRuntime`),
 * so it is written to the workspace folder alongside everything else. The
 * exported singleton mirrors the live workspace slice; the app publishes
 * updates into it and routes mutations back through `updateSettings`.
 */
export function normalizeCodeRuntimeProfile(value) {
  const paths = {};
  if (value?.paths && typeof value.paths === "object") {
    for (const [tool, path] of Object.entries(value.paths)) {
      if (TOOL_IDS.has(tool) && typeof path === "string" && path.trim()) paths[tool] = path.trim();
    }
  }
  let selected = DEFAULT_CODE_RUNTIME_SELECTED;
  if (Array.isArray(value?.selected)) {
    const picked = value.selected.filter((id) => DEVICE_LANGUAGE_IDS.has(id));
    if (picked.length) selected = picked;
  }
  return Object.freeze({
    version: 1,
    paths: Object.freeze(paths),
    selected: Object.freeze(selected),
    discovery: normalizeDiscovery(value?.discovery),
  });
}

export function createCodeRuntimeProfileStore(storage) {
  const listeners = new Set();
  let snapshot;

  const read = () => {
    if (snapshot) return snapshot;
    try {
      snapshot = normalizeCodeRuntimeProfile(JSON.parse(storage?.getItem(CODE_RUNTIME_PROFILE_STORAGE_KEY) || "null"));
    } catch {
      snapshot = EMPTY_CODE_RUNTIME_PROFILE;
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
      return write({ ...read(), paths });
    },
    setSelected(languages) {
      return write({ ...read(), selected: languages });
    },
    setDiscovery(payload) {
      return write({ ...read(), discovery: payload });
    },
  });
}

const listeners = new Set();
let snapshot = EMPTY_CODE_RUNTIME_PROFILE;
let writer = null;

function commit(next) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

/** The app feeds the live `settings.codeRuntime` slice through this. */
export function publishCodeRuntimeProfile(profile) {
  commit(normalizeCodeRuntimeProfile(profile));
}

/** The app registers a writer that persists mutations back to the workspace. */
export function registerCodeRuntimeProfileWriter(nextWriter) {
  writer = nextWriter;
}

function mutate(mutator) {
  const next = normalizeCodeRuntimeProfile(mutator(snapshot));
  if (writer) writer(next);
  else commit(next);
}

export const getCodeRuntimeProfile = () => snapshot;
export const subscribeCodeRuntimeProfile = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export function setCodeRuntimePath(tool, path) {
  if (!TOOL_IDS.has(tool)) throw new Error(`Unknown code runtime tool: ${tool}`);
  mutate((current) => {
    const paths = { ...current.paths };
    const normalizedPath = typeof path === "string" ? path.trim() : "";
    if (normalizedPath) paths[tool] = normalizedPath;
    else delete paths[tool];
    return { ...current, paths };
  });
}
export function setCodeRuntimeSelected(languages) {
  mutate((current) => ({ ...current, selected: languages }));
}
export function setCodeRuntimeDiscovery(payload) {
  mutate((current) => ({ ...current, discovery: payload }));
}