import { MISSING_PLUGIN_DEFINITION, OBJECT_TYPE_DEFINITIONS } from "./builtins.js";
import { defineObjectPlugin } from "./defineObjectPlugin.js";

const rendererPromises = new Map();
const registryListeners = new Set();
let registryVersion = 0;

/** @type {Map<string, Object>} */
const customDefinitions = new Map();

/**
 * @param {string} type
 * @returns {Object}
 */
export function getObjectTypeDefinition(type) {
  return customDefinitions.get(type) || OBJECT_TYPE_DEFINITIONS[type] || MISSING_PLUGIN_DEFINITION;
}

export function hasObjectTypeDefinition(type) {
  return customDefinitions.has(type) || Boolean(OBJECT_TYPE_DEFINITIONS[type]);
}

/**
 * @returns {Object[]}
 */
export function listObjectTypeDefinitions() {
  return Object.values(OBJECT_TYPE_DEFINITIONS).concat([...customDefinitions.values()]);
}

export function subscribeObjectTypeDefinitions(listener) {
  registryListeners.add(listener);
  return () => registryListeners.delete(listener);
}

export function objectTypeRegistryVersion() {
  return registryVersion;
}

function notifyRegistryChanged() {
  registryVersion += 1;
  registryListeners.forEach((listener) => listener());
}

/**
 * Register a plugin or future object type without changing the workspace
 * shell. Existing built-in keys are replaceable only through this explicit
 * seam, which keeps compatibility behavior observable and testable.
 *
 * @param {Object} definition
 * @returns {() => void}
 */
export function registerObjectTypeDefinition(definition) {
  const installed = defineObjectPlugin(definition);
  customDefinitions.set(definition.type, installed);
  rendererPromises.delete(definition.type);
  notifyRegistryChanged();
  return () => {
    if (customDefinitions.get(definition.type) !== installed) return;
    customDefinitions.delete(definition.type);
    rendererPromises.delete(definition.type);
    notifyRegistryChanged();
  };
}

/**
 * Resolve a renderer only when the caller explicitly asks for one. The
 * synchronous renderer adapter remains available for the current UI.
 *
 * @param {string} type
 * @returns {Promise<Function>}
 */
export function loadObjectRenderer(type) {
  const definition = getObjectTypeDefinition(type);
  const key = definition.type;
  const existing = rendererPromises.get(key);
  if (existing) return existing;

  const promise = definition.renderer.load()
    .then((loaded) => loaded?.default || loaded)
    .catch((error) => {
      rendererPromises.delete(key);
      throw error;
    });
  rendererPromises.set(key, promise);
  return promise;
}

/**
 * Warm only a renderer referenced by a currently visible embedded cell. The
 * registry remains lazy: callers opt into this just-in-time hint, and
 * inactive object types are never loaded at registry construction time.
 *
 * @param {string} type
 * @returns {Promise<Function | null>}
 */
export function preloadObjectRenderer(type) {
  return loadObjectRenderer(type).catch(() => null);
}

export function projectObjectCell(type, input = {}) {
  const definition = getObjectTypeDefinition(type);
  try {
    return definition.cell?.project?.(input) || {};
  } catch {
    return { displayValue: input.object?.title || input.fallbackValue || "Embedded object" };
  }
}

export { OBJECT_TYPE_DEFINITIONS };
