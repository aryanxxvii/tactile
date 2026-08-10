import {
  cellAddress,
  cellId,
  columnLabel,
  coordinatesFromAddress,
} from "./coordinates.js";

export function normalizeRange(anchorAddress, focusAddress = anchorAddress) {
  const anchor = coordinatesFromAddress(anchorAddress);
  const focus = coordinatesFromAddress(focusAddress);
  if (!anchor || !focus) return null;
  return {
    anchor: cellAddress(anchor.row, anchor.column),
    focus: cellAddress(focus.row, focus.column),
    rowStart: Math.min(anchor.row, focus.row),
    rowEnd: Math.max(anchor.row, focus.row),
    columnStart: Math.min(anchor.column, focus.column),
    columnEnd: Math.max(anchor.column, focus.column),
  };
}

export function rangeLabel(range) {
  const normalized = normalizeRange(range?.anchor, range?.focus);
  if (!normalized) return "A1";
  const start = cellAddress(normalized.rowStart, normalized.columnStart);
  const end = cellAddress(normalized.rowEnd, normalized.columnEnd);
  return start === end ? start : `${start}:${end}`;
}

export function rangeSize(range) {
  const normalized = normalizeRange(range?.anchor, range?.focus);
  if (!normalized) return 1;
  return (normalized.rowEnd - normalized.rowStart + 1)
    * (normalized.columnEnd - normalized.columnStart + 1);
}

export function rangeContains(range, row, column) {
  const normalized = normalizeRange(range?.anchor, range?.focus);
  return Boolean(
    normalized
    && row >= normalized.rowStart
    && row <= normalized.rowEnd
    && column >= normalized.columnStart
    && column <= normalized.columnEnd
  );
}

export function cellIdsInRange(range) {
  const normalized = normalizeRange(range?.anchor, range?.focus);
  if (!normalized) return [];
  const ids = [];
  for (let row = normalized.rowStart; row <= normalized.rowEnd; row += 1) {
    for (let column = normalized.columnStart; column <= normalized.columnEnd; column += 1) {
      ids.push(cellId(row, column));
    }
  }
  return ids;
}

function clipboardValue(cell) {
  return cell?.formula || cell?.value || "";
}

function fillSeriesValue(value, steps) {
  const source = String(value ?? "");
  if (!source || !Number.isFinite(Number(source))) {
    const match = /^(.*?)(-?\d+(?:\.\d+)?)$/.exec(source);
    if (!match) return source;
    const number = Number(match[2]);
    const next = number + steps;
    return `${match[1]}${Number.isInteger(number) ? Math.round(next) : next}`;
  }
  const number = Number(source);
  const next = number + steps;
  return Number.isInteger(number) ? String(Math.round(next)) : String(next);
}

export function serializeRange(sheet, range) {
  const normalized = normalizeRange(range?.anchor, range?.focus);
  if (!normalized) return "";
  const lines = [];
  for (let row = normalized.rowStart; row <= normalized.rowEnd; row += 1) {
    const values = [];
    for (let column = normalized.columnStart; column <= normalized.columnEnd; column += 1) {
      values.push(clipboardValue(sheet.cells?.[cellId(row, column)]));
    }
    lines.push(values.join("\t"));
  }
  return lines.join("\n");
}

export function parseClipboardGrid(text) {
  const normalized = String(text ?? "").replace(/\r\n?/g, "\n");
  const rows = normalized.split("\n");
  if (rows.length > 1 && rows[rows.length - 1] === "") rows.pop();
  return rows.map((row) => row.split("\t"));
}

export function pasteChanges(startAddress, text) {
  const start = coordinatesFromAddress(startAddress);
  if (!start) return { changes: [], endAddress: startAddress };
  const grid = parseClipboardGrid(text);
  const changes = [];
  grid.forEach((values, rowOffset) => {
    values.forEach((value, columnOffset) => {
      const row = start.row + rowOffset;
      const column = start.column + columnOffset;
      changes.push({
        cellId: cellId(row, column),
        patch: value.startsWith("=")
          ? { formula: value, value: "", embed: null }
          : { value, formula: "", embed: null },
      });
    });
  });
  const finalRow = start.row + Math.max(0, grid.length - 1);
  const finalColumn = start.column + Math.max(0, Math.max(0, ...grid.map((row) => row.length)) - 1);
  return {
    changes,
    endAddress: cellAddress(finalRow, finalColumn),
  };
}

export function shiftFormulaReferences(formula, rowDelta, columnDelta) {
  if (!String(formula || "").startsWith("=")) return formula;
  return formula.replace(/(\$?)([A-Za-z]+)(\$?)(\d+)/g, (match, columnLock, label, rowLock, rowText) => {
    const coordinates = coordinatesFromAddress(`${label}${rowText}`);
    if (!coordinates) return match;
    const column = columnLock ? coordinates.column : Math.max(0, coordinates.column + columnDelta);
    const row = rowLock ? coordinates.row : Math.max(0, coordinates.row + rowDelta);
    return `${columnLock}${columnLabel(column)}${rowLock}${row + 1}`;
  });
}

export function fillChanges(sheet, sourceAddress, targetAddress) {
  const source = coordinatesFromAddress(sourceAddress);
  const target = coordinatesFromAddress(targetAddress);
  if (!source || !target) return [];
  const sourceCell = sheet.cells?.[cellId(source.row, source.column)]
    || sheet.cells?.[`${source.row}:${source.column}`]
    || {};
  const range = normalizeRange(sourceAddress, targetAddress);
  const changes = [];
  for (let row = range.rowStart; row <= range.rowEnd; row += 1) {
    for (let column = range.columnStart; column <= range.columnEnd; column += 1) {
      if (row === source.row && column === source.column) continue;
      const formula = sourceCell.formula
        ? shiftFormulaReferences(sourceCell.formula, row - source.row, column - source.column)
        : "";
      const steps = Math.max(0, row - source.row) + Math.max(0, column - source.column);
      changes.push({
        cellId: cellId(row, column),
        patch: formula
          ? { formula, value: "", embed: null, style: sourceCell.style }
          : { value: fillSeriesValue(sourceCell.value || "", steps), formula: "", embed: null, style: sourceCell.style },
      });
    }
  }
  return changes;
}
