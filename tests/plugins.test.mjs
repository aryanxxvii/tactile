import assert from "node:assert/strict";
import test from "node:test";

import { normalizeWorkspace } from "../src/model.js";
import { counterPlugin } from "../src/objects/registry/template/counterPlugin.js";
import {
  getObjectTypeDefinition,
  listObjectTypeDefinitions,
  projectObjectCell,
  registerObjectTypeDefinition,
  subscribeObjectTypeDefinitions,
} from "../src/objects/registry/index.js";

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
  const unsubscribe = subscribeObjectTypeDefinitions(() => { notifications += 1; });
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
    () => registerObjectTypeDefinition({
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
  assert.equal(listObjectTypeDefinitions().some((definition) => definition.type === counterPlugin.type), false);
});