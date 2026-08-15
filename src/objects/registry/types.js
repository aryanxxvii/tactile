/**
 * The registry contracts intentionally live in a JavaScript module for now.
 * The JSDoc shapes are consumed by editors and can be promoted to TypeScript
 * without changing the object-type boundary.
 *
 * @typedef {"sheet" | "markdown" | "document" | "pdf" | "image" | "video" | "html" | "svg" | "link"} ObjectTypeKey
 *
 * @typedef {Object} RendererDefinition
 * @property {() => Promise<{default?: Function, [key: string]: Function}>} load
 * @property {string} modulePath
 *
 * @typedef {Object} AssetPolicy
 * @property {"none" | "external-asset"} kind
 * @property {boolean} acceptsBinary
 * @property {string[]} [extensions]
 * @property {string[]} [mimePrefixes]
 *
 * @typedef {Object} ObjectCommandContribution
 * @property {string} id
 * @property {string} label
 * @property {string} [group]
 * @property {(context: Object) => boolean} [isAvailable]
 * @property {(context: Object) => unknown} [run]
 *
 * @typedef {Object} ObjectTypeDefinition
 * @property {ObjectTypeKey} type
 * @property {string} label
 * @property {Function} icon
 * @property {RendererDefinition} renderer
 * @property {(options?: Object) => Object} create
 * @property {(object: unknown) => {valid: boolean, errors: string[]}} validate
 * @property {(object: unknown, fallbackId?: string) => Object} migrate
 * @property {(object: Object, context?: Object) => unknown} serialize
 * @property {(input: unknown, context?: Object) => Object} deserialize
 * @property {AssetPolicy} assetPolicy
 * @property {() => ObjectCommandContribution[]} commands
 */

export {};
