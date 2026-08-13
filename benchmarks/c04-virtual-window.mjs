import { performance } from "node:perf_hooks";

import {
  buildAxisGeometry,
  buildVirtualRange,
  rangeContains,
} from "../src/objects/sheet/useVirtualSheet.js";

const rowCount = 10_000;
const columnCount = 256;
const rows = Array.from({ length: rowCount }, (_, index) => index);
const columns = Array.from({ length: columnCount }, (_, index) => index);
const rowGeometry = buildAxisGeometry(rows, undefined, 31, 24, 96);
const columnGeometry = buildAxisGeometry(columns, undefined, 126, 56, 420);
const metrics = { rowHeaderWidth: 34, columnHeaderHeight: 25 };
const viewport = { width: 900, height: 500, scrollLeft: 0, scrollTop: 0 };
const renderOverscan = 5;
let renderRange = buildVirtualRange(
  rowGeometry,
  columnGeometry,
  rowCount,
  columnCount,
  metrics,
  viewport,
  renderOverscan,
);
let rebases = 0;
let maxMountedCells = 0;
const start = performance.now();

for (let frame = 1; frame <= 72; frame += 1) {
  const nextViewport = {
    ...viewport,
    scrollTop: frame * (1_000 / 72),
    scrollLeft: frame * (1_000 / 72),
  };
  const visibleRange = buildVirtualRange(
    rowGeometry,
    columnGeometry,
    rowCount,
    columnCount,
    metrics,
    nextViewport,
    0,
  );
  if (!rangeContains(renderRange, visibleRange)) {
    renderRange = buildVirtualRange(
      rowGeometry,
      columnGeometry,
      rowCount,
      columnCount,
      metrics,
      nextViewport,
      renderOverscan,
    );
    rebases += 1;
  }
  maxMountedCells = Math.max(
    maxMountedCells,
    (renderRange.rowEnd - renderRange.rowStart + 1)
      * (renderRange.columnEnd - renderRange.columnStart + 1),
  );
}

const result = {
  frames: 72,
  rebases,
  maxMountedCells,
  durationMs: performance.now() - start,
};
console.log(JSON.stringify(result, null, 2));

if (rebases >= result.frames) throw new Error("Virtual window rebased on every scroll frame.");
if (maxMountedCells >= 1_000) throw new Error("Virtual cell count exceeded the bounded benchmark budget.");
