import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { createCellRecord, createId } from "../../model.js";
import { evaluateSheetFormulas, formatFormulaResult } from "../../sheet/formulas.js";
import { formatCellValue } from "../../sheet/formatting.js";
import { conditionalToneForCell } from "../../sheet/conditionalFormatting.js";
import { sortRangeChanges } from "../../sheet/sort.js";
import {
  cellAddress,
  cellId,
  columnLabel,
  coordinatesFromAddress,
} from "../../sheet/coordinates.js";
import {
  cellIdsInRange,
  fillChanges,
  normalizeRange,
  pasteChanges,
  rangeContains,
  serializeRange,
} from "../../sheet/ranges.js";
import { CellContextMenu } from "./CellContextMenu.jsx";
import { SheetCell } from "./SheetCell.jsx";
import { useVirtualSheet } from "./useVirtualSheet.js";

function rangeValues(start, end) {
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
}

export function SheetGrid({
  object,
  selectedAddress,
  selectionRange,
  onSelect,
  onSelectRange,
  onCellChange,
  onCellsChange,
  onUpdateObject,
  onOpenObject,
  onCreateEmbedded,
  onInsertAxis,
  onDeleteAxis,
  onMoveAxis,
  sheetMetrics,
  onCreateFile,
}) {
  const [editingCellId, setEditingCellId] = useState(null);
  const [menu, setMenu] = useState(null);
  const [fillTarget, setFillTarget] = useState(null);
  const fileInputRef = useRef(null);
  const pendingFileCellRef = useRef(null);
  const selectionDragRef = useRef(null);
  const fillDragRef = useRef(null);
  const fillTargetRef = useRef(null);
  const resizeRef = useRef(null);
  const axisDragRef = useRef(null);
  const selectionScrollRef = useRef(null);
  const selectedCoordinates = useMemo(
    () => coordinatesFromAddress(selectedAddress) || { row: 0, column: 0 },
    [selectedAddress],
  );
  const normalizedSelection = useMemo(
    () => normalizeRange(selectionRange?.anchor || selectedAddress, selectionRange?.focus || selectedAddress),
    [selectedAddress, selectionRange?.anchor, selectionRange?.focus],
  );
  // A range already has its own visual treatment. The active row/column
  // context is useful for a single cell (and for explicit axis selections),
  // but becomes a distracting crosshair as soon as several cells are selected.
  const selectionHasMultipleCells = Boolean(normalizedSelection)
    && (normalizedSelection.rowStart !== normalizedSelection.rowEnd
      || normalizedSelection.columnStart !== normalizedSelection.columnEnd);
  const isFullRowSelection = Boolean(normalizedSelection)
    && normalizedSelection.columnStart === 0
    && normalizedSelection.columnEnd === object.columns - 1
    && normalizedSelection.rowStart === normalizedSelection.rowEnd;
  const isFullColumnSelection = Boolean(normalizedSelection)
    && normalizedSelection.rowStart === 0
    && normalizedSelection.rowEnd === object.rows - 1
    && normalizedSelection.columnStart === normalizedSelection.columnEnd;
  const showActiveAxisContext = !selectionHasMultipleCells || isFullRowSelection || isFullColumnSelection;
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
  const {
    scrollRef,
    range,
    canvasSize,
    metrics,
    onScroll,
    rowIndexMap,
    rowPositionForIndex,
    rowOffsetForPosition,
    rowSizeForPosition,
    rowSizeForIndex,
    columnIndexMap,
    columnPositionForIndex,
    columnOffsetForPosition,
    columnSizeForPosition,
    columnSizeForIndex,
  } = useVirtualSheet(
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
    () => rangeValues(range.rowStart, range.rowEnd).map((position) => ({
      position,
      row: rowIndexMap[position],
    })).filter((entry) => Number.isInteger(entry.row)),
    [range.rowEnd, range.rowStart, rowIndexMap],
  );
  const visibleColumns = useMemo(
    () => rangeValues(range.columnStart, range.columnEnd).map((position) => ({
      position,
      column: columnIndexMap[position],
    })).filter((entry) => Number.isInteger(entry.column)),
    [columnIndexMap, range.columnEnd, range.columnStart],
  );

  useEffect(() => {
    if (Number.isInteger(rowPositionForIndex(selectedCoordinates.row))) return;
    const firstVisibleRow = rowIndexMap[0];
    if (Number.isInteger(firstVisibleRow)) {
      onSelect(cellAddress(firstVisibleRow, selectedCoordinates.column));
    }
  }, [onSelect, rowIndexMap, rowPositionForIndex, selectedCoordinates.column, selectedCoordinates.row]);

  useEffect(() => {
    if (Number.isInteger(columnPositionForIndex(selectedCoordinates.column))) return;
    const firstVisibleColumn = columnIndexMap[0];
    if (Number.isInteger(firstVisibleColumn)) {
      onSelect(cellAddress(selectedCoordinates.row, firstVisibleColumn));
    }
  }, [columnIndexMap, columnPositionForIndex, onSelect, selectedCoordinates.column, selectedCoordinates.row]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const activeElement = document.activeElement;
    const restoreGridFocus = !editingCellId
      && activeElement instanceof Element
      && Boolean(activeElement.closest(".sheet-grid-shell"));
    const { rowHeaderWidth, columnHeaderHeight } = metrics;
    const selectedColumnPosition = columnPositionForIndex(selectedCoordinates.column);
    if (!Number.isInteger(selectedColumnPosition)) return;
    const left = rowHeaderWidth + columnOffsetForPosition(selectedColumnPosition);
    const right = left + columnSizeForPosition(selectedColumnPosition);
    const selectedRowPosition = rowPositionForIndex(selectedCoordinates.row);
    if (!Number.isInteger(selectedRowPosition)) return;
    const top = columnHeaderHeight + rowOffsetForPosition(selectedRowPosition);
    const bottom = top + rowSizeForPosition(selectedRowPosition);
    let nextLeft = scroller.scrollLeft;
    let nextTop = scroller.scrollTop;
    if (left < scroller.scrollLeft + rowHeaderWidth) nextLeft = Math.max(0, left - rowHeaderWidth);
    else if (right > scroller.scrollLeft + scroller.clientWidth) nextLeft = right - scroller.clientWidth;
    if (top < scroller.scrollTop + columnHeaderHeight) nextTop = Math.max(0, top - columnHeaderHeight);
    else if (bottom > scroller.scrollTop + scroller.clientHeight) nextTop = bottom - scroller.clientHeight;
    if (nextLeft !== scroller.scrollLeft || nextTop !== scroller.scrollTop) {
      scroller.scrollTo({ left: nextLeft, top: nextTop, behavior: "auto" });
    }
    if (restoreGridFocus) {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        const nextCell = document.querySelector(
          `[data-object-id="${object.id}"][data-cell-address="${selectedAddress}"]`,
        );
        nextCell?.focus({ preventScroll: true });
      }));
    }
  }, [columnOffsetForPosition, columnPositionForIndex, columnSizeForPosition, editingCellId, metrics, object.id, rowOffsetForPosition, rowPositionForIndex, rowSizeForPosition, scrollRef, selectedAddress, selectedCoordinates.column, selectedCoordinates.row]);

  useEffect(() => {
    const finishPointerGesture = () => {
      selectionDragRef.current = null;
      const fill = fillDragRef.current;
      const target = fillTargetRef.current;
      fillDragRef.current = null;
      fillTargetRef.current = null;
      setFillTarget(null);
      if (!fill || !target || target === fill.sourceAddress) return;
      const changes = fillChanges(object, fill.sourceAddress, target);
      onCellsChange?.(changes, "fill");
      onSelectRange?.(fill.sourceAddress, target);
    };
    window.addEventListener("pointerup", finishPointerGesture);
    window.addEventListener("pointercancel", finishPointerGesture);
    return () => {
      window.removeEventListener("pointerup", finishPointerGesture);
      window.removeEventListener("pointercancel", finishPointerGesture);
    };
  }, [object, onCellsChange, onSelectRange]);

  useEffect(() => {
    const moveResize = (event) => {
      const active = resizeRef.current;
      if (!active) return;
      const delta = active.axis === "column"
        ? event.clientX - active.start
        : event.clientY - active.start;
      const minimum = active.axis === "column" ? 56 : 24;
      const maximum = active.axis === "column" ? 420 : 96;
      const nextSizes = { ...active.baseMap };
      active.targets.forEach((target) => {
        nextSizes[target] = Math.max(minimum, Math.min(maximum, active.values[target] + delta));
      });
      onUpdateObject?.(active.axis === "column"
        ? { columnWidths: nextSizes }
        : { rowHeights: nextSizes });
    };
    const endResize = () => { resizeRef.current = null; };
    window.addEventListener("pointermove", moveResize);
    window.addEventListener("pointerup", endResize);
    window.addEventListener("pointercancel", endResize);
    return () => {
      window.removeEventListener("pointermove", moveResize);
      window.removeEventListener("pointerup", endResize);
      window.removeEventListener("pointercancel", endResize);
    };
  }, [onUpdateObject]);

  const openContextMenu = useCallback((event, cell) => {
    setMenu({
      x: event.clientX,
      y: event.clientY,
      cell,
      sourceElement: event.currentTarget,
    });
  }, []);

  const copyCell = useCallback(async () => {
    if (!menu) return;
    const activeRange = rangeContains(normalizedSelection, menu.cell.row, menu.cell.column)
      ? normalizedSelection
      : { anchor: menu.cell.address, focus: menu.cell.address };
    await navigator.clipboard?.writeText(serializeRange(object, activeRange));
  }, [menu, normalizedSelection, object]);

  const pasteCell = useCallback(async () => {
    if (!menu || !navigator.clipboard?.readText) return;
    const text = await navigator.clipboard.readText();
    const pasted = pasteChanges(menu.cell.address, text);
    onCellsChange?.(pasted.changes, "paste");
    onSelectRange?.(menu.cell.address, pasted.endAddress);
  }, [menu, onCellsChange, onSelectRange]);

  const startSelection = useCallback((event, cell) => {
    if (event.button !== 0 || editingCellId) return;
    event.currentTarget.focus({ preventScroll: true });
    const anchor = event.shiftKey
      ? (selectionRange?.anchor || selectedAddress)
      : cell.address;
    if (event.shiftKey) onSelectRange?.(anchor, cell.address);
    else onSelect(cell.address);
    if (!cell.embed) selectionDragRef.current = { anchor, focus: cell.address };
  }, [editingCellId, onSelect, onSelectRange, selectedAddress, selectionRange?.anchor]);

  const moveSelectionGesture = useCallback((cell) => {
    if (fillDragRef.current) {
      fillTargetRef.current = cell.address;
      setFillTarget(cell.address);
      return;
    }
    const drag = selectionDragRef.current;
    if (!drag || drag.focus === cell.address) return;
    drag.focus = cell.address;
    onSelectRange?.(drag.anchor, cell.address);
  }, [onSelectRange]);

  const startFill = useCallback((event, cell) => {
    event.preventDefault();
    event.stopPropagation();
    fillDragRef.current = { sourceAddress: cell.address };
    fillTargetRef.current = cell.address;
    setFillTarget(cell.address);
  }, []);

  const axisResizeTargets = useCallback((axis, index) => {
    if (!normalizedSelection) return [index];
    const wholeColumns = axis === "column"
      && normalizedSelection.rowStart === 0
      && normalizedSelection.rowEnd === object.rows - 1
      && index >= normalizedSelection.columnStart
      && index <= normalizedSelection.columnEnd;
    const wholeRows = axis === "row"
      && normalizedSelection.columnStart === 0
      && normalizedSelection.columnEnd === object.columns - 1
      && index >= normalizedSelection.rowStart
      && index <= normalizedSelection.rowEnd;
    if (wholeColumns) return rangeValues(normalizedSelection.columnStart, normalizedSelection.columnEnd);
    if (wholeRows) return rangeValues(normalizedSelection.rowStart, normalizedSelection.rowEnd);
    return [index];
  }, [normalizedSelection, object.columns, object.rows]);

  const startResize = useCallback((event, axis, index) => {
    event.preventDefault();
    event.stopPropagation();
    const targets = axisResizeTargets(axis, index);
    const values = Object.fromEntries(targets.map((target) => [
      target,
      axis === "column" ? columnSizeForIndex(target) : rowSizeForIndex(target),
    ]));
    resizeRef.current = {
      axis,
      start: axis === "column" ? event.clientX : event.clientY,
      targets,
      values,
      baseMap: { ...(axis === "column" ? object.columnWidths : object.rowHeights) },
    };
  }, [axisResizeTargets, columnSizeForIndex, object.columnWidths, object.rowHeights, rowSizeForIndex]);

  const resizeAxisWithKeyboard = useCallback((axis, index, delta) => {
    const targets = axisResizeTargets(axis, index);
    const minimum = axis === "column" ? 56 : 24;
    const maximum = axis === "column" ? 420 : 96;
    const nextSizes = { ...(axis === "column" ? object.columnWidths : object.rowHeights) };
    targets.forEach((target) => {
      const current = axis === "column" ? columnSizeForIndex(target) : rowSizeForIndex(target);
      nextSizes[target] = Math.max(minimum, Math.min(maximum, current + delta));
    });
    onUpdateObject?.(axis === "column" ? { columnWidths: nextSizes } : { rowHeights: nextSizes });
  }, [axisResizeTargets, columnSizeForIndex, object.columnWidths, object.rowHeights, onUpdateObject, rowSizeForIndex]);

  const startAxisDrag = useCallback((event, axis, index) => {
    if (event.button !== 0 || event.target.closest(".column-resize-handle, .row-resize-handle, .column-group-toggle, .row-group-toggle")) return;
    event.preventDefault();
    const scroller = scrollRef.current;
    if (scroller) selectionScrollRef.current = { left: scroller.scrollLeft, top: scroller.scrollTop };
    axisDragRef.current = { axis, index, startX: event.clientX, startY: event.clientY, moved: false };
  }, [scrollRef]);

  const restoreSelectionScroll = useCallback(() => {
    const saved = selectionScrollRef.current;
    selectionScrollRef.current = null;
    if (!saved) return;
    window.requestAnimationFrame(() => {
      const scroller = scrollRef.current;
      if (!scroller) return;
      scroller.scrollTo({ left: saved.left, top: saved.top, behavior: "auto" });
      scroller.style.setProperty("--sheet-scroll-x", `${saved.left}px`);
      scroller.style.setProperty("--sheet-scroll-y", `${saved.top}px`);
    });
  }, [scrollRef]);

  useEffect(() => {
    const moveAxis = (event) => {
      const active = axisDragRef.current;
      if (!active) return;
      const delta = active.axis === "column" ? event.clientX - active.startX : event.clientY - active.startY;
      if (Math.abs(delta) < 8) return;
      active.moved = true;
      const target = document.elementsFromPoint(event.clientX, event.clientY)
        .find((element) => element.classList?.contains(active.axis === "column" ? "column-header" : "row-header"));
      const targetIndex = Number(target?.dataset.axisIndex);
      if (Number.isInteger(targetIndex) && targetIndex !== active.index) {
        onMoveAxis?.(active.axis, active.index, targetIndex);
        active.index = targetIndex;
        active.startX = event.clientX;
        active.startY = event.clientY;
      }
    };
    const endAxisDrag = () => { axisDragRef.current = null; };
    window.addEventListener("pointermove", moveAxis);
    window.addEventListener("pointerup", endAxisDrag);
    window.addEventListener("pointercancel", endAxisDrag);
    return () => {
      window.removeEventListener("pointermove", moveAxis);
      window.removeEventListener("pointerup", endAxisDrag);
      window.removeEventListener("pointercancel", endAxisDrag);
    };
  }, [onMoveAxis]);

  const toggleRowGroup = useCallback((groupId) => {
    const target = rowGroups.find((group) => group.id === groupId);
    if (target && !target.collapsed && selectedCoordinates.row > target.start && selectedCoordinates.row <= target.end) {
      onSelect(cellAddress(target.start, selectedCoordinates.column));
    }
    onUpdateObject?.({
      rowGroups: rowGroups.map((group) => (
        group.id === groupId ? { ...group, collapsed: !group.collapsed } : group
      )),
    });
  }, [onSelect, onUpdateObject, rowGroups, selectedCoordinates.column, selectedCoordinates.row]);

  const toggleColumnGroup = useCallback((groupId) => {
    const target = columnGroups.find((group) => group.id === groupId);
    if (target && !target.collapsed && selectedCoordinates.column > target.start && selectedCoordinates.column <= target.end) {
      onSelect(cellAddress(selectedCoordinates.row, target.start));
    }
    onUpdateObject?.({
      columnGroups: columnGroups.map((group) => (
        group.id === groupId ? { ...group, collapsed: !group.collapsed } : group
      )),
    });
  }, [columnGroups, onSelect, onUpdateObject, selectedCoordinates.column, selectedCoordinates.row]);

  const { rowHeaderWidth, columnHeaderHeight } = metrics;

  return (
    <div className="sheet-grid-shell">
      <input
        ref={fileInputRef}
        className="native-file-input"
        type="file"
        accept=".pdf,.md,.markdown,.html,.htm,.svg,image/*,video/*,application/pdf,text/html,text/markdown"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file && pendingFileCellRef.current) {
            const pending = pendingFileCellRef.current;
            pendingFileCellRef.current = null;
            onCreateFile?.(pending.cell, file, pending.sourceElement);
          }
        }}
      />
      <div className="sheet-scroll" data-sheet-scroll ref={scrollRef} onScroll={onScroll}>
        <div
          className="virtual-sheet-canvas"
          role="grid"
          aria-label={`${object.title} Tiles`}
          aria-rowcount={object.rows}
          aria-colcount={object.columns}
          style={{ width: canvasSize.width, height: canvasSize.height }}
        >
          <div
            className="sheet-corner virtual-sheet-header"
            role="button"
            tabIndex={0}
            aria-label="Select entire sheet"
            onPointerDown={(event) => {
              event.preventDefault();
              const scroller = scrollRef.current;
              if (scroller) selectionScrollRef.current = { left: scroller.scrollLeft, top: scroller.scrollTop };
            }}
            onClick={() => {
              onSelectRange?.("A1", cellAddress(object.rows - 1, object.columns - 1), selectedAddress);
              restoreSelectionScroll();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectRange?.("A1", cellAddress(object.rows - 1, object.columns - 1), selectedAddress);
              }
            }}
            style={{
              left: 0,
              top: 0,
              width: rowHeaderWidth,
              height: columnHeaderHeight,
              transform: "translate3d(var(--sheet-scroll-x, 0px), var(--sheet-scroll-y, 0px), 0)",
            }}
          />

          {visibleColumns.map(({ column, position }) => {
            const columnGroup = columnGroupByStart.get(column);
            return (
            <div
              className={`column-header virtual-sheet-header ${columnGroup ? "has-group" : ""} ${showActiveAxisContext && selectedCoordinates.column === column ? "is-active" : ""}`}
              role="columnheader"
              tabIndex={0}
              aria-colindex={column + 1}
              aria-label={`Select column ${columnLabel(column)}`}
              data-axis-index={column}
              onPointerDown={(event) => startAxisDrag(event, "column", column)}
              onContextMenu={(event) => {
                event.preventDefault();
                openContextMenu(event, object.cells?.[cellId(0, column)] || createCellRecord(0, column));
              }}
              key={`column-${column}`}
              onClick={() => {
                onSelectRange?.(cellAddress(0, column), cellAddress(object.rows - 1, column), cellAddress(selectedCoordinates.row, column));
                restoreSelectionScroll();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectRange?.(cellAddress(0, column), cellAddress(object.rows - 1, column), cellAddress(selectedCoordinates.row, column));
                }
              }}
              style={{
                left: rowHeaderWidth + columnOffsetForPosition(position),
                top: 0,
                width: columnSizeForPosition(position),
                height: columnHeaderHeight,
                transform: "translate3d(0, var(--sheet-scroll-y, 0px), 0)",
              }}
            >
              <span>{columnLabel(column)}</span>
              <span className="column-resize-handle" role="separator" tabIndex={0} aria-label={`Resize column ${columnLabel(column)}`} onPointerDown={(event) => startResize(event, "column", column)} onKeyDown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  const delta = event.key === "ArrowLeft" ? -8 : 8;
                  resizeAxisWithKeyboard("column", column, delta);
                }
              }} />
              {columnGroup ? (
                <button
                  className="column-group-toggle"
                  type="button"
                  aria-label={`${columnGroup.collapsed ? "Expand" : "Collapse"} columns ${columnLabel(columnGroup.start)} to ${columnLabel(columnGroup.end)}`}
                  aria-expanded={!columnGroup.collapsed}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleColumnGroup(columnGroup.id);
                  }}
                >
                  {columnGroup.collapsed
                    ? <IconChevronRight size={10} stroke={1.8} />
                    : <IconChevronDown size={10} stroke={1.8} />}
                </button>
              ) : null}
            </div>
            );
          })}

          {visibleRows.map(({ row, position }) => {
            const rowGroup = rowGroupByStart.get(row);
            return (
            <div
              className={`row-header virtual-sheet-header ${rowGroup ? "has-group" : ""} ${showActiveAxisContext && selectedCoordinates.row === row ? "is-active" : ""}`}
              role="rowheader"
              tabIndex={0}
              aria-rowindex={row + 1}
              aria-label={`Select row ${row + 1}`}
              data-axis-index={row}
              onPointerDown={(event) => startAxisDrag(event, "row", row)}
              onContextMenu={(event) => {
                event.preventDefault();
                openContextMenu(event, object.cells?.[cellId(row, 0)] || createCellRecord(row, 0));
              }}
              key={`row-${row}`}
              onClick={() => {
                onSelectRange?.(cellAddress(row, 0), cellAddress(row, object.columns - 1), cellAddress(row, selectedCoordinates.column));
                restoreSelectionScroll();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectRange?.(cellAddress(row, 0), cellAddress(row, object.columns - 1), cellAddress(row, selectedCoordinates.column));
                }
              }}
              style={{
                left: 0,
                top: columnHeaderHeight + rowOffsetForPosition(position),
                width: rowHeaderWidth,
                height: rowSizeForPosition(position),
                transform: "translate3d(var(--sheet-scroll-x, 0px), 0, 0)",
              }}
            >
              {rowGroup ? (
                <button
                  className="row-group-toggle"
                  type="button"
                  aria-label={`${rowGroup.collapsed ? "Expand" : "Collapse"} rows ${rowGroup.start + 1} to ${rowGroup.end + 1}`}
                  aria-expanded={!rowGroup.collapsed}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleRowGroup(rowGroup.id);
                  }}
                >
                  {rowGroup.collapsed
                    ? <IconChevronRight size={11} stroke={1.8} />
                    : <IconChevronDown size={11} stroke={1.8} />}
                </button>
              ) : null}
              <span>{row + 1}</span>
              <span className="row-resize-handle" role="separator" tabIndex={0} aria-label={`Resize row ${row + 1}`} onPointerDown={(event) => startResize(event, "row", row)} onKeyDown={(event) => {
                if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                  event.preventDefault();
                  const delta = event.key === "ArrowUp" ? -4 : 4;
                  resizeAxisWithKeyboard("row", row, delta);
                }
              }} />
            </div>
            );
          })}

          {visibleRows.flatMap(({ row, position }) => visibleColumns.map(({ column, position: columnPosition }) => {
            const id = cellId(row, column);
            const cell = object.cells[id] || createCellRecord(row, column);
            const calculatedValue = cell.formula ? formatFormulaResult(formulaValues.get(cell.address)) : cell.value;
            const isActiveCell = selectedAddress === cell.address;
            return (
              <div
                className={`virtual-cell-slot ${isActiveCell ? "is-active-cell-slot" : ""}`}
                key={id}
                data-row={row}
                data-column={column}
                style={{
                  left: rowHeaderWidth + columnOffsetForPosition(columnPosition),
                  top: columnHeaderHeight + rowOffsetForPosition(position),
                  width: columnSizeForPosition(columnPosition),
                  height: rowSizeForPosition(position),
                }}
              >
                <SheetCell
                  objectId={object.id}
                  cell={cell}
                  displayValue={formatCellValue(calculatedValue, cell.style)}
                  conditionalTone={conditionalToneForCell(object, cell, calculatedValue)}
                  selected={isActiveCell}
                  inRange={rangeContains(normalizedSelection, row, column)}
                  fillPreview={rangeContains(fillPreviewRange, row, column)}
                  inSelectedRow={showActiveAxisContext && selectedCoordinates.row === row}
                  inSelectedColumn={showActiveAxisContext && selectedCoordinates.column === column}
                  editing={editingCellId === id}
                  onSelect={onSelect}
                  onSelectionStart={startSelection}
                  onSelectionMove={moveSelectionGesture}
                  onFillStart={startFill}
                  onEdit={setEditingCellId}
                  onCommit={() => setEditingCellId(null)}
                  onValueChange={(cellIdToUpdate, value) => onCellChange(
                    cellIdToUpdate,
                    value.startsWith("=")
                      ? { formula: value, value: "", embed: null }
                      : { value, formula: "", embed: null },
                  )}
                  onOpenObject={onOpenObject}
                  onContextMenu={openContextMenu}
                />
              </div>
            );
          }))}
        </div>
      </div>

      <CellContextMenu
        menu={menu}
        onClose={() => setMenu(null)}
        onCreate={(type) => onCreateEmbedded?.(menu.cell, type, menu.sourceElement)}
        onCopy={copyCell}
        onPaste={pasteCell}
        onClear={() => {
          const activeRange = rangeContains(normalizedSelection, menu.cell.row, menu.cell.column)
            ? normalizedSelection
            : { anchor: menu.cell.address, focus: menu.cell.address };
          const changes = cellIdsInRange(activeRange).map((targetCellId) => ({
            cellId: targetCellId,
            patch: {
              value: "",
              formula: "",
              embed: null,
              note: undefined,
              style: undefined,
              validation: undefined,
            },
          }));
          onCellsChange?.(changes, "clear-range");
        }}
        onInsertRow={() => onInsertAxis?.("row", menu.cell.row)}
        onInsertColumn={() => onInsertAxis?.("column", menu.cell.column)}
        onDeleteRow={() => onDeleteAxis?.("row", menu.cell.row)}
        onDeleteColumn={() => onDeleteAxis?.("column", menu.cell.column)}
        onAttachFile={() => {
          pendingFileCellRef.current = { cell: menu.cell, sourceElement: menu.sourceElement };
          fileInputRef.current?.click();
        }}
        onOpenFloating={() => {
          if (!menu.cell.embed) return;
          onOpenObject?.({
            objectId: menu.cell.embed.objectId,
            sourceAddress: menu.cell.address,
            sourceLabel: menu.cell.value,
            sourceType: menu.cell.embed.type,
            sourceElement: menu.sourceElement,
            mode: "floating",
          });
        }}
        onOpenFull={() => {
          if (!menu.cell.embed) return;
          onOpenObject?.({
            objectId: menu.cell.embed.objectId,
            sourceAddress: menu.cell.address,
            sourceLabel: menu.cell.value,
            sourceType: menu.cell.embed.type,
            sourceElement: menu.sourceElement,
            mode: "full",
          });
        }}
        canClear={cellIdsInRange(
          rangeContains(normalizedSelection, menu?.cell?.row, menu?.cell?.column)
            ? normalizedSelection
            : { anchor: menu?.cell?.address, focus: menu?.cell?.address },
        ).some((targetCellId) => Boolean(object.cells?.[targetCellId]))}
        canSort={Boolean(normalizedSelection && normalizedSelection.rowEnd > normalizedSelection.rowStart)}
        onSort={(direction) => {
          const changes = sortRangeChanges(object, normalizedSelection, menu.cell.column, direction);
          onCellsChange?.(changes, `sort-${direction}`);
        }}
        canGroupRows={Boolean(
          normalizedSelection
          && normalizedSelection.rowEnd > normalizedSelection.rowStart
          && !rowGroups.some((group) => normalizedSelection.rowStart <= group.end && normalizedSelection.rowEnd >= group.start)
        )}
        canUngroupRows={rowGroups.some((group) => menu && menu.cell.row >= group.start && menu.cell.row <= group.end)}
        onGroupRows={() => {
          if (!normalizedSelection || normalizedSelection.rowEnd <= normalizedSelection.rowStart) return;
          onUpdateObject?.({
            rowGroups: [
              ...rowGroups,
              {
                id: createId("row-group"),
                start: normalizedSelection.rowStart,
                end: normalizedSelection.rowEnd,
                collapsed: false,
              },
            ],
          });
        }}
        onUngroupRows={() => {
          if (!menu) return;
          onUpdateObject?.({
            rowGroups: rowGroups.filter((group) => !(menu.cell.row >= group.start && menu.cell.row <= group.end)),
          });
        }}
        canGroupColumns={Boolean(
          normalizedSelection
          && normalizedSelection.columnEnd > normalizedSelection.columnStart
          && !columnGroups.some((group) => normalizedSelection.columnStart <= group.end && normalizedSelection.columnEnd >= group.start)
        )}
        canUngroupColumns={columnGroups.some((group) => menu && menu.cell.column >= group.start && menu.cell.column <= group.end)}
        onGroupColumns={() => {
          if (!normalizedSelection || normalizedSelection.columnEnd <= normalizedSelection.columnStart) return;
          onUpdateObject?.({
            columnGroups: [
              ...columnGroups,
              {
                id: createId("column-group"),
                start: normalizedSelection.columnStart,
                end: normalizedSelection.columnEnd,
                collapsed: false,
              },
            ],
          });
        }}
        onUngroupColumns={() => {
          if (!menu) return;
          onUpdateObject?.({
            columnGroups: columnGroups.filter((group) => !(menu.cell.column >= group.start && menu.cell.column <= group.end)),
          });
        }}
        canFilter={Boolean(menu?.cell && (menu.cell.formula || menu.cell.value))}
        hasFilters={filters.length > 0}
        onFilterValue={() => {
          if (!menu) return;
          const value = menu.cell.formula
            ? formulaValues.get(menu.cell.address)
            : menu.cell.value;
          onSelect(menu.cell.address);
          onUpdateObject?.({
            filters: [
              ...filters.filter((filter) => filter.column !== menu.cell.column),
              { id: createId("filter"), column: menu.cell.column, value: String(value ?? "") },
            ],
          });
        }}
        onClearFilters={() => onUpdateObject?.({ filters: [] })}
      />
    </div>
  );
}
