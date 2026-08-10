import { cellId } from "./coordinates.js";
import { normalizeRange, shiftFormulaReferences } from "./ranges.js";

const MOVABLE_FIELDS = ["value", "formula", "embed", "note", "style", "validation", "role"];

function sortableValue(cell) {
  const raw = cell?.formula || cell?.value || "";
  const numeric = Number(String(raw).replace(/,/g, "").trim());
  return Number.isFinite(numeric) && raw !== "" ? { kind: 0, value: numeric } : { kind: 1, value: String(raw).toLocaleLowerCase() };
}

function compareRows(a, b, direction) {
  if (a.sort.kind !== b.sort.kind) return (a.sort.kind - b.sort.kind) * direction;
  if (a.sort.value < b.sort.value) return -1 * direction;
  if (a.sort.value > b.sort.value) return 1 * direction;
  return a.sourceRow - b.sourceRow;
}

export function sortRangeChanges(sheet, range, keyColumn, direction = "asc") {
  const normalized = normalizeRange(range?.anchor, range?.focus);
  if (!normalized || normalized.rowStart === normalized.rowEnd) return [];
  const column = Math.max(normalized.columnStart, Math.min(normalized.columnEnd, keyColumn));
  const multiplier = direction === "desc" ? -1 : 1;
  const rows = [];
  for (let row = normalized.rowStart; row <= normalized.rowEnd; row += 1) {
    rows.push({
      sourceRow: row,
      sort: sortableValue(sheet.cells?.[cellId(row, column)]),
      cells: Array.from(
        { length: normalized.columnEnd - normalized.columnStart + 1 },
        (_, offset) => sheet.cells?.[cellId(row, normalized.columnStart + offset)] || null,
      ),
    });
  }
  rows.sort((a, b) => compareRows(a, b, multiplier));
  const changes = [];
  rows.forEach((rowRecord, destinationOffset) => {
    const destinationRow = normalized.rowStart + destinationOffset;
    rowRecord.cells.forEach((sourceCell, columnOffset) => {
      const destinationColumn = normalized.columnStart + columnOffset;
      const patch = {};
      MOVABLE_FIELDS.forEach((field) => { patch[field] = sourceCell?.[field]; });
      if (patch.formula) {
        patch.formula = shiftFormulaReferences(patch.formula, destinationRow - rowRecord.sourceRow, 0);
      }
      changes.push({ cellId: cellId(destinationRow, destinationColumn), patch });
    });
  });
  return changes;
}
