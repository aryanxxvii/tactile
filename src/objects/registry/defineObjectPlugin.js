const NO_ASSET_POLICY = Object.freeze({
  kind: "none",
  acceptsBinary: false,
});

const NO_COMMANDS = () => [];

function requiredFunction(plugin, value, name) {
  if (typeof value !== "function") {
    throw new Error(`Object plugin ${plugin.type || "<unknown>"} needs a ${name} contract.`);
  }
  return value;
}

function settingsContribution(plugin) {
  if (plugin.settings == null) return undefined;
  const settings = plugin.settings;
  if (!settings.id || typeof settings.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(settings.id)) {
    throw new Error(`Object plugin ${plugin.type} needs a stable lowercase settings id.`);
  }
  if (!settings.label || typeof settings.label !== "string") {
    throw new Error(`Object plugin ${plugin.type} needs a settings label.`);
  }
  if (typeof settings.icon !== "function" && typeof settings.icon !== "object") {
    throw new Error(`Object plugin ${plugin.type} needs a settings icon component.`);
  }
  const load = requiredFunction(plugin, settings.load, "lazy settings panel");
  const order = Number.isFinite(settings.order) ? settings.order : 100;
  if (settings.loadingLabel != null && typeof settings.loadingLabel !== "string") {
    throw new Error(`Object plugin ${plugin.type} needs a string settings loading label.`);
  }
  return Object.freeze({ ...settings, order, load });
}

/**
 * Normalize and validate one installable cell-object plugin.
 *
 * The expanded renderer and compact cell projection are deliberately
 * separate: opening an object may load a substantial UI chunk, while grid
 * scrolling must keep cell projection synchronous and cheap.
 */
export function defineObjectPlugin(plugin, defaults = {}) {
  if (!plugin?.type || typeof plugin.type !== "string") {
    throw new Error("Object plugins need a stable type key.");
  }
  if (!plugin.label || typeof plugin.label !== "string") {
    throw new Error(`Object plugin ${plugin.type} needs a label.`);
  }
  if (typeof plugin.icon !== "function" && typeof plugin.icon !== "object") {
    throw new Error(`Object plugin ${plugin.type} needs an icon component.`);
  }

  const rendererLoad = requiredFunction(plugin, plugin.renderer?.load, "lazy expanded renderer");
  const cellProject = requiredFunction(plugin, plugin.cell?.project, "cell projection");
  const settings = settingsContribution(plugin);
  const definition = {
    source: "runtime",
    defaultEnabled: true,
    creatable: true,
    assetPolicy: NO_ASSET_POLICY,
    commands: NO_COMMANDS,
    ...defaults,
    ...plugin,
    renderer: Object.freeze({
      ...(plugin.renderer || {}),
      load: rendererLoad,
    }),
    cell: Object.freeze({
      ...(plugin.cell || {}),
      project: cellProject,
    }),
    ...(settings ? { settings } : {}),
    create: requiredFunction(plugin, plugin.create, "creation"),
    validate: requiredFunction(plugin, plugin.validate, "validation"),
    migrate: requiredFunction(plugin, plugin.migrate, "migration"),
    serialize: requiredFunction(plugin, plugin.serialize, "serialization"),
    deserialize: requiredFunction(plugin, plugin.deserialize, "deserialization"),
  };
  return Object.freeze(definition);
}