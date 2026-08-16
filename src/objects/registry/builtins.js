import {
  IconExternalLink,
  IconLayoutGrid,
  IconPlugOff,
  IconTextCaption,
} from "@tabler/icons-react";
import {
  createObjectCompat,
  deserializeObjectCompat,
  migrateObjectCompat,
  serializeObjectCompat,
  validateObjectCompat,
} from "./compatibility.js";
import { defineObjectPlugin } from "./defineObjectPlugin.js";

const noAssetPolicy = Object.freeze({
  kind: "none",
  acceptsBinary: false,
});

const noCommands = () => [];

function defaultCellProjection({ object, fallbackValue = "" }) {
  return {
    displayValue: object?.title || fallbackValue || "Embedded object",
  };
}

function renderer(modulePath, load) {
  return Object.freeze({ modulePath, load });
}

function descriptor({
  type,
  label,
  description,
  icon,
  renderer: rendererDefinition,
  assetPolicy = noAssetPolicy,
  creatable = false,
  manageInSettings = true,
}) {
  return defineObjectPlugin({
    type,
    label,
    description,
    icon,
    source: "built-in",
    defaultEnabled: true,
    creatable,
    manageInSettings,
    renderer: rendererDefinition,
    cell: Object.freeze({ project: defaultCellProjection }),
    create: (options = {}) => createObjectCompat(type, options),
    validate: (object) => validateObjectCompat(type, object),
    migrate: (object, fallbackId) => migrateObjectCompat(type, object, fallbackId),
    serialize: serializeObjectCompat,
    deserialize: deserializeObjectCompat,
    assetPolicy,
    commands: noCommands,
  }, { source: "built-in", defaultEnabled: true, creatable });
}

/**
 * Renderer loaders are functions rather than imported components. They are
 * intentionally not invoked by registry construction, so inactive object
 * renderers remain out of the initial module graph at runtime.
 */
export const OBJECT_TYPE_DEFINITIONS = Object.freeze({
  sheet: descriptor({
    type: "sheet",
    label: "Tiles",
    description: "A sparse, virtualized grid that can contain other objects.",
    icon: IconLayoutGrid,
    creatable: true,
    renderer: renderer("../sheet/SheetObject.jsx", () => import("../sheet/SheetObject.jsx").then((module) => module.SheetObject)),
  }),
  markdown: descriptor({
    type: "markdown",
    label: "Text",
    description: "Local Markdown text with editing and preview modes.",
    icon: IconTextCaption,
    creatable: true,
    renderer: renderer("../markdown/MarkdownObject.jsx", () => import("../markdown/MarkdownObject.jsx").then((module) => module.MarkdownObject)),
  }),
  link: descriptor({
    type: "link",
    label: "Link",
    description: "An external web address opened as an object.",
    icon: IconExternalLink,
    manageInSettings: false,
    renderer: renderer("../link/LinkObject.jsx", () => import("../link/LinkObject.jsx").then((module) => module.LinkObject)),
    assetPolicy: noAssetPolicy,
  }),
});

export const MISSING_PLUGIN_DEFINITION = defineObjectPlugin({
  type: "missing-plugin",
  label: "Plugin required",
  description: "This object needs an optional cell-object plugin.",
  icon: IconPlugOff,
  source: "built-in",
  defaultEnabled: true,
  creatable: false,
  manageInSettings: false,
  renderer: renderer("./MissingPluginObject.jsx", () => import("./MissingPluginObject.jsx").then((module) => module.MissingPluginObject)),
  cell: {
    project: ({ object, fallbackValue = "" }) => ({
      displayValue: object?.title || fallbackValue || "Plugin required",
    }),
  },
  create: (options = {}) => ({ ...options, type: options.type || "missing-plugin" }),
  validate: () => ({ valid: true, errors: [] }),
  migrate: (object) => object,
  serialize: (object) => object,
  deserialize: (input) => input,
  assetPolicy: noAssetPolicy,
  commands: noCommands,
});
