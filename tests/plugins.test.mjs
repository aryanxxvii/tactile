import assert from "node:assert/strict";
import test from "node:test";

import { normalizeWorkspace } from "../src/model.js";
import { counterPlugin } from "../src/objects/registry/template/counterPlugin.js";
import {
  getObjectTypeDefinition,
  listObjectTypeDefinitions,
  loadObjectRenderer,
  projectObjectCell,
  registerObjectTypeDefinition,
  subscribeObjectTypeDefinitions,
} from "../src/objects/registry/index.js";
import { buildPluginSettingsContributions } from "../src/objects/registry/settingsContributions.js";

test("built-in cell objects implement expanded UI and cell projection contracts", () => {
  for (const definition of listObjectTypeDefinitions()) {
    assert.equal(typeof definition.renderer?.load, "function", `${definition.type} renderer`);
    assert.equal(typeof definition.cell?.project, "function", `${definition.type} cell projection`);
    assert.equal(typeof definition.create, "function", `${definition.type} creation`);
    assert.equal(typeof definition.validate, "function", `${definition.type} validation`);
  }
});

test("a runtime plugin is observable, projectable, and removable without restart", () => {
  let notifications = 0;
  const unsubscribe = subscribeObjectTypeDefinitions(() => {
    notifications += 1;
  });
  const uninstall = registerObjectTypeDefinition({
    type: "runtime-counter",
    label: "Counter",
    description: "Runtime test object",
    icon: () => null,
    create: (options = {}) => ({ id: "counter-1", type: "runtime-counter", title: "Counter", ...options }),
    validate: () => ({ valid: true, errors: [] }),
    migrate: (object) => object,
    serialize: (object) => object,
    deserialize: (object) => object,
    renderer: { load: async () => () => null },
    cell: { project: ({ object }) => ({ displayValue: String(object?.count ?? 0) }) },
  });

  assert.equal(getObjectTypeDefinition("runtime-counter").type, "runtime-counter");
  assert.equal(projectObjectCell("runtime-counter", { object: { count: 7 } }).displayValue, "7");
  assert.equal(notifications, 1);

  uninstall();
  unsubscribe();
  assert.notEqual(getObjectTypeDefinition("runtime-counter").type, "runtime-counter");
  assert.equal(notifications, 2);
});

test("runtime plugins must provide both UI and cell logic", () => {
  assert.throws(
    () =>
      registerObjectTypeDefinition({
        type: "missing-cell-logic",
        label: "Missing cell logic",
        icon: () => null,
        create: () => ({}),
        validate: () => ({ valid: true, errors: [] }),
        migrate: (object) => object,
        serialize: (object) => object,
        deserialize: (object) => object,
        renderer: { load: async () => () => null },
      }),
    /cell projection contract/,
  );
});

test("runtime plugins may contribute a validated lazy settings panel", async () => {
  const SettingsPanel = () => null;
  const plugin = {
    type: "runtime-settings",
    label: "Runtime settings",
    icon: () => null,
    settings: {
      id: "connection",
      label: "Connection",
      icon: () => null,
      loadingLabel: "Connecting runtime",
      load: async () => SettingsPanel,
    },
    create: () => ({ id: "settings", type: "runtime-settings" }),
    validate: () => ({ valid: true, errors: [] }),
    migrate: (object) => object,
    serialize: (object) => object,
    deserialize: (object) => object,
    renderer: { load: async () => () => null },
    cell: { project: () => ({ displayValue: "Settings" }) },
  };
  const uninstall = registerObjectTypeDefinition(plugin);
  const installed = getObjectTypeDefinition(plugin.type);

  assert.equal(installed.settings.id, "connection");
  assert.equal(installed.settings.order, 100);
  assert.equal(installed.settings.loadingLabel, "Connecting runtime");
  assert.equal(await installed.settings.load(), SettingsPanel);
  uninstall();

  assert.throws(
    () =>
      registerObjectTypeDefinition({
        ...plugin,
        type: "invalid-settings",
        settings: { ...plugin.settings, id: "Not Stable" },
      }),
    /stable lowercase settings id/,
  );
  assert.throws(
    () =>
      registerObjectTypeDefinition({
        ...plugin,
        type: "invalid-loading-label",
        settings: { ...plugin.settings, loadingLabel: 42 },
      }),
    /string settings loading label/,
  );
});

test("the generic template installs as a creatable menu object and preserves plugin state", () => {
  const object = counterPlugin.create({ id: "counter-test", count: 12 });
  const uninstall = registerObjectTypeDefinition(counterPlugin);
  const installed = listObjectTypeDefinitions().find((definition) => definition.type === counterPlugin.type);

  assert.equal(installed?.creatable, true);
  assert.equal(installed?.label, "Counter");
  assert.equal(projectObjectCell(counterPlugin.type, { object }).displayValue, "Count 12");

  const normalized = normalizeWorkspace({
    format: "tactile",
    version: 4,
    id: "plugin-workspace",
    name: "Plugin workspace",
    homeObjectId: object.id,
    objects: { [object.id]: object },
  });
  assert.equal(normalized.objects[object.id].type, counterPlugin.type);
  assert.equal(normalized.objects[object.id].count, 12);

  uninstall();
  assert.equal(
    listObjectTypeDefinitions().some((definition) => definition.type === counterPlugin.type),
    false,
  );
});

test("installing a new version for the same type replaces its renderer", async () => {
  const definition = (version) => ({
    type: "runtime-update",
    label: "Runtime update",
    icon: () => null,
    create: () => ({ id: "update", type: "runtime-update", title: "Update" }),
    validate: () => ({ valid: true, errors: [] }),
    migrate: (object) => object,
    serialize: (object) => object,
    deserialize: (object) => object,
    renderer: {
      load: async () =>
        function RuntimeRenderer() {
          return version;
        },
    },
    cell: { project: () => ({ displayValue: version }) },
  });
  const uninstallFirst = registerObjectTypeDefinition(definition("v1"));
  const first = await loadObjectRenderer("runtime-update");
  const uninstallSecond = registerObjectTypeDefinition(definition("v2"));
  const second = await loadObjectRenderer("runtime-update");
  assert.equal(first(), "v1");
  assert.equal(second(), "v2");
  uninstallFirst();
  uninstallSecond();
});

test("plugin settings contributions are enabled, namespaced, and ordered", () => {
  const icon = () => null;
  const load = async () => () => null;
  const contributions = buildPluginSettingsContributions(
    [
      {
        type: "later",
        package: { id: "example.later" },
        settings: { id: "main", label: "Later", icon, load, order: 20 },
      },
      { type: "disabled", settings: { id: "main", label: "Disabled", icon, load, order: 1 } },
      {
        type: "first",
        package: { id: "example.first" },
        settings: { id: "main", label: "First", icon, load, order: 10 },
      },
    ],
    new Set(["first", "later"]),
  );

  assert.deepEqual(
    contributions.map((contribution) => contribution.key),
    ["example.first:main", "example.later:main"],
  );
  assert.equal(contributions[0].tabId, "settings-tab-plugin-example.first:main");
  assert.equal(contributions[0].panelId, "settings-panel-plugin-example.first:main");
});
