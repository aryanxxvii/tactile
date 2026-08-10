import assert from "node:assert/strict";
import test from "node:test";
import { createCellRecord, createSheetObject } from "../src/model.js";
import { evaluateCell, formatFormulaResult } from "../src/sheet/formulas.js";

function formulaSheet() {
  const sheet = createSheetObject({ id: "sheet", title: "Formula test" });
  sheet.cells.r1c1 = createCellRecord(0, 0, { value: "10" });
  sheet.cells.r2c1 = createCellRecord(1, 0, { value: "20" });
  sheet.cells.r3c1 = createCellRecord(2, 0, { formula: "=SUM(A1:A2)" });
  sheet.cells.r1c2 = createCellRecord(0, 1, { formula: "=A3/2+5" });
  sheet.cells.r2c2 = createCellRecord(1, 1, { formula: "=IF(B1>=20,\"yes\",\"no\")" });
  return sheet;
}

test("formula engine evaluates references, ranges, arithmetic and IF", () => {
  const sheet = formulaSheet();
  assert.equal(evaluateCell(sheet, "A3"), 30);
  assert.equal(evaluateCell(sheet, "B1"), 20);
  assert.equal(evaluateCell(sheet, "B2"), "yes");
});

test("formula engine reports circular references", () => {
  const sheet = createSheetObject({ id: "cycle" });
  sheet.cells.r1c1 = createCellRecord(0, 0, { formula: "=B1" });
  sheet.cells.r1c2 = createCellRecord(0, 1, { formula: "=A1" });
  assert.equal(evaluateCell(sheet, "A1"), "#CYCLE!");
});

test("formula results are compactly formatted", () => {
  assert.equal(formatFormulaResult(1234.5), "1,234.5");
});

test("formula engine supports conditional aggregates and weighted totals", () => {
  const sheet = createSheetObject({ id: "aggregates" });
  sheet.cells.r1c1 = createCellRecord(0, 0, { value: "10" });
  sheet.cells.r2c1 = createCellRecord(1, 0, { value: "20" });
  sheet.cells.r3c1 = createCellRecord(2, 0, { value: "30" });
  sheet.cells.r1c2 = createCellRecord(0, 1, { value: "2" });
  sheet.cells.r2c2 = createCellRecord(1, 1, { value: "3" });
  sheet.cells.r3c2 = createCellRecord(2, 1, { value: "4" });
  sheet.cells.r1c3 = createCellRecord(0, 2, { formula: '=COUNTIF(A1:A3,">10")' });
  sheet.cells.r2c3 = createCellRecord(1, 2, { formula: '=SUMIF(A1:A3,">10",B1:B3)' });
  sheet.cells.r3c3 = createCellRecord(2, 2, { formula: "=SUMPRODUCT(A1:A3,B1:B3)" });

  assert.equal(evaluateCell(sheet, "C1"), 2);
  assert.equal(evaluateCell(sheet, "C2"), 7);
  assert.equal(evaluateCell(sheet, "C3"), 200);
});

test("formula engine supports lookups and error fallbacks", () => {
  const sheet = createSheetObject({ id: "lookups" });
  sheet.cells.r1c1 = createCellRecord(0, 0, { value: "Alpha" });
  sheet.cells.r2c1 = createCellRecord(1, 0, { value: "Beta" });
  sheet.cells.r1c2 = createCellRecord(0, 1, { value: "14" });
  sheet.cells.r2c2 = createCellRecord(1, 1, { value: "28" });
  sheet.cells.r1c3 = createCellRecord(0, 2, { formula: '=INDEX(A1:B2,2,2)' });
  sheet.cells.r2c3 = createCellRecord(1, 2, { formula: '=MATCH("Beta",A1:A2,0)' });
  sheet.cells.r3c3 = createCellRecord(2, 2, { formula: '=VLOOKUP("Alpha",A1:B2,2)' });
  sheet.cells.r4c3 = createCellRecord(3, 2, { formula: '=IFERROR(1/0,"—")' });

  assert.equal(evaluateCell(sheet, "C1"), "28");
  assert.equal(evaluateCell(sheet, "C2"), 2);
  assert.equal(evaluateCell(sheet, "C3"), "14");
  assert.equal(evaluateCell(sheet, "C4"), "—");
});

test("formula engine supports compact text helpers", () => {
  const sheet = createSheetObject({ id: "text" });
  sheet.cells.r1c1 = createCellRecord(0, 0, { value: "Tactile" });
  sheet.cells.r1c2 = createCellRecord(0, 1, { formula: '=CONCAT(LEFT(A1,3),"-",RIGHT(A1,4))' });
  sheet.cells.r2c2 = createCellRecord(1, 1, { formula: "=LEN(A1)" });

  assert.equal(evaluateCell(sheet, "B1"), "Tac-tile");
  assert.equal(evaluateCell(sheet, "B2"), 7);
});
