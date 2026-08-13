import { cellAddress, cellId } from "../../../sheet/coordinates.js";

export function numericRangeContains(range, row, column) {
  return Boolean(range)
    && row >= range.rowStart
    && row <= range.rowEnd
    && column >= range.columnStart
    && column <= range.columnEnd;
}

/**
 * Build the small context payload only when a user opens a cell menu. Empty
 * visible cells never receive a materialized CellRecord.
 */
export function cellContextFor(sheet, row, column) {
  const id = cellId(row, column);
  return sheet?.cells?.[id] || {
    id,
    address: cellAddress(row, column),
    row,
    column,
    value: "",
    formula: "",
    embed: null,
  };
}
