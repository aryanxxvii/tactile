import { IconWorld } from "@tabler/icons-react";
import { React, createId } from "tactile:host";
import { SitesObject } from "./SitesObject.jsx";

const manifest = __TACTILE_PLUGIN_MANIFEST__;

export function activate() {
  return {
    type: manifest.type,
    label: manifest.name,
    description: manifest.description,
    icon: IconWorld,
    package: { id: manifest.packageId, version: manifest.version },
    renderer: { load: async () => SitesObject },
    cell: {
      project: ({ object, fallbackValue }) => ({
        displayValue: object?.title || object?.url || fallbackValue || manifest.name,
      }),
    },
    create: (options = {}) => ({
      ...options,
      id: options.id || createId("sites"),
      type: manifest.type,
      title: options.title || "Untitled Site",
      description: options.description || "",
      parent: options.parent || null,
      url: options.url || "",
    }),
    validate: (object) => ({
      valid: object?.type === manifest.type,
      errors: object?.type === manifest.type ? [] : [`Object type must be ${manifest.type}.`],
    }),
    migrate: (object, fallbackId) => ({
      ...object,
      id: object?.id || fallbackId || createId("sites"),
      type: manifest.type,
      url: object?.url || "",
    }),
    serialize: (object) => object,
    deserialize: (input) => input,
  };
}
