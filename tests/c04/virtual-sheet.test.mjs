import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildAxisGeometry,
  buildVirtualRange,
  expandedRange,
  rangeContains,
} from "../../src/objects/sheet/useVirtualSheet.js";
import {
  compileConditionalRules,
  conditionalToneForCoordinates,
} from "../../src/objects/sheet/grid/conditionalRuleProjection.js";
import { numericRangeContains } from "../../src/objects/sheet/grid/cellSlotProjection.js";

function fixtureGeometry() {
  const rows = Array.from({ length: 256 }, (_, index) => index);
  const columns = Array.from({ length: 64 }, (_, index) => index);
  return {
    rows,
    columns,
    rowGeometry: buildAxisGeometry(rows, undefined, 31, 24, 96),
    columnGeometry: buildAxisGeometry(columns, undefined, 126, 56, 420),
    metrics: { rowHeaderWidth: 34, columnHeaderHeight: 25 },
  };
}

test("virtual ranges rebase in a bounded band instead of following every scroll pixel", () => {
  const { rows, columns, rowGeometry, columnGeometry, metrics } = fixtureGeometry();
  const viewport = { width: 900, height: 500, scrollLeft: 0, scrollTop: 0 };
  const renderOverscan = 5;
  const initial = buildVirtualRange(
    rowGeometry,
    columnGeometry,
    rows.length,
    columns.length,
    metrics,
    viewport,
    renderOverscan,
  );
  const visibleAfterJump = buildVirtualRange(
    rowGeometry,
    columnGeometry,
    rows.length,
    columns.length,
    metrics,
    { ...viewport, scrollTop: 1_000, scrollLeft: 1_000 },
    0,
  );
  const rebased = buildVirtualRange(
    rowGeometry,
    columnGeometry,
    rows.length,
    columns.length,
    metrics,
    { ...viewport, scrollTop: 1_000, scrollLeft: 1_000 },
    renderOverscan,
  );

  assert.equal(rangeContains(initial, visibleAfterJump), false);
  assert.equal(rangeContains(rebased, visibleAfterJump), true);
  assert.ok(rebased.rowEnd - rebased.rowStart < rows.length);
  assert.ok(rebased.columnEnd - rebased.columnStart < columns.length);
  assert.deepEqual(expandedRange(rebased, rows.length, columns.length, 2), {
    rowStart: Math.max(0, rebased.rowStart - 2),
    rowEnd: Math.min(rows.length - 1, rebased.rowEnd + 2),
    columnStart: Math.max(0, rebased.columnStart - 2),
    columnEnd: Math.min(columns.length - 1, rebased.columnEnd + 2),
  });
});

test("selection projection uses numeric bounds without normalizing each cell", () => {
  const range = { rowStart: 2, rowEnd: 5, columnStart: 3, columnEnd: 7 };
  assert.equal(numericRangeContains(range, 2, 3), true);
  assert.equal(numericRangeContains(range, 5, 7), true);
  assert.equal(numericRangeContains(range, 1, 3), false);
  assert.equal(numericRangeContains(range, 4, 8), false);
  assert.equal(numericRangeContains(null, 2, 3), false);
});

test("conditional-format ranges compile once and preserve decimal sign values", () => {
  const compiled = compileConditionalRules([
    { id: "first", range: "A1:C3", kind: "sign" },
    { id: "invalid", range: "not-a-range", kind: "sign" },
  ]);
  assert.deepEqual(compiled, [{
    order: 0,
    kind: "sign",
    rowStart: 0,
    rowEnd: 2,
    columnStart: 0,
    columnEnd: 2,
  }]);
  assert.equal(conditionalToneForCoordinates(compiled, 1, 1, "1.25"), "positive");
  assert.equal(conditionalToneForCoordinates(compiled, 1, 1, "-0.5"), "negative");
  assert.equal(conditionalToneForCoordinates(compiled, 4, 1, "5"), null);
});

test("empty cells stay sparse and embedded timers do not live in ordinary SheetCell", async () => {
  const canvasSource = await readFile(new URL("../../src/objects/sheet/grid/SheetGridCanvas.jsx", import.meta.url), "utf8");
  const sheetCellSource = await readFile(new URL("../../src/objects/sheet/SheetCell.jsx", import.meta.url), "utf8");
  const embeddedSource = await readFile(new URL("../../src/objects/sheet/grid/embeddedCellOpen.js", import.meta.url), "utf8");

  assert.equal(canvasSource.includes("createCellRecord"), false);
  assert.equal(canvasSource.includes("conditionalToneForCell"), false);
  assert.equal(sheetCellSource.includes("setTimeout"), false);
  assert.equal(sheetCellSource.includes("openTimerRef"), false);
  assert.match(embeddedSource, /setTimeout/);
});
