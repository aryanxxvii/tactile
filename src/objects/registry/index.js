import { OBJECT_TYPE_DEFINITIONS } from "./descriptors.js";

const FALLBACK_TYPE = "document";

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
export async function loadObjectRenderer(type) {
  const loaded = await getObjectTypeDefinition(type).renderer.load();
  return loaded?.default || loaded;
}

export { OBJECT_TYPE_DEFINITIONS };
