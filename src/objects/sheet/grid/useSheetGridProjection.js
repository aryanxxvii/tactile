import { useEffect, useMemo, useState } from "react";
import { cellId } from "../../../sheet/coordinates.js";
import { fillRange } from "../../../sheet/ranges.js";
import { autoRowHeights } from "../../../sheet/textMeasure.js";
import {
  getSurfaceCellDrafts,
  subscribeSurfaceCellDrafts,
} from "../../../components/localEditSession.js";
import { boundedAxisEntries, canonicalSheetSelection } from "./selectionGeometry.js";
import { useFormulaProjection } from "./useFormulaProjection.js";
import { useVirtualSheet } from "../useVirtualSheet.js";

export function rangeValues(start, end) {
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
}

export function useSheetGridProjection({
  object,
  selectedAddress,
  selectionRange,
  fillTarget,
  sheetMetrics,
  resizePreview,
}) {
  const canonicalSelection = useMemo(
    () => canonicalSheetSelection({
      selectionRange,
      selectedAddress,
      rows: object.rows,
      columns: object.columns,
    }),
    [object.columns, object.rows, selectedAddress, selectionRange?.anchor, selectionRange?.focus],
  );
  const { selectedAddress: canonicalSelectedAddress, selectedCoordinates, range: normalizedSelection } = canonicalSelection;
  const isFullRowSelection = Boolean(normalizedSelection)
    && normalizedSelection.columnStart === 0
    && normalizedSelection.columnEnd === object.columns - 1
    && normalizedSelection.rowStart === normalizedSelection.rowEnd;
  const isFullColumnSelection = Boolean(normalizedSelection)
    && normalizedSelection.rowStart === 0
    && normalizedSelection.rowEnd === object.rows - 1
    && normalizedSelection.columnStart === normalizedSelection.columnEnd;
  const showActiveRowContext = isFullRowSelection;
  const showActiveColumnContext = isFullColumnSelection;
  const fillPreviewRange = useMemo(
    () => fillTarget
      ? fillRange(
        normalizedSelection,
        fillTarget,
      )
      : null,
    [fillTarget, normalizedSelection],
  );
  const formulaValues = useFormulaProjection(object);
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
  const effectiveSheetMetrics = useMemo(() => {
    if (!resizePreview?.axis || !resizePreview.sizes) return sheetMetrics;
    const next = { ...(sheetMetrics || {}) };
    if (resizePreview.axis === "row") {
      next.rowHeights = { ...(object.rowHeights || {}), ...resizePreview.sizes };
    } else {
      next.columnWidths = { ...(object.columnWidths || {}), ...resizePreview.sizes };
    }
    return next;
  }, [object.columnWidths, object.rowHeights, resizePreview, sheetMetrics]);
  const defaultColumnWidth = object.columnWidth || sheetMetrics?.columnWidth || 126;
  const columnWidthForIndex = useMemo(
    () => (column) => object.columnWidths?.[column] || defaultColumnWidth,
    [defaultColumnWidth, object.columnWidths],
  );
  // Grow rows live while a cell is edited inline (its value is held in the
  // surface draft store, not yet committed to the object). Without this a
  // Shift+Enter newline stays clipped until the edit commits.
  const [draftTick, setDraftTick] = useState(0);
  const [surfaceDrafts, setSurfaceDrafts] = useState(null);
  const liveAutoRowHeightsMap = useMemo(
    () => autoRowHeights(object, columnWidthForIndex, surfaceDrafts),
    [object, columnWidthForIndex, surfaceDrafts, draftTick],
  );
  const virtualSheet = useVirtualSheet(
    object.rows,
    object.columns,
    {
      ...(effectiveSheetMetrics || {}),
      rowHeight: object.rowHeight || effectiveSheetMetrics?.rowHeight,
      columnWidth: object.columnWidth || effectiveSheetMetrics?.columnWidth,
      // Explicit/manual row heights (including a live resize preview) must win
      // over content auto-height, so a drag-resize isn't fought back to the
      // measured wrap height. Auto-height only fills rows without an override.
      rowHeights: { ...liveAutoRowHeightsMap, ...(effectiveSheetMetrics?.rowHeights || object.rowHeights) },
      columnWidths: effectiveSheetMetrics?.columnWidths || object.columnWidths,
      viewStateKey: object.id,
    },
    visibleRowIndexMap,
    visibleColumnIndexMap,
    object.id,
  );
  const sheetScrollRef = virtualSheet.scrollRef;
  useEffect(() => {
    const surface = sheetScrollRef?.current?.closest?.(".object-surface");
    if (!surface) return undefined;
    setSurfaceDrafts(getSurfaceCellDrafts(surface));
    return subscribeSurfaceCellDrafts(surface, () => {
      setSurfaceDrafts(getSurfaceCellDrafts(surface));
      setDraftTick((tick) => tick + 1);
    });
  }, [sheetScrollRef]);
  const visibleRows = useMemo(
    () => boundedAxisEntries(
      virtualSheet.rowIndexMap,
      virtualSheet.range.rowStart,
      virtualSheet.range.rowEnd,
      object.rows,
    ).map(({ position, index: row }) => ({ position, row })),
    [object.rows, virtualSheet.range.rowEnd, virtualSheet.range.rowStart, virtualSheet.rowIndexMap],
  );
  const pinnedVisibleRows = useMemo(() => {
    const selectedPosition = virtualSheet.rowPositionForIndex(selectedCoordinates.row);
    const selectedRowIsInBounds = Number.isInteger(selectedCoordinates.row)
      && selectedCoordinates.row >= 0
      && selectedCoordinates.row < object.rows;
    if (!selectedRowIsInBounds
      || !Number.isInteger(selectedPosition)
      || visibleRows.some((entry) => entry.row === selectedCoordinates.row)) {
      return visibleRows;
    }
    return [...visibleRows, { position: selectedPosition, row: selectedCoordinates.row }]
      .sort((left, right) => left.position - right.position);
  }, [object.rows, selectedCoordinates.row, virtualSheet.rowPositionForIndex, visibleRows]);
  const visibleColumns = useMemo(
    () => boundedAxisEntries(
      virtualSheet.columnIndexMap,
      virtualSheet.range.columnStart,
      virtualSheet.range.columnEnd,
      object.columns,
    ).map(({ position, index: column }) => ({ position, column })),
    [object.columns, virtualSheet.columnIndexMap, virtualSheet.range.columnEnd, virtualSheet.range.columnStart],
  );
  const pinnedVisibleColumns = useMemo(() => {
    const selectedPosition = virtualSheet.columnPositionForIndex(selectedCoordinates.column);
    const selectedColumnIsInBounds = Number.isInteger(selectedCoordinates.column)
      && selectedCoordinates.column >= 0
      && selectedCoordinates.column < object.columns;
    if (!selectedColumnIsInBounds
      || !Number.isInteger(selectedPosition)
      || visibleColumns.some((entry) => entry.column === selectedCoordinates.column)) {
      return visibleColumns;
    }
    return [...visibleColumns, { position: selectedPosition, column: selectedCoordinates.column }]
      .sort((left, right) => left.position - right.position);
  }, [object.columns, selectedCoordinates.column, virtualSheet.columnPositionForIndex, visibleColumns]);

  return {
    selectedCoordinates,
    selectedAddress: canonicalSelectedAddress,
    normalizedSelection,
    showActiveRowContext,
    showActiveColumnContext,
    fillPreviewRange,
    formulaValues,
    rowGroups,
    columnGroups,
    filters,
    rowGroupByStart,
    columnGroupByStart,
    visibleRows: pinnedVisibleRows,
    visibleColumns: pinnedVisibleColumns,
    ...virtualSheet,
  };
}
