import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const SHEET_METRICS = {
  rowHeight: 31,
  columnWidth: 126,
  rowHeaderWidth: 34,
  columnHeaderHeight: 25,
  overscan: 3,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function numericSize(value, fallback, min, max) {
  const size = Number(value);
  return Number.isFinite(size) ? clamp(size, min, max) : fallback;
}

function buildAxisGeometry(indexMap, overrides, fallback, min, max) {
  const sizes = indexMap.map((index) => numericSize(overrides?.[index], fallback, min, max));
  const offsets = [0];
  sizes.forEach((size) => offsets.push(offsets[offsets.length - 1] + size));
  return { sizes, offsets, total: offsets[offsets.length - 1] || 0 };
}

function firstVisiblePosition(offsets, coordinate) {
  const itemCount = Math.max(0, offsets.length - 1);
  if (!itemCount) return 0;
  let low = 0;
  let high = itemCount - 1;
  const target = Math.max(0, coordinate);
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (offsets[middle + 1] > target) high = middle;
    else low = middle + 1;
  }
  return low;
}

export function useVirtualSheet(rows, columns, customMetrics, customRowIndexMap, customColumnIndexMap) {
  const metrics = useMemo(() => ({
    ...SHEET_METRICS,
    rowHeight: customMetrics?.rowHeight ?? SHEET_METRICS.rowHeight,
    columnWidth: customMetrics?.columnWidth ?? SHEET_METRICS.columnWidth,
    rowHeaderWidth: customMetrics?.rowHeaderWidth ?? SHEET_METRICS.rowHeaderWidth,
    columnHeaderHeight: customMetrics?.columnHeaderHeight ?? SHEET_METRICS.columnHeaderHeight,
    overscan: customMetrics?.overscan ?? SHEET_METRICS.overscan,
  }), [
    customMetrics?.columnHeaderHeight,
    customMetrics?.columnWidth,
    customMetrics?.overscan,
    customMetrics?.rowHeaderWidth,
    customMetrics?.rowHeight,
  ]);
  const rowIndexMap = useMemo(
    () => Array.isArray(customRowIndexMap)
      ? customRowIndexMap
      : Array.from({ length: rows }, (_, index) => index),
    [customRowIndexMap, rows],
  );
  const rowPositionMap = useMemo(
    () => new Map(rowIndexMap.map((row, position) => [row, position])),
    [rowIndexMap],
  );
  const columnIndexMap = useMemo(
    () => Array.isArray(customColumnIndexMap)
      ? customColumnIndexMap
      : Array.from({ length: columns }, (_, index) => index),
    [columns, customColumnIndexMap],
  );
  const columnPositionMap = useMemo(
    () => new Map(columnIndexMap.map((column, position) => [column, position])),
    [columnIndexMap],
  );
  const rowGeometry = useMemo(
    () => buildAxisGeometry(rowIndexMap, customMetrics?.rowHeights, metrics.rowHeight, 24, 96),
    [customMetrics?.rowHeights, metrics.rowHeight, rowIndexMap],
  );
  const columnGeometry = useMemo(
    () => buildAxisGeometry(columnIndexMap, customMetrics?.columnWidths, metrics.columnWidth, 56, 420),
    [columnIndexMap, customMetrics?.columnWidths, metrics.columnWidth],
  );
  const scrollRef = useRef(null);
  const frameRef = useRef(null);
  const [viewport, setViewport] = useState({
    width: 900,
    height: 500,
    scrollLeft: 0,
    scrollTop: 0,
  });

  const readViewport = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    setViewport((current) => {
      const next = {
        width: element.clientWidth,
        height: element.clientHeight,
        scrollLeft: element.scrollLeft,
        scrollTop: element.scrollTop,
      };
      return current.width === next.width
        && current.height === next.height
        && current.scrollLeft === next.scrollLeft
        && current.scrollTop === next.scrollTop
        ? current
        : next;
    });
  }, []);

  useEffect(() => {
    readViewport();
    const element = scrollRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(readViewport);
    observer.observe(element);
    return () => observer.disconnect();
  }, [readViewport]);

  useEffect(() => () => {
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
  }, []);

  const onScroll = useCallback((event) => {
    const element = event?.currentTarget || scrollRef.current;
    if (element) {
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && element.contains(focused)) focused.blur();
      element.style.setProperty("--sheet-scroll-x", `${element.scrollLeft}px`);
      element.style.setProperty("--sheet-scroll-y", `${element.scrollTop}px`);
    }
    if (frameRef.current) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const current = scrollRef.current;
      if (current) {
        current.style.setProperty("--sheet-scroll-x", `${current.scrollLeft}px`);
        current.style.setProperty("--sheet-scroll-y", `${current.scrollTop}px`);
      }
      readViewport();
    });
  }, [readViewport]);

  const range = useMemo(() => {
    const { rowHeaderWidth, columnHeaderHeight, overscan } = metrics;
    const rowStart = clamp(
      firstVisiblePosition(rowGeometry.offsets, viewport.scrollTop - columnHeaderHeight) - overscan,
      0,
      Math.max(0, rowIndexMap.length - 1),
    );
    const rowEnd = clamp(
      firstVisiblePosition(rowGeometry.offsets, viewport.scrollTop + viewport.height - columnHeaderHeight) + overscan,
      0,
      Math.max(0, rowIndexMap.length - 1),
    );
    const columnStart = clamp(
      firstVisiblePosition(columnGeometry.offsets, viewport.scrollLeft - rowHeaderWidth) - overscan,
      0,
      Math.max(0, columnIndexMap.length - 1),
    );
    const columnEnd = clamp(
      firstVisiblePosition(columnGeometry.offsets, viewport.scrollLeft + viewport.width - rowHeaderWidth) + overscan,
      0,
      Math.max(0, columnIndexMap.length - 1),
    );
    return { rowStart, rowEnd, columnStart, columnEnd };
  }, [columnGeometry.offsets, columnIndexMap.length, metrics, rowGeometry.offsets, rowIndexMap.length, viewport]);

  const canvasSize = useMemo(() => ({
    width: metrics.rowHeaderWidth + columnGeometry.total,
    height: metrics.columnHeaderHeight + rowGeometry.total,
  }), [columnGeometry.total, metrics.columnHeaderHeight, metrics.rowHeaderWidth, rowGeometry.total]);

  const rowPositionForIndex = useCallback((row) => rowPositionMap.get(row), [rowPositionMap]);
  const columnPositionForIndex = useCallback((column) => columnPositionMap.get(column), [columnPositionMap]);
  const rowOffsetForPosition = useCallback((position) => rowGeometry.offsets[position] || 0, [rowGeometry.offsets]);
  const columnOffsetForPosition = useCallback((position) => columnGeometry.offsets[position] || 0, [columnGeometry.offsets]);
  const rowSizeForPosition = useCallback((position) => rowGeometry.sizes[position] || metrics.rowHeight, [metrics.rowHeight, rowGeometry.sizes]);
  const columnSizeForPosition = useCallback((position) => columnGeometry.sizes[position] || metrics.columnWidth, [columnGeometry.sizes, metrics.columnWidth]);
  const rowSizeForIndex = useCallback((row) => {
    const position = rowPositionMap.get(row);
    return Number.isInteger(position) ? rowSizeForPosition(position) : metrics.rowHeight;
  }, [metrics.rowHeight, rowPositionMap, rowSizeForPosition]);
  const columnSizeForIndex = useCallback((column) => {
    const position = columnPositionMap.get(column);
    return Number.isInteger(position) ? columnSizeForPosition(position) : metrics.columnWidth;
  }, [columnPositionMap, columnSizeForPosition, metrics.columnWidth]);

  return {
    scrollRef,
    viewport,
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
  };
}
