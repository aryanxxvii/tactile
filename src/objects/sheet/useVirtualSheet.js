import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

export const SHEET_METRICS = {
  rowHeight: 31,
  columnWidth: 126,
  rowHeaderWidth: 34,
  columnHeaderHeight: 25,
  overscan: 3,
  // Keep a larger mounted band than the visible slice. The band is the
  // hysteresis that prevents a smooth scroll from rebasing the React window
  // at every row boundary while still leaving a bounded DOM.
  overscanHysteresis: 2,
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

function numericMetric(value, fallback, min = 0) {
  const metric = Number(value);
  return Number.isFinite(metric) ? Math.max(min, metric) : fallback;
}

export function buildAxisGeometry(indexMap, overrides, fallback, min, max) {
  const sizes = indexMap.map((index) => numericSize(overrides?.[index], fallback, min, max));
  const offsets = [0];
  sizes.forEach((size) => offsets.push(offsets[offsets.length - 1] + size));
  return { sizes, offsets, total: offsets[offsets.length - 1] || 0 };
}

export function firstVisiblePosition(offsets, coordinate) {
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

export function buildVirtualRange(
  rowGeometry,
  columnGeometry,
  rowCount,
  columnCount,
  metrics,
  viewport,
  overscan = 0,
) {
  const { rowHeaderWidth, columnHeaderHeight } = metrics;
  const rowMax = Math.max(0, rowCount - 1);
  const columnMax = Math.max(0, columnCount - 1);
  const padding = Math.max(0, Number(overscan) || 0);
  return {
    rowStart: clamp(
      firstVisiblePosition(rowGeometry.offsets, (viewport?.scrollTop || 0) - columnHeaderHeight) - padding,
      0,
      rowMax,
    ),
    rowEnd: clamp(
      firstVisiblePosition(
        rowGeometry.offsets,
        (viewport?.scrollTop || 0) + (viewport?.height || 0) - columnHeaderHeight,
      ) + padding,
      0,
      rowMax,
    ),
    columnStart: clamp(
      firstVisiblePosition(columnGeometry.offsets, (viewport?.scrollLeft || 0) - rowHeaderWidth) - padding,
      0,
      columnMax,
    ),
    columnEnd: clamp(
      firstVisiblePosition(
        columnGeometry.offsets,
        (viewport?.scrollLeft || 0) + (viewport?.width || 0) - rowHeaderWidth,
      ) + padding,
      0,
      columnMax,
    ),
  };
}

export function rangesEqual(left, right) {
  return Boolean(left && right)
    && left.rowStart === right.rowStart
    && left.rowEnd === right.rowEnd
    && left.columnStart === right.columnStart
    && left.columnEnd === right.columnEnd;
}

export function rangeContains(range, visibleRange) {
  return Boolean(range && visibleRange)
    && visibleRange.rowStart >= range.rowStart
    && visibleRange.rowEnd <= range.rowEnd
    && visibleRange.columnStart >= range.columnStart
    && visibleRange.columnEnd <= range.columnEnd;
}

export function expandedRange(range, rowCount, columnCount, padding) {
  const rowMax = Math.max(0, rowCount - 1);
  const columnMax = Math.max(0, columnCount - 1);
  const amount = Math.max(0, Number(padding) || 0);
  return {
    rowStart: clamp(range.rowStart - amount, 0, rowMax),
    rowEnd: clamp(range.rowEnd + amount, 0, rowMax),
    columnStart: clamp(range.columnStart - amount, 0, columnMax),
    columnEnd: clamp(range.columnEnd + amount, 0, columnMax),
  };
}

function initialViewportFor(viewStateKey) {
  const saved = viewStateKey ? SUSPENDED_SHEET_VIEW.get(viewStateKey) : null;
  return {
    // A sheet can move between the base layer and a floating layer while
    // In & Out closes. Reuse its last measured viewport so the first paint
    // after that move keeps the same virtual row window instead of briefly
    // rendering only the default fallback.
    width: saved?.width || 900,
    height: saved?.height || 500,
    scrollLeft: saved?.scrollLeft || 0,
    scrollTop: saved?.scrollTop || 0,
  };
}

export function useVirtualSheet(rows, columns, customMetrics, customRowIndexMap, customColumnIndexMap, viewStateKey = "") {
  const metrics = useMemo(() => {
    const overscan = numericMetric(customMetrics?.overscan, SHEET_METRICS.overscan);
    return {
      ...SHEET_METRICS,
      rowHeight: customMetrics?.rowHeight ?? SHEET_METRICS.rowHeight,
      columnWidth: customMetrics?.columnWidth ?? SHEET_METRICS.columnWidth,
      rowHeaderWidth: customMetrics?.rowHeaderWidth ?? SHEET_METRICS.rowHeaderWidth,
      columnHeaderHeight: customMetrics?.columnHeaderHeight ?? SHEET_METRICS.columnHeaderHeight,
      overscan,
      overscanHysteresis: numericMetric(
        customMetrics?.overscanHysteresis,
        SHEET_METRICS.overscanHysteresis,
      ),
    };
  }, [
    customMetrics?.columnHeaderHeight,
    customMetrics?.columnWidth,
    customMetrics?.overscan,
    customMetrics?.overscanHysteresis,
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
  const memoryFrameRef = useRef(null);
  const initialViewport = useMemo(() => initialViewportFor(viewStateKey), [viewStateKey]);
  const scrollPositionRef = useRef({
    scrollLeft: initialViewport.scrollLeft,
    scrollTop: initialViewport.scrollTop,
  });
  const [viewportSize, setViewportSize] = useState(() => ({
    width: initialViewport.width,
    height: initialViewport.height,
  }));
  const viewportSizeRef = useRef(viewportSize);
  viewportSizeRef.current = viewportSize;

  const renderOverscan = metrics.overscan + metrics.overscanHysteresis;
  const viewportForRange = useCallback((viewport) => ({
    width: viewport.width,
    height: viewport.height,
    scrollLeft: viewport.scrollLeft,
    scrollTop: viewport.scrollTop,
  }), []);
  const buildVisibleRange = useCallback((viewport) => buildVirtualRange(
    rowGeometry,
    columnGeometry,
    rowIndexMap.length,
    columnIndexMap.length,
    metrics,
    viewportForRange(viewport),
    0,
  ), [columnGeometry, columnIndexMap.length, metrics, rowGeometry, rowIndexMap.length, viewportForRange]);
  const buildRenderRange = useCallback((viewport) => buildVirtualRange(
    rowGeometry,
    columnGeometry,
    rowIndexMap.length,
    columnIndexMap.length,
    metrics,
    viewportForRange(viewport),
    renderOverscan,
  ), [columnGeometry, columnIndexMap.length, metrics, renderOverscan, rowGeometry, rowIndexMap.length, viewportForRange]);
  const initialRange = useMemo(
    () => buildRenderRange({
      ...viewportSize,
      ...scrollPositionRef.current,
    }),
    [buildRenderRange, viewportSize],
  );
  const [range, setRange] = useState(initialRange);
  const rangeRef = useRef(range);
  const commitRange = useCallback((nextRange) => {
    if (rangesEqual(rangeRef.current, nextRange)) return false;
    rangeRef.current = nextRange;
    setRange(nextRange);
    return true;
  }, []);

  const syncScrollStyles = useCallback((element) => {
    if (!element) return;
    const scrollLeft = Number(element.scrollLeft) || 0;
    const scrollTop = Number(element.scrollTop) || 0;
    scrollPositionRef.current = { scrollLeft, scrollTop };
    element.style.setProperty("--sheet-scroll-x", `${scrollLeft}px`);
    element.style.setProperty("--sheet-scroll-y", `${scrollTop}px`);
  }, []);

  const scheduleViewportMemory = useCallback((viewport) => {
    if (!viewStateKey || memoryFrameRef.current != null) return;
    memoryFrameRef.current = window.requestAnimationFrame(() => {
      memoryFrameRef.current = null;
      rememberSheetViewport(viewStateKey, viewport);
    });
  }, [viewStateKey]);

  const syncViewport = useCallback((element, { forceRange = false, immediateRange = false } = {}) => {
    if (!element) return;
    syncScrollStyles(element);
    const next = {
      width: Math.max(1, element.clientWidth || viewportSizeRef.current.width || 900),
      height: Math.max(1, element.clientHeight || viewportSizeRef.current.height || 500),
      scrollLeft: scrollPositionRef.current.scrollLeft,
      scrollTop: scrollPositionRef.current.scrollTop,
    };
    const previousSize = viewportSizeRef.current;
    const sizeChanged = previousSize.width !== next.width || previousSize.height !== next.height;
    if (sizeChanged) {
      viewportSizeRef.current = { width: next.width, height: next.height };
      setViewportSize((current) => current.width === next.width && current.height === next.height
        ? current
        : { width: next.width, height: next.height });
    }
    scheduleViewportMemory(next);

    const visibleRange = buildVisibleRange(next);
    if (!forceRange && rangeContains(rangeRef.current, visibleRange)) return;
    const nextRange = buildRenderRange(next);
    const update = () => commitRange(nextRange);
    if (immediateRange) flushSync(update);
    else update();
  }, [buildRenderRange, buildVisibleRange, commitRange, scheduleViewportMemory, syncScrollStyles]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;
    const saved = viewStateKey ? SUSPENDED_SHEET_VIEW.get(viewStateKey) : null;
    if (saved) {
      element.scrollLeft = saved.scrollLeft || 0;
      element.scrollTop = saved.scrollTop || 0;
    }
    syncScrollStyles(element);
    return undefined;
  }, [syncScrollStyles, viewStateKey]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;
    syncViewport(element, { forceRange: true });
    const observer = typeof ResizeObserver === "function"
      ? new ResizeObserver(() => syncViewport(element))
      : null;
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [syncViewport]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;
    const syncScrollPosition = () => syncScrollStyles(element);
    syncScrollPosition();
    element.addEventListener("scroll", syncScrollPosition, { passive: true });
    return () => element.removeEventListener("scroll", syncScrollPosition);
  }, [syncScrollStyles]);

  useEffect(() => () => {
    if (memoryFrameRef.current != null) window.cancelAnimationFrame(memoryFrameRef.current);
  }, []);

  const onScroll = useCallback((event) => {
    const element = event?.currentTarget || scrollRef.current;
    syncViewport(element, { immediateRange: true });
  }, [syncViewport]);

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
    viewport: {
      ...viewportSize,
      ...scrollPositionRef.current,
    },
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
