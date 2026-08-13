import assert from "node:assert/strict";
import test from "node:test";

import {
  boundedAxisEntries,
  canonicalSheetSelection,
  selectionCoordinates,
} from "../src/objects/sheet/grid/selectionGeometry.js";

test("selection coordinates and endpoints stay inside the sheet", () => {
  assert.deepEqual(selectionCoordinates("BM999", 256, 64), { row: 255, column: 63 });
  assert.deepEqual(selectionCoordinates("not-an-address", 256, 64, { row: 4, column: 5 }), { row: 4, column: 5 });

  const selection = canonicalSheetSelection({
    selectedAddress: "BM999",
    selectionRange: { anchor: "A1", focus: "BM999" },
    rows: 256,
    columns: 64,
  });

  assert.equal(selection.selectedAddress, "BL256");
  assert.deepEqual(selection.selectedCoordinates, { row: 255, column: 63 });
  assert.deepEqual(selection.range, {
    anchor: "A1",
    focus: "BL256",
    rowStart: 0,
    rowEnd: 255,
    columnStart: 0,
    columnEnd: 63,
  });
});

test("an active cell outside a range is projected to the range focus", () => {
  const selection = canonicalSheetSelection({
    selectedAddress: "Z20",
    selectionRange: { anchor: "C3", focus: "E5" },
    rows: 256,
    columns: 64,
  });

  assert.equal(selection.selectedAddress, "E5");
  assert.deepEqual(selection.range, {
    anchor: "C3",
    focus: "E5",
    rowStart: 2,
    rowEnd: 4,
    columnStart: 2,
    columnEnd: 4,
  });
});

test("virtual axis projection discards invalid or out-of-bounds tiles", () => {
  assert.deepEqual(boundedAxisEntries([0, 1, 64, 3, Number.NaN, 5], -3, 99, 6), [
    { position: 0, index: 0 },
    { position: 1, index: 1 },
    { position: 3, index: 3 },
    { position: 5, index: 5 },
  ]);
});
