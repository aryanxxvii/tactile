import { OBJECT_TYPE_DEFINITIONS } from "./descriptors.js";

const FALLBACK_TYPE = "document";
const rendererPromises = new Map();

/** @type {Map<string, Object>} */
const customDefinitions = new Map();

/**
 * @param {string} type
 * @returns {Object}
 */
export function getObjectTypeDefinition(type) {
  return customDefinitions.get(type) || OBJECT_TYPE_DEFINITIONS[type] || OBJECT_TYPE_DEFINITIONS[FALLBACK_TYPE];
}

/**
 * @returns {Object[]}
 */
export function listObjectTypeDefinitions() {
  return Object.values(OBJECT_TYPE_DEFINITIONS).concat([...customDefinitions.values()]);
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
  if (!definition?.type || typeof definition.type !== "string") {
    throw new Error("Object type definitions need a type key.");
  }
  if (typeof definition.create !== "function" || typeof definition.renderer?.load !== "function") {
    throw new Error(`Object type ${definition.type} needs creation and lazy renderer contracts.`);
  }
  customDefinitions.set(definition.type, Object.freeze(definition));
  return () => customDefinitions.delete(definition.type);
}

/**
 * Resolve a renderer only when the caller explicitly asks for one. The
 * synchronous objectRegistry adapter remains available for the current UI.
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

export { OBJECT_TYPE_DEFINITIONS };
