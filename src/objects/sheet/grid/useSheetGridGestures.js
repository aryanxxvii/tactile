import { useCallback, useEffect, useRef, useState } from "react";
import { cellAddress } from "../../../sheet/coordinates.js";
import { fillChanges, fillRange } from "../../../sheet/ranges.js";
import { rangeLabel } from "../../../sheet/ranges.js";
import { rangeValues } from "./useSheetGridProjection.js";

function axisPositionAtCoordinate(indexMap, offsetForPosition, sizeForPosition, coordinate) {
  if (!Number.isFinite(coordinate) || coordinate < 0 || !indexMap.length) return null;
  for (let position = 0; position < indexMap.length; position += 1) {
    const start = offsetForPosition(position);
    const end = start + sizeForPosition(position);
    if (coordinate < end || (position === indexMap.length - 1 && coordinate <= end)) return position;
  }
  return null;
}

function domCellAddressAtPoint(event, objectId) {
  if (!Number.isFinite(event?.clientX) || !Number.isFinite(event?.clientY)) return null;
  return document
    .elementsFromPoint(event.clientX, event.clientY)
    .map((element) => element.closest?.(".sheet-cell"))
    .find((cell) => cell?.dataset.objectId === objectId)
    ?.dataset.cellAddress || null;
}

function captureGesturePointer(gesture, event) {
  if (!gesture || gesture.captured || gesture.pointerId == null || event.pointerId !== gesture.pointerId) return;
  const distance = Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY);
  if (distance < 4) return;
  try {
    gesture.captureTarget?.setPointerCapture?.(gesture.pointerId);
    gesture.captured = true;
  } catch {
    // Geometry hit-testing and the window listeners still complete the gesture.
  }
}

function focusSelectedGestureCell(objectId, address, attempt = 0) {
  window.requestAnimationFrame(() => {
    if (document.activeElement?.matches(".cell-editor")) return;
    const nextCell = document.querySelector(
      `[data-object-id="${objectId}"][data-cell-address="${address}"]`,
    );
    if (nextCell?.getAttribute("aria-selected") !== "true") {
      if (attempt < 8) focusSelectedGestureCell(objectId, address, attempt + 1);
      return;
    }
    nextCell.focus({ preventScroll: true });
  });
}

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
  const [formulaReferenceRange, setFormulaReferenceRange] = useState(null);
  const selectionDragRef = useRef(null);
  const formulaReferenceDragRef = useRef(null);
  const fillDragRef = useRef(null);
  const fillTargetRef = useRef(null);
  const resizeRef = useRef(null);
  const axisDragRef = useRef(null);
  const selectionScrollRef = useRef(null);
  const gestureCallbacksRef = useRef(null);
  const gestureGeometryRef = useRef(null);
  const moveSelectionGestureRef = useRef(null);

  gestureGeometryRef.current = {
    scrollRef,
    metrics,
    rowIndexMap,
    columnIndexMap,
    columnOffsetForPosition,
    columnSizeForPosition,
    rowOffsetForPosition,
    rowSizeForPosition,
  };

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
        if (document.activeElement?.matches(".cell-editor")) return;
        const nextCell = document.querySelector(
          `[data-object-id="${object.id}"][data-cell-address="${selectedAddress}"]`,
        );
        nextCell?.focus({ preventScroll: true });
      }));
    }
  }, [columnOffsetForPosition, columnPositionForIndex, columnSizeForPosition, editingCellId, metrics, object.id, rowOffsetForPosition, rowPositionForIndex, rowSizeForPosition, scrollRef, selectedAddress, selectedCoordinates.column, selectedCoordinates.row]);

  const cellAddressAtPoint = useCallback((event) => {
    const geometry = gestureGeometryRef.current;
    const scroller = geometry?.scrollRef?.current;
    if (!scroller || !Number.isFinite(event?.clientX) || !Number.isFinite(event?.clientY)) return null;
    const bounds = scroller.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return null;
    const layoutWidth = scroller.clientWidth || bounds.width;
    const layoutHeight = scroller.clientHeight || bounds.height;
    const scaleX = layoutWidth > 0 ? bounds.width / layoutWidth : 1;
    const scaleY = layoutHeight > 0 ? bounds.height / layoutHeight : 1;
    const localX = (event.clientX - bounds.left) / (scaleX || 1) + scroller.scrollLeft;
    const localY = (event.clientY - bounds.top) / (scaleY || 1) + scroller.scrollTop;
    const columnPosition = axisPositionAtCoordinate(
      geometry.columnIndexMap,
      geometry.columnOffsetForPosition,
      geometry.columnSizeForPosition,
      localX - geometry.metrics.rowHeaderWidth,
    );
    const rowPosition = axisPositionAtCoordinate(
      geometry.rowIndexMap,
      geometry.rowOffsetForPosition,
      geometry.rowSizeForPosition,
      localY - geometry.metrics.columnHeaderHeight,
    );
    if (!Number.isInteger(columnPosition) || !Number.isInteger(rowPosition)) return null;
    return cellAddress(
      geometry.rowIndexMap[rowPosition],
      geometry.columnIndexMap[columnPosition],
    );
  }, []);

  gestureCallbacksRef.current = {
    object,
    onCellChange,
    onCellsChange,
    onSelectRange,
    setFillTarget,
    setFormulaReferenceRange,
  };

  useEffect(() => {
    if (!editingCellId) {
      formulaReferenceDragRef.current = null;
      setFormulaReferenceRange(null);
    }
  }, [editingCellId]);

  const updateFormulaReference = useCallback((reference) => {
    const active = formulaReferenceDragRef.current;
    if (!active) return;
    active.focus = reference;
    const range = { anchor: active.anchor, focus: reference };
    const label = rangeLabel(range);
    if (active.lastLabel === label) return;
    active.lastLabel = label;
    active.callbacks?.setFormulaReferenceRange?.(range);
    active.callbacks?.onCellChange?.(active.sourceCellId, {
      formula: `${active.prefix}${label}${active.suffix}`,
      value: "",
      embed: null,
    });
  }, []);

  const startFormulaReference = useCallback((event, cell) => {
    if (event.button !== 0 || !editingCellId || cell.id === editingCellId) return;
    event.preventDefault();
    const input = document.activeElement?.matches?.(".cell-editor") ? document.activeElement : null;
    const source = object.cells?.[editingCellId];
    const value = source?.formula || source?.value || "";
    const caret = input?.selectionStart ?? value.length;
    const callbacks = gestureCallbacksRef.current;
    formulaReferenceDragRef.current = {
      sourceCellId: editingCellId,
      anchor: cell.address,
      focus: cell.address,
      prefix: value.slice(0, caret),
      suffix: value.slice(caret),
      lastLabel: null,
      pointerId: event.pointerId,
      callbacks,
    };
    updateFormulaReference(cell.address);
  }, [editingCellId, object.cells, updateFormulaReference]);

  const moveFormulaReference = useCallback((cell) => {
    if (formulaReferenceDragRef.current) updateFormulaReference(cell.address);
  }, [updateFormulaReference]);

  useEffect(() => {
    const finishPointerGesture = (event) => {
      const selectionDrag = selectionDragRef.current;
      const fill = fillDragRef.current;
      const formulaReference = formulaReferenceDragRef.current;
      const activeGesture = selectionDrag || fill || formulaReference;
      if (!activeGesture) return;
      if (activeGesture.pointerId != null && event?.pointerId != null && event.pointerId !== activeGesture.pointerId) return;
      if (selectionDrag && event?.type === "pointerup") {
        const callbacks = gestureCallbacksRef.current;
        const address = cellAddressAtPoint(event)
          || domCellAddressAtPoint(event, callbacks?.object?.id);
        if (address && address !== selectionDrag.focus) {
          selectionDrag.focus = address;
          callbacks?.onSelectRange?.(selectionDrag.anchor, address);
        }
      }
      if (formulaReference && event?.type === "pointerup") {
        const callbacks = gestureCallbacksRef.current;
        const address = cellAddressAtPoint(event)
          || domCellAddressAtPoint(event, callbacks?.object?.id);
        if (address) updateFormulaReference(address);
      }
      const releaseTarget = activeGesture.captureTarget;
      if (activeGesture.captured && releaseTarget && activeGesture.pointerId != null) {
        try {
          releaseTarget.releasePointerCapture?.(activeGesture.pointerId);
        } catch {
          // The browser may release capture before the window-level cleanup runs.
        }
      }
      selectionDragRef.current = null;
      formulaReferenceDragRef.current = null;
      const target = fillTargetRef.current;
      fillDragRef.current = null;
      fillTargetRef.current = null;
      const callbacks = gestureCallbacksRef.current;
      callbacks?.setFillTarget(null);
      if (formulaReference) callbacks?.setFormulaReferenceRange?.({ anchor: formulaReference.anchor, focus: formulaReference.focus });
      if (fill && target && target !== fill.sourceAddress) {
        const changes = fillChanges(callbacks.object, fill.sourceAddress, target, fill.sourceRange);
        callbacks.onCellsChange?.(changes, "fill");
        const filledRange = fillRange(fill.sourceRange, target);
        callbacks.onSelectRange?.(filledRange?.anchor || fill.sourceAddress, filledRange?.focus || target);
      }
      if (selectionDrag?.focus && selectionDrag.focus !== selectionDrag.startAddress) {
        focusSelectedGestureCell(callbacks?.object?.id, selectionDrag.focus);
      }
    };
    window.addEventListener("pointerup", finishPointerGesture, true);
    window.addEventListener("pointercancel", finishPointerGesture, true);
    return () => {
      window.removeEventListener("pointerup", finishPointerGesture, true);
      window.removeEventListener("pointercancel", finishPointerGesture, true);
    };
  }, [cellAddressAtPoint, updateFormulaReference]);

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
    if (!cell.embed) {
      const captureTarget = scrollRef.current || event.currentTarget;
      selectionDragRef.current = {
        anchor,
        startAddress: cell.address,
        focus: cell.address,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        captureTarget,
        captured: false,
      };
    }
  }, [editingCellId, onSelect, onSelectRange, scrollRef, selectedAddress, selectionRange?.anchor]);

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

  moveSelectionGestureRef.current = moveSelectionGesture;

  useEffect(() => {
    const moveSelectionFromPointer = (event) => {
      const activeGesture = selectionDragRef.current || fillDragRef.current || formulaReferenceDragRef.current;
      if (!activeGesture) return;
      if (activeGesture.pointerId != null && event.pointerId != null && event.pointerId !== activeGesture.pointerId) return;
      captureGesturePointer(activeGesture, event);
      const callbacks = gestureCallbacksRef.current;
      const address = cellAddressAtPoint(event)
        || domCellAddressAtPoint(event, callbacks?.object?.id);
      if (address) {
        if (formulaReferenceDragRef.current) moveFormulaReference({ address });
        else moveSelectionGestureRef.current?.({ address });
      }
    };
    window.addEventListener("pointermove", moveSelectionFromPointer, true);
    return () => window.removeEventListener("pointermove", moveSelectionFromPointer, true);
  }, [cellAddressAtPoint, moveFormulaReference]);

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
    const captureTarget = scrollRef.current || event.currentTarget;
    if (event.pointerId != null) captureTarget.setPointerCapture?.(event.pointerId);
    fillDragRef.current = {
      sourceAddress: cell.address,
      sourceRange: selectionRange || { anchor: cell.address, focus: cell.address },
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      captureTarget,
      captured: event.pointerId != null,
    };
    fillTargetRef.current = cell.address;
    setFillTarget(cell.address);
  }, [scrollRef, selectionRange]);

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
    formulaReferenceRange,
    setEditingCellId,
    fillTarget,
    selectionDragRef,
    startSelection,
    moveSelectionGesture,
    startCellEditing,
    startFormulaReference,
    moveFormulaReference,
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
