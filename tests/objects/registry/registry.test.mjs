import assert from "node:assert/strict";
import test from "node:test";

import { getObjectTypeDefinition, listObjectTypeDefinitions } from "../../../src/objects/registry/index.js";

const EXPECTED_TYPES = ["sheet", "markdown", "link"];

test("registers every existing object type with a lazy renderer contract", () => {
  const definitions = listObjectTypeDefinitions();
  assert.deepEqual(
    definitions.map((definition) => definition.type),
    EXPECTED_TYPES,
  );
  for (const type of EXPECTED_TYPES) {
    const definition = getObjectTypeDefinition(type);
    assert.equal(typeof definition.renderer.load, "function");
    assert.equal(typeof definition.create, "function");
    assert.equal(typeof definition.validate, "function");
    assert.equal(typeof definition.migrate, "function");
    assert.equal(typeof definition.serialize, "function");
    assert.equal(typeof definition.deserialize, "function");
    assert.equal(typeof definition.commands, "function");
  }
});

test("renderer loading is explicit and remains bundler-owned", () => {
  const definition = getObjectTypeDefinition("sheet");
  assert.equal(definition.renderer.modulePath, "../sheet/SheetObject.jsx");
  assert.equal(definition.renderer.load.constructor.name, "Function");
});

test("unknown optional types resolve to the explicit missing-plugin renderer", () => {
  const definition = getObjectTypeDefinition("code");
  assert.equal(definition.type, "missing-plugin");
  assert.equal(definition.creatable, false);
});
