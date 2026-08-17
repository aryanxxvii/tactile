import { IconCode, IconTerminal2 } from "@tabler/icons-react";
import { React, createId } from "tactile:host";
import { CodeObject } from "./CodeObject.jsx";

const manifest = __TACTILE_PLUGIN_MANIFEST__;

export function activate() {
  return {
    type: manifest.type,
    label: manifest.name,
    description: manifest.description,
    icon: IconCode,
    package: { id: manifest.packageId, version: manifest.version },
    renderer: { load: async () => CodeObject },
    settings: {
      id: "runtimes",
      label: "Code runtimes",
      icon: IconTerminal2,
      order: 50,
      loadingLabel: "Cooking code runtimes",
      load: async () => (await import("./CodeRuntimeSettings.jsx")).CodeRuntimeSettings,
    },
    cell: {
      project: ({ object, fallbackValue }) => ({ displayValue: object?.title || fallbackValue || manifest.name }),
    },
    create: (options = {}) => ({
      ...options,
      id: options.id || createId("code"),
      type: manifest.type,
      title: options.title || "Untitled Code",
      description: options.description || "",
      parent: options.parent || null,
      content: options.content || "",
      language: options.language || "javascript",
    }),
    validate: (object) => ({
      valid: object?.type === manifest.type,
      errors: object?.type === manifest.type ? [] : [`Object type must be ${manifest.type}.`],
    }),
    migrate: (object, fallbackId) => ({
      ...object,
      id: object?.id || fallbackId || createId("code"),
      type: manifest.type,
      content: object?.content || "",
      language: object?.language || "javascript",
    }),
    serialize: (object) => object,
    deserialize: (input) => input,
  };
}
