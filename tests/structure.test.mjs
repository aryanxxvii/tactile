import assert from "node:assert/strict";
import test from "node:test";
import {
  adjustAxisGroups,
  adjustColumnFilters,
  adjustConditionalFormats,
  adjustFormulaForAxis,
  reorderFormulaForAxis,
} from "../src/sheet/structure.js";

test("row and column insertion adjusts formula references", () => {
  assert.equal(adjustFormulaForAxis("=SUM(A2:$B$4)", "row", 1, "insert"), "=SUM(A3:$B$5)");
  assert.equal(adjustFormulaForAxis("=A1+C3", "column", 1, "insert"), "=A1+D3");
});

test("axis reordering keeps formula references on the moved axis", () => {
  const map = new Map([[0, 1], [1, 2], [2, 0]]);
  assert.equal(reorderFormulaForAxis("=A1+B3", "row", map), "=A2+B1");
});

test("axis deletion shifts references beyond the removed axis", () => {
  assert.equal(adjustFormulaForAxis("=A1+A2+A3", "row", 1, "delete"), "=A1+A2+A2");
});

test("groups, filters and conditional ranges track structural edits", () => {
  assert.deepEqual(
    adjustAxisGroups([{ id: "g", start: 1, end: 3 }], 2, "insert"),
    [{ id: "g", start: 1, end: 4 }],
  );
  assert.deepEqual(
    adjustColumnFilters([{ id: "f", column: 2, value: "x" }], 1, "delete"),
    [{ id: "f", column: 1, value: "x" }],
  );
  assert.deepEqual(
    adjustConditionalFormats([{ id: "r", range: "B2:C4", kind: "sign" }], "row", 1, "insert"),
    [{ id: "r", range: "B3:C5", kind: "sign" }],
  );
});
