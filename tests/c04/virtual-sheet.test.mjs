import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildAxisGeometry,
  buildVirtualRange,
  directionalOverscan,
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

test("horizontal virtual ranges keep a 65-column sheet inside its axis bounds", () => {
  const rows = Array.from({ length: 256 }, (_, index) => index);
  const columns = Array.from({ length: 65 }, (_, index) => index);
  const rowGeometry = buildAxisGeometry(rows, undefined, 31, 24, 96);
  const columnGeometry = buildAxisGeometry(columns, undefined, 126, 56, 420);
  const metrics = { rowHeaderWidth: 34, columnHeaderHeight: 25 };
  const viewport = { width: 900, height: 500, scrollLeft: 0, scrollTop: 0 };
  const maxScrollLeft = columnGeometry.total - viewport.width;
  const range = buildVirtualRange(
    rowGeometry,
    columnGeometry,
    rows.length,
    columns.length,
    metrics,
    { ...viewport, scrollLeft: maxScrollLeft },
    5,
  );

  assert.equal(range.columnEnd, columns.length - 1);
  assert.ok(range.columnStart >= 0);
  assert.ok(range.columnEnd < columns.length);
  assert.ok(range.rowStart >= 0);
  assert.ok(range.rowEnd < rows.length);
  assert.equal(
    rangeContains(
      range,
      buildVirtualRange(
        rowGeometry,
        columnGeometry,
        rows.length,
        columns.length,
        metrics,
        { ...viewport, scrollLeft: maxScrollLeft },
        0,
      ),
    ),
    true,
  );
});

test("rapid scroll look-ahead is directional and bounded", () => {
  assert.deepEqual(directionalOverscan({ rowHeight: 31, columnWidth: 126 }, { scrollTop: 620, scrollLeft: 260 }, 5), {
    top: 5,
    bottom: 11,
    left: 5,
    right: 8,
  });
  assert.deepEqual(
    directionalOverscan({ rowHeight: 31, columnWidth: 126 }, { scrollTop: -10_000, scrollLeft: -10_000 }, 5),
    { top: 11, bottom: 5, left: 11, right: 5 },
  );
});

test("default-matrix render windows stay bounded at arbitrary offsets", () => {
  const { rows, columns, rowGeometry, columnGeometry, metrics } = fixtureGeometry();
  const viewport = { width: 1_280, height: 720 };
  const destinations = [
    { scrollLeft: 0, scrollTop: 0 },
    { scrollLeft: columnGeometry.total / 2, scrollTop: rowGeometry.total / 2 },
    {
      scrollLeft: Math.max(0, columnGeometry.total - viewport.width),
      scrollTop: Math.max(0, rowGeometry.total - viewport.height),
    },
  ];
  let previous = destinations[0];

  destinations.forEach((destination) => {
    const projectedViewport = { ...viewport, ...destination };
    const range = buildVirtualRange(
      rowGeometry,
      columnGeometry,
      rows.length,
      columns.length,
      metrics,
      projectedViewport,
      directionalOverscan(
        { ...metrics, rowHeight: 31, columnWidth: 126 },
        {
          scrollLeft: destination.scrollLeft - previous.scrollLeft,
          scrollTop: destination.scrollTop - previous.scrollTop,
        },
        5,
      ),
    );
    const visible = buildVirtualRange(
      rowGeometry,
      columnGeometry,
      rows.length,
      columns.length,
      metrics,
      projectedViewport,
      0,
    );
    const mountedCellCount = (range.rowEnd - range.rowStart + 1) * (range.columnEnd - range.columnStart + 1);

    assert.equal(rangeContains(range, visible), true);
    assert.ok(mountedCellCount > 0);
    assert.ok(mountedCellCount < 2_048, `expected a bounded window, received ${mountedCellCount} cells`);
    previous = destination;
  });
});

test("virtual range math clamps malformed offsets and geometry mismatches", () => {
  const { rows, columns, rowGeometry, columnGeometry, metrics } = fixtureGeometry();
  const edge = buildVirtualRange(
    rowGeometry,
    columnGeometry,
    rows.length + 100,
    columns.length + 100,
    metrics,
    { width: 900, height: 500, scrollLeft: Number.MAX_SAFE_INTEGER, scrollTop: Number.MAX_SAFE_INTEGER },
    9,
  );
  assert.ok(edge.rowStart >= 0);
  assert.ok(edge.rowEnd < rows.length);
  assert.ok(edge.columnStart >= 0);
  assert.ok(edge.columnEnd < columns.length);

  const sanitized = buildVirtualRange(
    rowGeometry,
    columnGeometry,
    rows.length,
    columns.length,
    metrics,
    { width: 900, height: 500, scrollLeft: -400, scrollTop: Number.NaN },
    { top: 2, bottom: 4, left: 1, right: 3 },
  );
  assert.ok(sanitized.rowStart >= 0 && sanitized.rowEnd < rows.length);
  assert.ok(sanitized.columnStart >= 0 && sanitized.columnEnd < columns.length);
  assert.deepEqual(expandedRange(null, 0, 0, 2), {
    rowStart: 0,
    rowEnd: -1,
    columnStart: 0,
    columnEnd: -1,
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
  assert.deepEqual(compiled, [
    {
      order: 0,
      kind: "sign",
      rowStart: 0,
      rowEnd: 2,
      columnStart: 0,
      columnEnd: 2,
    },
  ]);
  assert.equal(conditionalToneForCoordinates(compiled, 1, 1, "1.25"), "positive");
  assert.equal(conditionalToneForCoordinates(compiled, 1, 1, "-0.5"), "negative");
  assert.equal(conditionalToneForCoordinates(compiled, 4, 1, "5"), null);
});

test("empty cells stay sparse and embedded timers do not live in ordinary SheetCell", async () => {
  const canvasSource = await readFile(
    new URL("../../src/objects/sheet/grid/SheetGridCanvas.jsx", import.meta.url),
    "utf8",
  );
  const sheetCellSource = await readFile(new URL("../../src/objects/sheet/SheetCell.jsx", import.meta.url), "utf8");
  const embeddedSource = await readFile(
    new URL("../../src/objects/sheet/grid/embeddedCellOpen.js", import.meta.url),
    "utf8",
  );

  assert.equal(canvasSource.includes("createCellRecord"), false);
  assert.equal(canvasSource.includes("conditionalToneForCell"), false);
  assert.equal(sheetCellSource.includes("setTimeout"), false);
  assert.equal(sheetCellSource.includes("openTimerRef"), false);
  assert.match(embeddedSource, /setTimeout/);
});
