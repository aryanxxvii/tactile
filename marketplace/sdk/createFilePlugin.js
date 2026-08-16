import { createId } from "tactile:host";

export function createFilePlugin(manifest, Renderer, icon) {
  return {
    type: manifest.type,
    label: manifest.name,
    description: manifest.description,
    icon,
    package: { id: manifest.packageId, version: manifest.version },
    renderer: { load: async () => Renderer },
    cell: { project: ({ object, fallbackValue }) => ({ displayValue: object?.title || fallbackValue || manifest.name }) },
    create: (options = {}) => ({
      ...options,
      id: options.id || createId(manifest.type),
      type: manifest.type,
      title: options.title || `Untitled ${manifest.name}`,
      description: options.description || "",
      parent: options.parent || null,
      assetId: options.assetId || null,
      source: options.source || "",
    }),
    validate: (object) => ({
      valid: object?.type === manifest.type,
      errors: object?.type === manifest.type ? [] : [`Object type must be ${manifest.type}.`],
    }),
    migrate: (object, fallbackId) => ({
      ...object,
      id: object?.id || fallbackId || createId(manifest.type),
      type: manifest.type,
      assetId: object?.assetId || null,
      source: object?.source || "",
    }),
    serialize: (object) => object,
    deserialize: (input) => input,
    assetPolicy: {
      kind: "external-asset",
      acceptsBinary: true,
      extensions: manifest.extensions || [],
      mimePrefixes: manifest.mimePrefixes || [],
    },
  };
}
