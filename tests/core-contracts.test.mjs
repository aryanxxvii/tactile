import assert from "node:assert/strict";
import test from "node:test";

import { cellAddress, coordinatesFromAddress } from "../src/core/coordinates.ts";
import { createBlankWorkspace, normalizeWorkspace } from "../src/core/model.ts";
import { normalizeRange, pasteChanges, rangeLabel, rangeSize } from "../src/core/ranges.ts";
import { adjustFormulaForAxis } from "../src/core/structure.ts";
import { formatCellValue } from "../src/core/formatting.ts";

test("core model facade preserves the blank workspace contract", () => {
  const workspace = createBlankWorkspace({ id: "workspace-test", name: "Core test" });

  assert.equal(workspace.id, "workspace-test");
  assert.equal(workspace.homeObjectId, "home");
  assert.deepEqual(workspace.homePath, []);
  assert.equal(workspace.objects.home.type, "sheet");
  assert.equal(workspace.objects.home.rows, 256);
  assert.equal(workspace.objects.home.columns, 64);
  assert.equal(normalizeWorkspace(workspace).objects.home.type, "sheet");
});

test("typed coordinate and range facades preserve A1 behavior", () => {
  const address = cellAddress(8, 3);
  const coordinates = coordinatesFromAddress(address);
  const range = normalizeRange("D7", "E9");

  assert.equal(address, "D9");
  assert.deepEqual(coordinates, { row: 8, column: 3 });
  assert.equal(rangeLabel(range), "D7:E9");
  assert.equal(rangeSize(range), 6);
});

test("typed pure-helper facades preserve formula, formatting, and paste behavior", () => {
  const range = normalizeRange("B2", "C3");
  const pasted = pasteChanges("B2", "1\t2\n3\t4");

  assert.equal(adjustFormulaForAxis("=A1+$B$2", "row", 0, "insert"), "=A2+$B$3");
  assert.equal(formatCellValue("0.25", { numberFormat: "percent" }), "25%");
  assert.equal(pasted.endAddress, "C3");
  assert.equal(pasted.changes.length, 4);
  assert.equal(range?.rowStart, 1);
  assert.equal(range?.columnStart, 1);
});
