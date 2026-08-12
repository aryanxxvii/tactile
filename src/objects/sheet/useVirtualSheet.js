import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

export const SHEET_METRICS = {
  rowHeight: 31,
  columnWidth: 126,
  rowHeaderWidth: 34,
  columnHeaderHeight: 25,
  overscan: 3,
};

const SUSPENDED_SHEET_VIEW = new Map();

function rememberSheetViewport(viewStateKey, viewport) {
  if (!viewStateKey || !viewport) return;
  SUSPENDED_SHEET_VIEW.set(viewStateKey, {
    width: viewport.width,
    height: viewport.height,
    scrollLeft: viewport.scrollLeft,
    scrollTop: viewport.scrollTop,
  });
}

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

function buildRange(rowGeometry, columnGeometry, rowCount, columnCount, metrics, viewport, overscan) {
  const { rowHeaderWidth, columnHeaderHeight } = metrics;
  const rowMax = Math.max(0, rowCount - 1);
  const columnMax = Math.max(0, columnCount - 1);
  return {
    rowStart: clamp(
      firstVisiblePosition(rowGeometry.offsets, viewport.scrollTop - columnHeaderHeight) - overscan,
      0,
      rowMax,
    ),
    rowEnd: clamp(
      firstVisiblePosition(rowGeometry.offsets, viewport.scrollTop + viewport.height - columnHeaderHeight) + overscan,
      0,
      rowMax,
    ),
    columnStart: clamp(
      firstVisiblePosition(columnGeometry.offsets, viewport.scrollLeft - rowHeaderWidth) - overscan,
      0,
      columnMax,
    ),
    columnEnd: clamp(
      firstVisiblePosition(columnGeometry.offsets, viewport.scrollLeft + viewport.width - rowHeaderWidth) + overscan,
      0,
      columnMax,
    ),
  };
}

function rangeContains(range, visibleRange) {
  return visibleRange.rowStart >= range.rowStart
    && visibleRange.rowEnd <= range.rowEnd
    && visibleRange.columnStart >= range.columnStart
    && visibleRange.columnEnd <= range.columnEnd;
}

export function useVirtualSheet(rows, columns, customMetrics, customRowIndexMap, customColumnIndexMap, viewStateKey = "") {
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
  const [viewport, setViewport] = useState(() => {
    const saved = viewStateKey ? SUSPENDED_SHEET_VIEW.get(viewStateKey) : null;
    return {
      // A sheet can move between the base layer and a floating layer while
      // In & Out closes. Reuse its last measured viewport so the first paint
      // after that move keeps the same virtual row window instead of briefly
      // rendering only the default 500px fallback.
      width: saved?.width || 900,
      height: saved?.height || 500,
      scrollLeft: saved?.scrollLeft || 0,
      scrollTop: saved?.scrollTop || 0,
    };
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
      rememberSheetViewport(viewStateKey, next);
      return current.width === next.width
        && current.height === next.height
        && current.scrollLeft === next.scrollLeft
        && current.scrollTop === next.scrollTop
        ? current
        : next;
    });
  }, [viewStateKey]);

  useEffect(() => {
    readViewport();
    const element = scrollRef.current;
    if (!element) return undefined;
    const saved = viewStateKey ? SUSPENDED_SHEET_VIEW.get(viewStateKey) : null;
    if (saved) {
      element.scrollLeft = saved.scrollLeft || 0;
      element.scrollTop = saved.scrollTop || 0;
      element.style.setProperty("--sheet-scroll-x", `${element.scrollLeft}px`);
      element.style.setProperty("--sheet-scroll-y", `${element.scrollTop}px`);
      readViewport();
    }
    const observer = new ResizeObserver(readViewport);
    observer.observe(element);
    return () => observer.disconnect();
  }, [readViewport, viewStateKey]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;
    const syncScrollPosition = () => {
      element.style.setProperty("--sheet-scroll-x", `${element.scrollLeft}px`);
      element.style.setProperty("--sheet-scroll-y", `${element.scrollTop}px`);
    };
    syncScrollPosition();
    element.addEventListener("scroll", syncScrollPosition, { passive: true });
    return () => element.removeEventListener("scroll", syncScrollPosition);
  }, []);

  useEffect(() => () => {
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
  }, []);

  const range = useMemo(() => {
    return buildRange(
      rowGeometry,
      columnGeometry,
      rowIndexMap.length,
      columnIndexMap.length,
      metrics,
      viewport,
      metrics.overscan,
    );
  }, [columnGeometry.offsets, columnIndexMap.length, metrics, rowGeometry.offsets, rowIndexMap.length, viewport]);

  const onScroll = useCallback((event) => {
    const element = event?.currentTarget || scrollRef.current;
    if (element) {
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && element.contains(focused)) focused.blur();
      element.style.setProperty("--sheet-scroll-x", `${element.scrollLeft}px`);
      element.style.setProperty("--sheet-scroll-y", `${element.scrollTop}px`);
    }
    const nextViewport = element
      ? {
        width: element.clientWidth,
        height: element.clientHeight,
        scrollLeft: element.scrollLeft,
        scrollTop: element.scrollTop,
      }
      : null;
    const nextVisibleRange = nextViewport
      ? buildRange(
        rowGeometry,
        columnGeometry,
        rowIndexMap.length,
        columnIndexMap.length,
        metrics,
        nextViewport,
        0,
      )
      : null;
    // A normal scroll remains compositor-friendly: CSS rails move immediately
    // and the bounded React window updates on the next scheduled commit. Only
    // flush when a jump would leave the current window unable to cover the
    // viewport, preventing a blank frame without rendering per-pixel work.
    if (nextVisibleRange && !rangeContains(range, nextVisibleRange)) {
      flushSync(() => readViewport());
    }
    if (frameRef.current) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const current = scrollRef.current;
      if (current) {
        readViewport();
        current.style.setProperty("--sheet-scroll-x", `${current.scrollLeft}px`);
        current.style.setProperty("--sheet-scroll-y", `${current.scrollTop}px`);
        if (viewStateKey) {
          rememberSheetViewport(viewStateKey, {
            width: current.clientWidth,
            height: current.clientHeight,
            scrollLeft: current.scrollLeft,
            scrollTop: current.scrollTop,
          });
        }
      }
    });
  }, [columnGeometry, columnIndexMap.length, metrics, range, readViewport, rowGeometry, rowIndexMap.length, viewStateKey]);

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
