import assert from "node:assert/strict";
import test from "node:test";

import {
  CODE_RUNTIME_PROFILE_STORAGE_KEY,
  createCodeRuntimeProfileStore,
  normalizeCodeRuntimeProfile,
} from "../src/platform/code/runtimeProfiles.js";

function memoryStorage(initialValue = null) {
  let value = initialValue;
  return {
    getItem: (key) => key === CODE_RUNTIME_PROFILE_STORAGE_KEY ? value : null,
    setItem: (key, next) => { if (key === CODE_RUNTIME_PROFILE_STORAGE_KEY) value = next; },
    value: () => value,
  };
}

test("code runtime profiles preserve only known non-empty tool paths", () => {
  assert.deepEqual(normalizeCodeRuntimeProfile({
    version: 99,
    paths: { python: " C:\\Python\\python.exe ", unknown: "/tmp/tool", node: "" },
  }), {
    version: 1,
    paths: { python: "C:\\Python\\python.exe" },
    selected: ["python"],
    discovery: null,
  });
});

test("code runtime profile normalizes selection and cached discovery", () => {
  assert.deepEqual(normalizeCodeRuntimeProfile({
    paths: {},
    selected: ["python", "cpp", "not-a-language"],
    discovery: {
      cachedAt: "2026-08-19T00:00:00.000Z",
      tools: [
        { tool: "python", command: "python3", configured: false, available: true, version: "3.12.1" },
        { tool: "bogus", command: "x", available: true },
      ],
    },
  }), {
    version: 1,
    paths: {},
    selected: ["python", "cpp"],
    discovery: {
      cachedAt: "2026-08-19T00:00:00.000Z",
      tools: [
        { tool: "python", command: "python3", configured: false, available: true, version: "3.12.1", error: null },
      ],
    },
  });
});

test("code runtime profile store survives corrupt storage and publishes updates", () => {
  const storage = memoryStorage("not json");
  const store = createCodeRuntimeProfileStore(storage);
  let notifications = 0;
  const unsubscribe = store.subscribe(() => { notifications += 1; });

  assert.deepEqual(store.getSnapshot(), { version: 1, paths: {}, selected: ["python"], discovery: null });
  store.setToolPath("python", "C:\\Python\\python.exe");
  assert.equal(store.getSnapshot().paths.python, "C:\\Python\\python.exe");
  assert.equal(JSON.parse(storage.value()).paths.python, "C:\\Python\\python.exe");
  store.setSelected(["python", "rust"]);
  assert.deepEqual(store.getSnapshot().selected, ["python", "rust"]);
  store.setToolPath("python", "");
  assert.deepEqual(store.getSnapshot().paths, {});
  assert.equal(notifications, 3);
  unsubscribe();
});