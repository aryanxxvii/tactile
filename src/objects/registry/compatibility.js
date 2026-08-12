import {
  createEmbeddedObject,
  createObjectForType,
  generatedObjectTitle,
  inferFileObjectType,
  normalizeWorkspace,
} from "../../model.js";

/**
 * Keep object construction behind a registry seam while retaining the
 * current model implementation as the source of truth during Wave 1.
 *
 * @param {string} type
 * @param {Object} [options]
 * @returns {Object}
 */
export function createObjectCompat(type, options = {}) {
  return createObjectForType(type, options);
}

/**
 * Adapter for the existing nested-object creation behavior.
 *
 * @param {Object} workspace
 * @param {{parentObjectId: string, parentCellId: string, type: string}} input
 * @returns {{workspace: Object, object: Object | null}}
 */
export function createEmbeddedObjectCompat(workspace, input) {
  return createEmbeddedObject(workspace, input);
}

/**
 * Normalize one object through the existing workspace compatibility path.
 * This deliberately does not introduce a second serialization format.
 *
 * @param {string} type
 * @param {Object} input
 * @param {string} [fallbackId]
 * @returns {Object}
 */
export function migrateObjectCompat(type, input, fallbackId = input?.id || "compat-object") {
  const normalizedWorkspace = normalizeWorkspace({
    format: "tactile",
    version: 4,
    id: "compat-workspace",
    name: "Compatibility workspace",
    homeObjectId: fallbackId,
    objects: { [fallbackId]: { ...input, type: input?.type || type, id: fallbackId } },
    assets: {},
    themes: {},
  });
  return Object.values(normalizedWorkspace.objects)[0] || createObjectCompat(type, { id: fallbackId });
}

/**
 * Validate the minimum shape needed by the current object model. Detailed
 * type-specific validation remains owned by the legacy normalizer until the
 * engine migration replaces it.
 *
 * @param {string} type
 * @param {unknown} object
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateObjectCompat(type, object) {
  const errors = [];
  if (!object || typeof object !== "object") errors.push("Object must be a record.");
  if (typeof object?.id !== "string" || !object.id) errors.push("Object id is required.");
  if (typeof object?.title !== "string" || !object.title) errors.push("Object title is required.");
  const compatibleTypes = type === "document" ? ["document", "markdown"] : [type];
  if (!compatibleTypes.includes(object?.type)) errors.push(`Object type must be ${type}.`);
  return { valid: errors.length === 0, errors };
}

/**
 * Compatibility serializer. Callers that already own a portable serializer
 * can inject it; otherwise the object passes through unchanged so Wave 1
 * does not rewrite import/export behavior.
 *
 * @param {Object} object
 * @param {{serialize?: (object: Object) => unknown}} [context]
 * @returns {unknown}
 */
export function serializeObjectCompat(object, context = {}) {
  return typeof context.serialize === "function" ? context.serialize(object) : object;
}

/**
 * Compatibility deserializer. The current portable reader remains in charge
 * of workspace-level migrations and can be supplied by the caller.
 *
 * @param {unknown} input
 * @param {{deserialize?: (input: unknown) => Object}} [context]
 * @returns {Object}
 */
export function deserializeObjectCompat(input, context = {}) {
  return typeof context.deserialize === "function" ? context.deserialize(input) : input;
}

export const compatibilityAdapters = Object.freeze({
  createObject: createObjectCompat,
  createEmbeddedObject: createEmbeddedObjectCompat,
  migrateObject: migrateObjectCompat,
  validateObject: validateObjectCompat,
  serializeObject: serializeObjectCompat,
  deserializeObject: deserializeObjectCompat,
  generatedObjectTitle,
  inferFileObjectType,
});
