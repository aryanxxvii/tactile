import { useMemo } from "react";
import { evaluateSheetFormulas } from "../../../sheet/formulas.js";
import { cellId, coordinatesFromAddress } from "../../../sheet/coordinates.js";
import { normalizeRange } from "../../../sheet/ranges.js";
import { useVirtualSheet } from "../useVirtualSheet.js";

export function rangeValues(start, end) {
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
}

export function useSheetGridProjection({ object, selectedAddress, selectionRange, fillTarget, sheetMetrics }) {
  const selectedCoordinates = useMemo(
    () => coordinatesFromAddress(selectedAddress) || { row: 0, column: 0 },
    [selectedAddress],
  );
  const normalizedSelection = useMemo(
    () => normalizeRange(selectionRange?.anchor || selectedAddress, selectionRange?.focus || selectedAddress),
    [selectedAddress, selectionRange?.anchor, selectionRange?.focus],
  );
  const isFullRowSelection = Boolean(normalizedSelection)
    && normalizedSelection.columnStart === 0
    && normalizedSelection.columnEnd === object.columns - 1
    && normalizedSelection.rowStart === normalizedSelection.rowEnd;
  const isFullColumnSelection = Boolean(normalizedSelection)
    && normalizedSelection.rowStart === 0
    && normalizedSelection.rowEnd === object.rows - 1
    && normalizedSelection.columnStart === normalizedSelection.columnEnd;
  const showActiveAxisContext = isFullRowSelection || isFullColumnSelection;
  const fillPreviewRange = useMemo(
    () => fillTarget ? normalizeRange(selectedAddress, fillTarget) : null,
    [fillTarget, selectedAddress],
  );
  const formulaValues = useMemo(() => evaluateSheetFormulas(object), [object]);
  const rowGroups = Array.isArray(object.rowGroups) ? object.rowGroups : [];
  const columnGroups = Array.isArray(object.columnGroups) ? object.columnGroups : [];
  const filters = Array.isArray(object.filters) ? object.filters : [];
  const rowGroupByStart = useMemo(
    () => new Map(rowGroups.map((group) => [group.start, group])),
    [rowGroups],
  );
  const columnGroupByStart = useMemo(
    () => new Map(columnGroups.map((group) => [group.start, group])),
    [columnGroups],
  );
  const visibleRowIndexMap = useMemo(() => {
    const hidden = new Set();
    rowGroups.filter((group) => group.collapsed).forEach((group) => {
      for (let row = group.start + 1; row <= group.end; row += 1) hidden.add(row);
    });
    const groupStarts = new Set(rowGroups.map((group) => group.start));
    const rows = Array.from({ length: object.rows }, (_, row) => row).filter((row) => {
      if (hidden.has(row)) return false;
      if (!filters.length || groupStarts.has(row)) return true;
      return filters.every((filter) => {
        const cell = object.cells?.[cellId(row, filter.column)];
        const value = cell?.formula ? formulaValues.get(cell.address) : cell?.value;
        return String(value ?? "").trim().toLocaleLowerCase() === String(filter.value ?? "").trim().toLocaleLowerCase();
      });
    });
    return rows.length ? rows : [0];
  }, [filters, formulaValues, object.cells, object.rows, rowGroups]);
  const visibleColumnIndexMap = useMemo(() => {
    const hidden = new Set();
    columnGroups.filter((group) => group.collapsed).forEach((group) => {
      for (let column = group.start + 1; column <= group.end; column += 1) hidden.add(column);
    });
    const columns = Array.from({ length: object.columns }, (_, column) => column).filter((column) => !hidden.has(column));
    return columns.length ? columns : [0];
  }, [columnGroups, object.columns]);
  const virtualSheet = useVirtualSheet(
    object.rows,
    object.columns,
    {
      ...(sheetMetrics || {}),
      rowHeight: object.rowHeight || sheetMetrics?.rowHeight,
      columnWidth: object.columnWidth || sheetMetrics?.columnWidth,
      rowHeights: object.rowHeights,
      columnWidths: object.columnWidths,
    },
    visibleRowIndexMap,
    visibleColumnIndexMap,
  );
  const visibleRows = useMemo(
    () => rangeValues(virtualSheet.range.rowStart, virtualSheet.range.rowEnd).map((position) => ({
      position,
      row: virtualSheet.rowIndexMap[position],
    })).filter((entry) => Number.isInteger(entry.row)),
    [virtualSheet.range.rowEnd, virtualSheet.range.rowStart, virtualSheet.rowIndexMap],
  );
  const visibleColumns = useMemo(
    () => rangeValues(virtualSheet.range.columnStart, virtualSheet.range.columnEnd).map((position) => ({
      position,
      column: virtualSheet.columnIndexMap[position],
    })).filter((entry) => Number.isInteger(entry.column)),
    [virtualSheet.columnIndexMap, virtualSheet.range.columnEnd, virtualSheet.range.columnStart],
  );

  return {
    selectedCoordinates,
    normalizedSelection,
    showActiveAxisContext,
    fillPreviewRange,
    formulaValues,
    rowGroups,
    columnGroups,
    filters,
    rowGroupByStart,
    columnGroupByStart,
    visibleRows,
    visibleColumns,
    ...virtualSheet,
  };
}
