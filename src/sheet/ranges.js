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

// Clipboard payloads carry formatting in a separate sentinel-delimited block so
// plain value TSV (and cross-app spreadsheet copy/paste) stays byte-compatible.
const STYLE_SEPARATOR = "⁂TACTILE-STYLE⁂";

function styleToken(style) {
  if (!style) return "";
  const parts = [];
  if (style.bold) parts.push("bold=1");
  if (style.highlight) parts.push(`highlight=${style.highlight}`);
  if (style.textColor) parts.push(`textColor=${style.textColor}`);
  if (style.align) parts.push(`align=${style.align}`);
  if (style.verticalAlign) parts.push(`verticalAlign=${style.verticalAlign}`);
  if (Number.isFinite(style.fontSize)) parts.push(`fontSize=${style.fontSize}`);
  return parts.join(";");
}

function parseStyleToken(token) {
  if (!token) return null;
  const style = {};
  for (const pair of token.split(";")) {
    if (!pair) continue;
    const equalIndex = pair.indexOf("=");
    if (equalIndex === -1) continue;
    const key = pair.slice(0, equalIndex);
    const value = pair.slice(equalIndex + 1);
    if (key === "bold") style.bold = true;
    else if (key === "fontSize") {
      const size = Number(value);
      if (Number.isFinite(size)) style.fontSize = size;
    } else if (key === "highlight" || key === "textColor" || key === "align" || key === "verticalAlign") {
      if (value) style[key] = value;
    }
  }
  return Object.keys(style).length ? style : null;
}

function cellAt(sheet, row, column) {
  return sheet?.cells?.[cellId(row, column)]
    || sheet?.cells?.[`${row}:${column}`]
    || {};
}

function parseFillSeriesValue(value) {
  const source = String(value ?? "");
  const match = /^(.*?)(-?\d+(?:\.\d+)?)$/.exec(source);
  if (!match) return null;
  const number = Number(match[2]);
  if (!Number.isFinite(number)) return null;
  return { prefix: match[1], number };
}

function inferFillSeries(cells) {
  if (cells.some((cell) => cell?.formula)) return null;
  const values = cells.map((cell) => parseFillSeriesValue(cell?.value));
  if (values.some((value) => !value)) return null;
  const prefix = values[0].prefix;
  if (values.some((value) => value.prefix !== prefix)) return null;
  if (values.length === 1) return { prefix, first: values[0].number, step: 1 };
  const step = values[1].number - values[0].number;
  if (step === 0 || !values.slice(2).every((value, index) => (
    value.number - values[index + 1].number === step
  ))) return null;
  return { prefix, first: values[0].number, step };
}

function fillSeriesValueAt(series, index) {
  const number = series.first + (series.step * index);
  const formatted = Number.isInteger(series.first) && Number.isInteger(series.step)
    ? String(Math.round(number))
    : String(number);
  return `${series.prefix}${formatted}`;
}

function modulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

export function fillRange(sourceRange, targetAddress) {
  const source = normalizeRange(sourceRange?.anchor, sourceRange?.focus);
  const target = coordinatesFromAddress(targetAddress);
  if (!source || !target) return null;
  return {
    anchor: cellAddress(
      Math.min(source.rowStart, target.row),
      Math.min(source.columnStart, target.column),
    ),
    focus: cellAddress(
      Math.max(source.rowEnd, target.row),
      Math.max(source.columnEnd, target.column),
    ),
    rowStart: Math.min(source.rowStart, target.row),
    rowEnd: Math.max(source.rowEnd, target.row),
    columnStart: Math.min(source.columnStart, target.column),
    columnEnd: Math.max(source.columnEnd, target.column),
  };
}

export function serializeRange(sheet, range) {
  const normalized = normalizeRange(range?.anchor, range?.focus);
  if (!normalized) return "";
  const lines = [];
  let hasStyle = false;
  for (let row = normalized.rowStart; row <= normalized.rowEnd; row += 1) {
    const values = [];
    const styles = [];
    for (let column = normalized.columnStart; column <= normalized.columnEnd; column += 1) {
      const cell = sheet.cells?.[cellId(row, column)];
      values.push(clipboardValue(cell));
      const token = styleToken(cell?.style);
      if (token) hasStyle = true;
      styles.push(token);
    }
    lines.push(values.join("\t"));
    if (hasStyle) lines.push(styles.join("\t"));
  }
  // A trailing marker tells pasteChanges a style block exists even if every
  // style line was empty; without it a style-only block would be ambiguous.
  return hasStyle ? `${lines.join("\n")}${STYLE_SEPARATOR}` : lines.join("\n");
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
  const raw = String(text ?? "");
  const hasStyleBlock = raw.includes(STYLE_SEPARATOR);
  const body = hasStyleBlock ? raw.slice(0, raw.indexOf(STYLE_SEPARATOR)) : raw;
  const grid = parseClipboardGrid(body);
  // When a style block is present, value and style lines alternate row by row.
  const valueRows = hasStyleBlock ? grid.filter((_, index) => index % 2 === 0) : grid;
  const styleRows = hasStyleBlock ? grid.filter((_, index) => index % 2 === 1) : [];
  const width = Math.max(0, ...valueRows.map((row) => row.length));
  const changes = [];
  valueRows.forEach((values, rowOffset) => {
    const styleTokens = styleRows[rowOffset] || [];
    for (let columnOffset = 0; columnOffset < width; columnOffset += 1) {
      const value = values[columnOffset] ?? "";
      const row = start.row + rowOffset;
      const column = start.column + columnOffset;
      const style = parseStyleToken(styleTokens[columnOffset]);
      const basePatch = value.startsWith("=")
        ? { formula: value, value: "", embed: null }
        : { value, formula: "", embed: null };
      // Omit `style` entirely when the source had none, so spreading the patch in
      // commitCellChanges does not overwrite an existing destination style with
      // `undefined`.
      changes.push({
        cellId: cellId(row, column),
        patch: style ? { ...basePatch, style } : basePatch,
      });
    }
  });
  const finalRow = start.row + Math.max(0, valueRows.length - 1);
  const finalColumn = start.column + Math.max(0, width - 1);
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

export function fillChanges(sheet, sourceAddress, targetAddress, sourceRange = null) {
  const source = coordinatesFromAddress(sourceAddress);
  const target = coordinatesFromAddress(targetAddress);
  if (!source || !target) return [];
  const sourceBounds = normalizeRange(
    sourceRange?.anchor || sourceAddress,
    sourceRange?.focus || sourceAddress,
  );
  const range = fillRange(sourceBounds, targetAddress);
  if (!sourceBounds || !range) return [];
  const sourceHeight = sourceBounds.rowEnd - sourceBounds.rowStart + 1;
  const sourceWidth = sourceBounds.columnEnd - sourceBounds.columnStart + 1;
  const extendsVertical = target.row < sourceBounds.rowStart || target.row > sourceBounds.rowEnd;
  const extendsHorizontal = target.column < sourceBounds.columnStart || target.column > sourceBounds.columnEnd;
  const verticalDistance = target.row < sourceBounds.rowStart
    ? sourceBounds.rowStart - target.row
    : Math.max(0, target.row - sourceBounds.rowEnd);
  const horizontalDistance = target.column < sourceBounds.columnStart
    ? sourceBounds.columnStart - target.column
    : Math.max(0, target.column - sourceBounds.columnEnd);
  const fillAxis = extendsVertical && (!extendsHorizontal || verticalDistance >= horizontalDistance)
    ? "row"
    : "column";
  const verticalSeries = fillAxis === "row" && (sourceWidth === 1 || sourceHeight > 1)
    ? Array.from({ length: sourceWidth }, (_, columnOffset) => inferFillSeries(
      Array.from({ length: sourceHeight }, (_, rowOffset) => cellAt(
        sheet,
        sourceBounds.rowStart + rowOffset,
        sourceBounds.columnStart + columnOffset,
      )),
    ))
    : null;
  const horizontalSeries = fillAxis === "column" && (sourceHeight === 1 || sourceWidth > 1)
    ? Array.from({ length: sourceHeight }, (_, rowOffset) => inferFillSeries(
      Array.from({ length: sourceWidth }, (_, columnOffset) => cellAt(
        sheet,
        sourceBounds.rowStart + rowOffset,
        sourceBounds.columnStart + columnOffset,
      )),
    ))
    : null;
  const changes = [];
  for (let row = range.rowStart; row <= range.rowEnd; row += 1) {
    for (let column = range.columnStart; column <= range.columnEnd; column += 1) {
      if (
        row >= sourceBounds.rowStart
        && row <= sourceBounds.rowEnd
        && column >= sourceBounds.columnStart
        && column <= sourceBounds.columnEnd
      ) continue;
      const sourceRow = sourceBounds.rowStart + modulo(row - sourceBounds.rowStart, sourceHeight);
      const sourceColumn = sourceBounds.columnStart + modulo(column - sourceBounds.columnStart, sourceWidth);
      const sourceCell = cellAt(sheet, sourceRow, sourceColumn);
      const series = fillAxis === "row"
        ? verticalSeries?.[column - sourceBounds.columnStart]
        : horizontalSeries?.[row - sourceBounds.rowStart];
      const canUseSeries = Boolean(series)
        && ((fillAxis === "row" && column >= sourceBounds.columnStart && column <= sourceBounds.columnEnd)
          || (fillAxis === "column" && row >= sourceBounds.rowStart && row <= sourceBounds.rowEnd));
      const seriesIndex = fillAxis === "row"
        ? row - sourceBounds.rowStart
        : column - sourceBounds.columnStart;
      const formula = sourceCell.formula
        ? shiftFormulaReferences(sourceCell.formula, row - sourceRow, column - sourceColumn)
        : "";
      changes.push({
        cellId: cellId(row, column),
        patch: formula
          ? { formula, value: "", embed: null, style: sourceCell.style }
          : {
            value: canUseSeries
              ? fillSeriesValueAt(series, seriesIndex)
              : sourceCell.value ?? "",
            formula: "",
            embed: null,
            style: sourceCell.style,
          },
      });
    }
  }
  return changes;
}
