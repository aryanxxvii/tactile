import {
  cellIdsInRange as cellIdsInRangeRuntime,
  fillChanges as fillChangesRuntime,
  normalizeRange as normalizeRangeRuntime,
  parseClipboardGrid as parseClipboardGridRuntime,
  pasteChanges as pasteChangesRuntime,
  rangeContains as rangeContainsRuntime,
  rangeLabel as rangeLabelRuntime,
  rangeSize as rangeSizeRuntime,
  serializeRange as serializeRangeRuntime,
  shiftFormulaReferences as shiftFormulaReferencesRuntime,
} from "../sheet/ranges.js";
import type { CellChange, CellRange, NormalizedCellRange, SheetObject } from "./domain.ts";
import type { CellAddress, CellId, ColumnIndex, RowIndex } from "./ids.ts";
import { asCellAddress, asCellId, asColumnIndex, asRowIndex } from "./ids.ts";

function normalizeResult(value: ReturnType<typeof normalizeRangeRuntime>): NormalizedCellRange | null {
  if (!value) return null;
  return {
    anchor: asCellAddress(value.anchor),
    focus: asCellAddress(value.focus),
    rowStart: asRowIndex(value.rowStart),
    rowEnd: asRowIndex(value.rowEnd),
    columnStart: asColumnIndex(value.columnStart),
    columnEnd: asColumnIndex(value.columnEnd),
  };
}

export function normalizeRange(
  anchorAddress: CellAddress | string,
  focusAddress: CellAddress | string = anchorAddress,
): NormalizedCellRange | null {
  return normalizeResult(normalizeRangeRuntime(String(anchorAddress), String(focusAddress)));
}

export function rangeLabel(range: CellRange | null | undefined): string {
  return rangeLabelRuntime(range);
}

export function rangeSize(range: CellRange | null | undefined): number {
  return rangeSizeRuntime(range);
}

export function rangeContains(
  range: CellRange | null | undefined,
  row: RowIndex | number,
  column: ColumnIndex | number,
): boolean {
  return rangeContainsRuntime(range, Number(row), Number(column));
}

export function cellIdsInRange(range: CellRange | null | undefined): CellId[] {
  return cellIdsInRangeRuntime(range).map((id: string) => asCellId(id));
}

export function serializeRange(sheet: SheetObject, range: CellRange | null | undefined): string {
  return serializeRangeRuntime(sheet, range);
}

export function parseClipboardGrid(text: string): string[][] {
  return parseClipboardGridRuntime(text);
}

export function pasteChanges(
  startAddress: CellAddress | string,
  text: string,
): { changes: CellChange[]; endAddress: CellAddress | string } {
  const result = pasteChangesRuntime(String(startAddress), text);
  return {
    changes: result.changes as CellChange[],
    endAddress: result.endAddress ? asCellAddress(result.endAddress) : result.endAddress,
  };
}

export function shiftFormulaReferences(formula: string, rowDelta: number, columnDelta: number): string {
  return shiftFormulaReferencesRuntime(formula, rowDelta, columnDelta);
}

export function fillChanges(
  sheet: SheetObject,
  sourceAddress: CellAddress | string,
  targetAddress: CellAddress | string,
): CellChange[] {
  return fillChangesRuntime(sheet, String(sourceAddress), String(targetAddress)) as CellChange[];
}
