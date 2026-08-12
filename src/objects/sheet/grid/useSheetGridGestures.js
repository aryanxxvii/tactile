import { useCallback, useEffect, useRef, useState } from "react";
import { cellAddress } from "../../../sheet/coordinates.js";
import { fillChanges } from "../../../sheet/ranges.js";
import { rangeValues } from "./useSheetGridProjection.js";

export function useSheetGridGestures({
  object,
  selectedAddress,
  selectionRange,
  selectedCoordinates,
  normalizedSelection,
  scrollRef,
  metrics,
  rowIndexMap,
  columnIndexMap,
  columnPositionForIndex,
  columnOffsetForPosition,
  columnSizeForPosition,
  columnSizeForIndex,
  rowPositionForIndex,
  rowOffsetForPosition,
  rowSizeForPosition,
  rowSizeForIndex,
  onSelect,
  onSelectRange,
  onCellChange,
  onCellsChange,
  onUpdateObject,
  onMoveAxis,
  fillTarget,
  setFillTarget,
}) {
  const [editingCellId, setEditingCellId] = useState(null);
  const selectionDragRef = useRef(null);
  const fillDragRef = useRef(null);
  const fillTargetRef = useRef(null);
  const resizeRef = useRef(null);
  const axisDragRef = useRef(null);
  const selectionScrollRef = useRef(null);

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
      && !selectionDragRef.current
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
      const selectionDrag = selectionDragRef.current;
      selectionDragRef.current = null;
      const fill = fillDragRef.current;
      const target = fillTargetRef.current;
      fillDragRef.current = null;
      fillTargetRef.current = null;
      setFillTarget(null);
      if (fill && target && target !== fill.sourceAddress) {
        const changes = fillChanges(object, fill.sourceAddress, target);
        onCellsChange?.(changes, "fill");
        onSelectRange?.(fill.sourceAddress, target);
      }
      if (selectionDrag?.focus) {
        window.requestAnimationFrame(() => {
          const nextCell = document.querySelector(
            `[data-object-id="${object.id}"][data-cell-address="${selectionDrag.focus}"]`,
          );
          nextCell?.focus({ preventScroll: true });
        });
      }
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

  const startCellEditing = useCallback((cellId, initialValue = "") => {
    setEditingCellId(cellId);
    if (!initialValue) return;
    onCellChange?.(
      cellId,
      initialValue.startsWith("=")
        ? { formula: initialValue, value: "", embed: null }
        : { value: initialValue, formula: "", embed: null },
    );
  }, [onCellChange]);

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

  const startCornerSelection = useCallback((event) => {
    event.preventDefault();
    const scroller = scrollRef.current;
    if (scroller) selectionScrollRef.current = { left: scroller.scrollLeft, top: scroller.scrollTop };
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

  const toggleRowGroup = useCallback((groupId, rowGroups) => {
    const target = rowGroups.find((group) => group.id === groupId);
    if (target && !target.collapsed && selectedCoordinates.row > target.start && selectedCoordinates.row <= target.end) {
      onSelect(cellAddress(target.start, selectedCoordinates.column));
    }
    onUpdateObject?.({
      rowGroups: rowGroups.map((group) => (
        group.id === groupId ? { ...group, collapsed: !group.collapsed } : group
      )),
    });
  }, [onSelect, onUpdateObject, selectedCoordinates.column, selectedCoordinates.row]);

  const toggleColumnGroup = useCallback((groupId, columnGroups) => {
    const target = columnGroups.find((group) => group.id === groupId);
    if (target && !target.collapsed && selectedCoordinates.column > target.start && selectedCoordinates.column <= target.end) {
      onSelect(cellAddress(selectedCoordinates.row, target.start));
    }
    onUpdateObject?.({
      columnGroups: columnGroups.map((group) => (
        group.id === groupId ? { ...group, collapsed: !group.collapsed } : group
      )),
    });
  }, [onSelect, onUpdateObject, selectedCoordinates.column, selectedCoordinates.row]);

  return {
    editingCellId,
    setEditingCellId,
    fillTarget,
    selectionDragRef,
    startSelection,
    moveSelectionGesture,
    startCellEditing,
    startFill,
    startResize,
    resizeAxisWithKeyboard,
    startAxisDrag,
    startCornerSelection,
    restoreSelectionScroll,
    toggleRowGroup,
    toggleColumnGroup,
  };
}
