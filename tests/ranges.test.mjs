import assert from "node:assert/strict";
import test from "node:test";
import { createCellRecord, createSheetObject } from "../src/model.js";
import {
  fillChanges,
  normalizeRange,
  pasteChanges,
  rangeLabel,
  serializeRange,
  shiftFormulaReferences,
} from "../src/sheet/ranges.js";
import { formatCellValue } from "../src/sheet/formatting.js";
import { conditionalToneForCell } from "../src/sheet/conditionalFormatting.js";
import { sortRangeChanges } from "../src/sheet/sort.js";

test("sheet ranges normalize in either drag direction", () => {
  const range = normalizeRange("C4", "A2");
  assert.deepEqual(
    { rowStart: range.rowStart, rowEnd: range.rowEnd, columnStart: range.columnStart, columnEnd: range.columnEnd },
    { rowStart: 1, rowEnd: 3, columnStart: 0, columnEnd: 2 },
  );
  assert.equal(rangeLabel(range), "A2:C4");
});

test("range clipboard uses spreadsheet-compatible TSV", () => {
  const sheet = createSheetObject({ id: "sheet" });
  sheet.cells.r1c1 = createCellRecord(0, 0, { value: "Name" });
  sheet.cells.r1c2 = createCellRecord(0, 1, { value: "Value" });
  sheet.cells.r2c1 = createCellRecord(1, 0, { value: "Tactile" });
  sheet.cells.r2c2 = createCellRecord(1, 1, { formula: "=1+1" });
  assert.equal(serializeRange(sheet, { anchor: "A1", focus: "B2" }), "Name\tValue\nTactile\t=1+1");

  const pasted = pasteChanges("C3", "10\t20\n30\t=SUM(C3:D3)");
  assert.equal(pasted.endAddress, "D4");
  assert.equal(pasted.changes.length, 4);
  assert.equal(pasted.changes[3].patch.formula, "=SUM(C3:D3)");
});

test("pasted TSV stays rectangular when a row has missing trailing cells", () => {
  const pasted = pasteChanges("B2", "one\ttwo\nthree");

  assert.equal(pasted.endAddress, "C3");
  assert.deepEqual(
    pasted.changes.map((change) => [change.cellId, change.patch.value]),
    [
      ["r2c2", "one"],
      ["r2c3", "two"],
      ["r3c2", "three"],
      ["r3c3", ""],
    ],
  );
});

test("range clipboard preserves cell formatting alongside values", () => {
  const sheet = createSheetObject({ id: "format-clip" });
  sheet.cells.r1c1 = createCellRecord(0, 0, { value: "Done", style: { bold: true, highlight: "mint", align: "center" } });
  sheet.cells.r1c2 = createCellRecord(0, 1, { value: "Note" });
  sheet.cells.r2c1 = createCellRecord(1, 0, { value: "Q3", style: { textColor: "accent", fontSize: 14 } });
  sheet.cells.r2c2 = createCellRecord(1, 1, { value: "", style: { bold: true } });
  const text = serializeRange(sheet, { anchor: "A1", focus: "B2" });
  // Plain value TSV stays first (cross-app compatible); the style block follows.
  assert.equal(text.split("\n")[0], "Done\tNote");
  assert.ok(text.endsWith("TACTILE-STYLE⁂"));

  const pasted = pasteChanges("C5", text);
  assert.equal(pasted.changes.length, 4);
  const styleFor = (id) => pasted.changes.find((change) => change.cellId === id)?.patch.style;
  assert.deepEqual(styleFor("r5c3"), { bold: true, highlight: "mint", align: "center" });
  assert.equal(styleFor("r5c4"), undefined, "unstyled source cell must not clobber destination style");
  assert.deepEqual(styleFor("r6c3"), { textColor: "accent", fontSize: 14 });
  assert.deepEqual(styleFor("r6c4"), { bold: true });
});

test("paste of plain TSV without a style block leaves styles untouched", () => {
  const pasted = pasteChanges("B2", "x\ty\nz\tw");
  assert.equal(pasted.changes.length, 4);
  assert.ok(pasted.changes.every((change) => change.patch.style === undefined));
});

test("pasted patch omits style when source had none so it never clobbers destination", () => {
  // The patch must not carry `style` at all when the source cell was unstyled,
  // otherwise the spread in commitCellChanges would overwrite an existing
  // destination style with undefined.
  const patch = { value: "new", formula: "", embed: null };
  const merged = { ...createCellRecord(0, 0, { style: { highlight: "rose" } }), ...patch };
  assert.deepEqual(merged.style, { highlight: "rose" });
});

test("fill adjusts relative formula references and keeps absolutes", () => {
  assert.equal(shiftFormulaReferences("=A1+$B$2+C$3+$D4", 2, 1), "=B3+$B$2+D$3+$D6");
  const sheet = createSheetObject({ id: "sheet" });
  sheet.cells.r1c1 = createCellRecord(0, 0, { formula: "=B1*2" });
  const changes = fillChanges(sheet, "A1", "A3");
  assert.equal(changes[0].patch.formula, "=B2*2");
  assert.equal(changes[1].patch.formula, "=B3*2");
});

test("fill continues numeric and numbered labels as a series", () => {
  const sheet = { cells: { "0:0": { value: "10" } } };
  const changes = fillChanges(sheet, "A1", "A3");
  assert.deepEqual(changes.map((change) => change.patch.value), ["11", "12"]);
  const labelChanges = fillChanges({ cells: { "0:0": { value: "Task 1" } } }, "A1", "A3");
  assert.deepEqual(labelChanges.map((change) => change.patch.value), ["Task 2", "Task 3"]);
});

test("fill repeats a constant selected block instead of inventing a series", () => {
  const sheet = {
    cells: {
      "0:0": { value: "1" },
      "1:0": { value: "1" },
      "2:0": { value: "1" },
    },
  };
  const changes = fillChanges(sheet, "A3", "A6", { anchor: "A1", focus: "A3" });
  assert.deepEqual(changes.map((change) => change.patch.value), ["1", "1", "1"]);
});

test("fill continues an ordered selected block as a series", () => {
  const sheet = {
    cells: {
      "0:0": { value: "1" },
      "1:0": { value: "2" },
      "2:0": { value: "3" },
    },
  };
  const changes = fillChanges(sheet, "A3", "A6", { anchor: "A1", focus: "A3" });
  assert.deepEqual(changes.map((change) => change.patch.value), ["4", "5", "6"]);
});

test("fill continues each column series in a rectangular selection", () => {
  const sheet = { cells: {} };
  for (let row = 0; row < 6; row += 1) {
    sheet.cells[`r${row + 1}c2`] = { value: String(row + 1) };
    sheet.cells[`r${row + 1}c3`] = { value: String(row + 1) };
  }
  const changes = fillChanges(sheet, "C6", "C9", { anchor: "B1", focus: "C6" });
  assert.deepEqual(
    changes.map((change) => [change.cellId, change.patch.value]),
    [
      ["r7c2", "7"],
      ["r7c3", "7"],
      ["r8c2", "8"],
      ["r8c3", "8"],
      ["r9c2", "9"],
      ["r9c3", "9"],
    ],
  );
});

test("cell number formats remain data-preserving display transforms", () => {
  assert.equal(formatCellValue("1234.5", { numberFormat: "number" }), "1,234.50");
  assert.equal(formatCellValue("0.125", { numberFormat: "percent" }), "12.5%");
  assert.equal(formatCellValue("not a number", { numberFormat: "number" }), "not a number");
});

test("range sorting moves complete records and keeps formulas relative", () => {
  const sheet = createSheetObject({ id: "sort" });
  sheet.cells.r1c1 = createCellRecord(0, 0, { value: "B" });
  sheet.cells.r1c2 = createCellRecord(0, 1, { formula: "=A1" });
  sheet.cells.r2c1 = createCellRecord(1, 0, { value: "A" });
  sheet.cells.r2c2 = createCellRecord(1, 1, { formula: "=A2" });
  const changes = sortRangeChanges(sheet, { anchor: "A1", focus: "B2" }, 0, "asc");
  assert.equal(changes.find((change) => change.cellId === "r1c1").patch.value, "A");
  assert.equal(changes.find((change) => change.cellId === "r1c2").patch.formula, "=A1");
});

test("conditional sign formatting is range-scoped", () => {
  const sheet = createSheetObject({ id: "conditional" });
  sheet.conditionalFormats = [{ id: "rule", range: "B2:C4", kind: "sign" }];
  assert.equal(conditionalToneForCell(sheet, createCellRecord(1, 1, { value: "12" })), "positive");
  assert.equal(conditionalToneForCell(sheet, createCellRecord(2, 2, { value: "-3" })), "negative");
  assert.equal(conditionalToneForCell(sheet, createCellRecord(0, 0, { value: "12" })), null);
});
