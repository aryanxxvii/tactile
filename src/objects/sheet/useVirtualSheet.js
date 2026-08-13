import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

export const SHEET_METRICS = {
  rowHeight: 31,
  columnWidth: 126,
  rowHeaderWidth: 34,
  columnHeaderHeight: 25,
  bodyLeftInset: 3,
  bodyTopInset: 3,
  overscan: 3,
  // Keep a larger mounted band than the visible slice. The band is the
  // hysteresis that prevents a smooth scroll from rebasing the React window
  // at every row boundary while still leaving a bounded DOM.
  overscanHysteresis: 2,
};

const SUSPENDED_SHEET_VIEW = new Map();
const MAX_DIRECTIONAL_AHEAD = 6;

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

function finiteCoordinate(value, fallback = 0) {
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : fallback;
}

function nativeScrollPosition(element) {
  if (!element) return { scrollLeft: 0, scrollTop: 0 };
  const clientWidth = Math.max(0, finiteCoordinate(element.clientWidth));
  const clientHeight = Math.max(0, finiteCoordinate(element.clientHeight));
  const maxScrollLeft = Math.max(0, finiteCoordinate(element.scrollWidth) - clientWidth);
  const maxScrollTop = Math.max(0, finiteCoordinate(element.scrollHeight) - clientHeight);
  return {
    scrollLeft: clamp(finiteCoordinate(element.scrollLeft), 0, maxScrollLeft),
    scrollTop: clamp(finiteCoordinate(element.scrollTop), 0, maxScrollTop),
  };
}

function axisMax(value, geometry) {
  const requestedCount = Math.max(0, Math.floor(finiteCoordinate(value)));
  const geometryCount = geometry
    ? Math.max(0, (geometry.offsets?.length || 1) - 1)
    : requestedCount;
  return Math.min(requestedCount, geometryCount) - 1;
}

function overscanInsets(value) {
  if (typeof value === "number") {
    const amount = numericMetric(value, 0);
    return { top: amount, bottom: amount, left: amount, right: amount };
  }
  const all = numericMetric(value?.all ?? value?.overscan, 0);
  return {
    top: numericMetric(value?.top, all),
    bottom: numericMetric(value?.bottom, all),
    left: numericMetric(value?.left, all),
    right: numericMetric(value?.right, all),
  };
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
  const target = Math.max(0, finiteCoordinate(coordinate));
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
  const rowHeaderWidth = numericMetric(metrics?.rowHeaderWidth, 0);
  const columnHeaderHeight = numericMetric(metrics?.columnHeaderHeight, 0);
  const bodyLeftInset = numericMetric(metrics?.bodyLeftInset, 0);
  const bodyTopInset = numericMetric(metrics?.bodyTopInset, 0);
  const rowMax = axisMax(rowCount, rowGeometry);
  const columnMax = axisMax(columnCount, columnGeometry);
  if (rowMax < 0 || columnMax < 0) {
    return { rowStart: 0, rowEnd: -1, columnStart: 0, columnEnd: -1 };
  }
  const padding = overscanInsets(overscan);
  const scrollTop = Math.max(0, finiteCoordinate(viewport?.scrollTop));
  const scrollLeft = Math.max(0, finiteCoordinate(viewport?.scrollLeft));
  const height = Math.max(0, finiteCoordinate(viewport?.height));
  const width = Math.max(0, finiteCoordinate(viewport?.width));
  return {
    rowStart: clamp(
      firstVisiblePosition(rowGeometry.offsets, scrollTop - columnHeaderHeight - bodyTopInset) - padding.top,
      0,
      rowMax,
    ),
    rowEnd: clamp(
      firstVisiblePosition(
        rowGeometry.offsets,
        scrollTop + height - columnHeaderHeight - bodyTopInset,
      ) + padding.bottom,
      0,
      rowMax,
    ),
    columnStart: clamp(
      firstVisiblePosition(columnGeometry.offsets, scrollLeft - rowHeaderWidth - bodyLeftInset) - padding.left,
      0,
      columnMax,
    ),
    columnEnd: clamp(
      firstVisiblePosition(
        columnGeometry.offsets,
        scrollLeft + width - rowHeaderWidth - bodyLeftInset,
      ) + padding.right,
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
  const rowMax = axisMax(rowCount);
  const columnMax = axisMax(columnCount);
  const amount = Math.max(0, Number(padding) || 0);
  if (!range || rowMax < 0 || columnMax < 0) {
    return { rowStart: 0, rowEnd: -1, columnStart: 0, columnEnd: -1 };
  }
  return {
    rowStart: clamp(range.rowStart - amount, 0, rowMax),
    rowEnd: clamp(range.rowEnd + amount, 0, rowMax),
    columnStart: clamp(range.columnStart - amount, 0, columnMax),
    columnEnd: clamp(range.columnEnd + amount, 0, columnMax),
  };
}

export function directionalOverscan(metrics, delta, baseOverscan) {
  const base = numericMetric(baseOverscan, 0);
  const rowHeight = Math.max(1, numericMetric(metrics?.rowHeight, SHEET_METRICS.rowHeight));
  const columnWidth = Math.max(1, numericMetric(metrics?.columnWidth, SHEET_METRICS.columnWidth));
  const scrollTop = finiteCoordinate(delta?.scrollTop);
  const scrollLeft = finiteCoordinate(delta?.scrollLeft);
  const ahead = (distance, itemSize) => Math.min(
    base + MAX_DIRECTIONAL_AHEAD,
    base + Math.ceil(Math.abs(distance) / itemSize),
  );
  return {
    top: scrollTop < 0 ? ahead(scrollTop, rowHeight) : base,
    bottom: scrollTop > 0 ? ahead(scrollTop, rowHeight) : base,
    left: scrollLeft < 0 ? ahead(scrollLeft, columnWidth) : base,
    right: scrollLeft > 0 ? ahead(scrollLeft, columnWidth) : base,
  };
}

function initialViewportFor(viewStateKey) {
  const saved = viewStateKey ? SUSPENDED_SHEET_VIEW.get(viewStateKey) : null;
  return {
    // A sheet can move between the base layer and a floating layer while
    // In & Out closes. Reuse its last measured viewport so the first paint
    // after that move keeps the same virtual row window instead of briefly
    // rendering only the default fallback.
    width: Math.max(1, finiteCoordinate(saved?.width, 900)),
    height: Math.max(1, finiteCoordinate(saved?.height, 500)),
    scrollLeft: Math.max(0, finiteCoordinate(saved?.scrollLeft)),
    scrollTop: Math.max(0, finiteCoordinate(saved?.scrollTop)),
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
      bodyLeftInset: customMetrics?.bodyLeftInset ?? SHEET_METRICS.bodyLeftInset,
      bodyTopInset: customMetrics?.bodyTopInset ?? SHEET_METRICS.bodyTopInset,
      overscan,
      overscanHysteresis: numericMetric(
        customMetrics?.overscanHysteresis,
        SHEET_METRICS.overscanHysteresis,
      ),
    };
  }, [
    customMetrics?.columnHeaderHeight,
    customMetrics?.bodyLeftInset,
    customMetrics?.bodyTopInset,
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
  const pendingViewportRef = useRef(null);
  const syncViewportRef = useRef(null);
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
  const buildRenderRange = useCallback((viewport, overscan = renderOverscan) => buildVirtualRange(
    rowGeometry,
    columnGeometry,
    rowIndexMap.length,
    columnIndexMap.length,
    metrics,
    viewportForRange(viewport),
    overscan,
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

  const syncScrollStyles = useCallback((element, position = nativeScrollPosition(element)) => {
    if (!element) return;
    scrollPositionRef.current = position;
    element.style.setProperty("--sheet-scroll-x", `${position.scrollLeft}px`);
    element.style.setProperty("--sheet-scroll-y", `${position.scrollTop}px`);
  }, []);

  const scheduleViewportMemory = useCallback((viewport) => {
    if (!viewStateKey) return;
    pendingViewportRef.current = viewport;
    if (memoryFrameRef.current != null) return;
    memoryFrameRef.current = window.requestAnimationFrame(() => {
      memoryFrameRef.current = null;
      const latest = pendingViewportRef.current;
      pendingViewportRef.current = null;
      rememberSheetViewport(viewStateKey, latest);
    });
  }, [viewStateKey]);

  const syncViewport = useCallback((element, { forceRange = false, immediateRange = false } = {}) => {
    if (!element) return;
    const previousPosition = scrollPositionRef.current;
    const position = nativeScrollPosition(element);
    const delta = {
      scrollLeft: position.scrollLeft - previousPosition.scrollLeft,
      scrollTop: position.scrollTop - previousPosition.scrollTop,
    };
    syncScrollStyles(element, position);
    const next = {
      width: Math.max(1, element.clientWidth || viewportSizeRef.current.width || 900),
      height: Math.max(1, element.clientHeight || viewportSizeRef.current.height || 500),
      ...position,
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
    const nextRange = buildRenderRange(next, directionalOverscan(metrics, delta, renderOverscan));
    if (!forceRange
      && rangeContains(rangeRef.current, visibleRange)
      && rangeContains(rangeRef.current, nextRange)) return;
    const update = () => commitRange(nextRange);
    if (immediateRange) flushSync(update);
    else update();
  }, [buildRenderRange, buildVisibleRange, commitRange, metrics, renderOverscan, scheduleViewportMemory, syncScrollStyles]);

  syncViewportRef.current = syncViewport;

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;
    const saved = viewStateKey ? SUSPENDED_SHEET_VIEW.get(viewStateKey) : null;
    if (saved) {
      element.scrollLeft = Math.max(0, finiteCoordinate(saved.scrollLeft));
      element.scrollTop = Math.max(0, finiteCoordinate(saved.scrollTop));
    }

    const handleNativeScroll = () => {
      syncViewportRef.current?.(element, { immediateRange: true });
    };
    handleNativeScroll();
    element.addEventListener("scroll", handleNativeScroll, { passive: true });

    const observer = typeof ResizeObserver === "function"
      ? new ResizeObserver(() => syncViewportRef.current?.(element))
      : null;
    observer?.observe(element);
    return () => {
      observer?.disconnect();
      element.removeEventListener("scroll", handleNativeScroll);
    };
  }, [viewStateKey]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;
    syncViewportRef.current?.(element);
    return undefined;
  }, [range]);

  useEffect(() => () => {
    if (memoryFrameRef.current != null) window.cancelAnimationFrame(memoryFrameRef.current);
    pendingViewportRef.current = null;
  }, []);

  const onScroll = useCallback((event) => {
    const element = event?.currentTarget || scrollRef.current;
    syncViewport(element, { immediateRange: true });
  }, [syncViewport]);

  const canvasSize = useMemo(() => ({
    width: metrics.rowHeaderWidth + metrics.bodyLeftInset + columnGeometry.total,
    height: metrics.columnHeaderHeight + metrics.bodyTopInset + rowGeometry.total,
  }), [columnGeometry.total, metrics.bodyLeftInset, metrics.bodyTopInset, metrics.columnHeaderHeight, metrics.rowHeaderWidth, rowGeometry.total]);

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
