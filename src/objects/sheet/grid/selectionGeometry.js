import { cellAddress, coordinatesFromAddress } from "../../../sheet/coordinates.js";

function sheetAxisCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 1;
}

function clampAxis(value, count, fallback = 0) {
  const max = sheetAxisCount(count) - 1;
  const numeric = Number(value);
  const fallbackValue = Number.isFinite(Number(fallback)) ? Number(fallback) : 0;
  return Math.max(0, Math.min(max, Math.trunc(Number.isFinite(numeric) ? numeric : fallbackValue)));
}

export function selectionCoordinates(address, rows, columns, fallback = { row: 0, column: 0 }) {
  const parsed = coordinatesFromAddress(address) || fallback;
  return {
    row: clampAxis(parsed.row, rows, fallback.row),
    column: clampAxis(parsed.column, columns, fallback.column),
  };
}

export function canonicalSheetSelection({ selectionRange, selectedAddress, rows, columns }) {
  const selected = selectionCoordinates(selectedAddress, rows, columns);
  const anchor = selectionCoordinates(
    selectionRange?.anchor || selectedAddress,
    rows,
    columns,
    selected,
  );
  const focus = selectionCoordinates(
    selectionRange?.focus || selectedAddress,
    rows,
    columns,
    anchor,
  );
  const range = {
    anchor: cellAddress(anchor.row, anchor.column),
    focus: cellAddress(focus.row, focus.column),
    rowStart: Math.min(anchor.row, focus.row),
    rowEnd: Math.max(anchor.row, focus.row),
    columnStart: Math.min(anchor.column, focus.column),
    columnEnd: Math.max(anchor.column, focus.column),
  };
  const selectedIsInRange = selected.row >= range.rowStart
    && selected.row <= range.rowEnd
    && selected.column >= range.columnStart
    && selected.column <= range.columnEnd;
  const activeCoordinates = selectedIsInRange ? selected : focus;
  return {
    selectedAddress: cellAddress(activeCoordinates.row, activeCoordinates.column),
    selectedCoordinates: activeCoordinates,
    range,
  };
}

export function boundedAxisEntries(indexMap, start, end, count) {
  const entries = Array.isArray(indexMap) ? indexMap : [];
  const maxIndex = sheetAxisCount(count) - 1;
  const first = Math.max(0, Math.trunc(Number.isFinite(Number(start)) ? Number(start) : 0));
  const last = Math.min(
    entries.length - 1,
    Math.max(first, Math.trunc(Number.isFinite(Number(end)) ? Number(end) : first)),
  );
  if (last < first) return [];
  return Array.from({ length: last - first + 1 }, (_, offset) => {
    const position = first + offset;
    return { position, index: entries[position] };
  }).filter(({ index }) => Number.isInteger(index) && index >= 0 && index <= maxIndex);
}
