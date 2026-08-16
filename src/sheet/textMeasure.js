import { cellAddress, columnLabel, coordinatesFromCellId } from "./coordinates.js";
import { formatCellValue } from "./formatting.js";
import { formatFormulaResult } from "./formulas.js";

let textMeasureContext = null;

export function measureTextWidth(text, fontSize = DEFAULT_CELL_FONT, bold = false) {
  const source = String(text ?? "");
  if (typeof document === "undefined") return source.length * fontSize * 0.58;
  if (!textMeasureContext) textMeasureContext = document.createElement("canvas").getContext("2d");
  const context = textMeasureContext;
  context.font = `${bold ? "700 " : "400 "}${fontSize}px "Public Sans Variable", "Segoe UI Variable", Arial, sans-serif`;
  return context.measureText(source).width;
}

export const DEFAULT_CELL_FONT = 11.5;
export const CELL_H_PADDING = 16; // 0 8px on the tile face
export const CELL_V_PADDING = 14; // vertical breathing above/below one line
export const CELL_LINE_HEIGHT = 1.18;

function cellTextWidth(text, fontSize = DEFAULT_CELL_FONT, bold = false) {
  return measureTextWidth(text, fontSize, bold) + CELL_H_PADDING;
}

function displayValueForCell(cell, row, column, formulaValues) {
  if (cell?.formula) return formatFormulaResult(formulaValues?.get(cellAddress(row, column)));
  if (cell?.embed) return cell.value || "";
  return formatCellValue(cell?.value, cell?.style);
}

export function wrappedLineCount(text, columnWidth, fontSize = DEFAULT_CELL_FONT, bold = false) {
  const segments = String(text ?? "").split("\n");
  const usableWidth = Math.max(40, (Number(columnWidth) || 40) - CELL_H_PADDING);
  let lines = 0;
  segments.forEach((segment) => {
    if (!segment) {
      lines += 1;
      return;
    }
    lines += Math.max(1, Math.ceil(measureTextWidth(segment, fontSize, bold) / usableWidth));
  });
  return Math.max(1, lines);
}

/**
 * The natural width of a column: the widest rendered cell content (including
 * formula results and per-cell font size) plus the tile face padding.
 */
export function naturalColumnWidth(object, column, formulaValues) {
  let max = 0;
  Object.entries(object.cells || {}).forEach(([id, cell]) => {
    const coordinates = coordinatesFromCellId(id);
    if (!coordinates || coordinates.column !== column) return;
    const fontSize = Number(cell?.style?.fontSize) || DEFAULT_CELL_FONT;
    const text = displayValueForCell(cell, coordinates.row, column, formulaValues);
    const width = cellTextWidth(text, fontSize, Boolean(cell?.style?.bold));
    if (width > max) max = width;
  });
  const headerWidth = measureTextWidth(columnLabel(column), 10);
  return Math.ceil(Math.max(max, headerWidth) + CELL_H_PADDING);
}

/**
 * The natural height of a single-line row: driven by the largest font size.
 */
export function naturalRowHeight(object, row) {
  let max = 0;
  Object.entries(object.cells || {}).forEach(([id, cell]) => {
    const coordinates = coordinatesFromCellId(id);
    if (!coordinates || coordinates.row !== row) return;
    const fontSize = Number(cell?.style?.fontSize) || DEFAULT_CELL_FONT;
    if (fontSize > max) max = fontSize;
  });
  return Math.ceil((max || DEFAULT_CELL_FONT) * CELL_LINE_HEIGHT + CELL_V_PADDING);
}

/**
 * The height a row needs to show wrapped or explicitly multi-line content.
 * Non-wrapped, single-line rows report null so the sheet keeps its compact
 * default/explicit height instead of inflating every row.
 */
export function autoRowHeight(object, row, columnWidthForIndex) {
  let maxLines = 1;
  Object.entries(object.cells || {}).forEach(([id, cell]) => {
    const coordinates = coordinatesFromCellId(id);
    if (!coordinates || coordinates.row !== row) return;
    const value = cell?.value ?? "";
    if (!cell?.style?.wrap && !String(value).includes("\n")) return;
    const fontSize = Number(cell?.style?.fontSize) || DEFAULT_CELL_FONT;
    const columnWidth = columnWidthForIndex?.(coordinates.column) || 0;
    const lines = wrappedLineCount(value, columnWidth, fontSize, Boolean(cell?.style?.bold));
    if (lines > maxLines) maxLines = lines;
  });
  if (maxLines <= 1) return null;
  return Math.ceil(maxLines * DEFAULT_CELL_FONT * CELL_LINE_HEIGHT + CELL_V_PADDING);
}

/**
 * Compute auto heights only for rows that contain wrapped or multi-line cells.
 * Returns a sparse map keyed by row index.
 */
export function autoRowHeights(object, columnWidthForIndex) {
  const heights = {};
  Object.entries(object.cells || {}).forEach(([id, cell]) => {
    if (!cell?.style?.wrap && !String(cell?.value ?? "").includes("\n")) return;
    const coordinates = coordinatesFromCellId(id);
    if (!coordinates) return;
    const fontSize = Number(cell?.style?.fontSize) || DEFAULT_CELL_FONT;
    const columnWidth = columnWidthForIndex?.(coordinates.column) || 0;
    const lines = wrappedLineCount(cell?.value, columnWidth, fontSize, Boolean(cell?.style?.bold));
    if (lines <= 1) return;
    const height = Math.ceil(lines * DEFAULT_CELL_FONT * CELL_LINE_HEIGHT + CELL_V_PADDING);
    if (height > (heights[coordinates.row] || 0)) heights[coordinates.row] = height;
  });
  return heights;
}
