export const PERFORMANCE_SCHEMA_VERSION = 1;

export const DEFAULT_REGRESSION_TOLERANCE = 0.1;

export function percentile(values, percentileValue = 0.95) {
  const numbers = values
    .filter((value) => Number.isFinite(value))
    .slice()
    .sort((a, b) => a - b);
  if (!numbers.length) return null;
  const index = Math.min(numbers.length - 1, Math.max(0, Math.ceil(numbers.length * percentileValue) - 1));
  return numbers[index];
}

export function average(values) {
  const numbers = values.filter((value) => Number.isFinite(value));
  return numbers.length ? numbers.reduce((total, value) => total + value, 0) / numbers.length : null;
}

export function maxValue(values) {
  const numbers = values.filter((value) => Number.isFinite(value));
  return numbers.length ? Math.max(...numbers) : null;
}

export function summarizeInstrumentation(raw = {}) {
  const frameTimes = Array.isArray(raw.frameTimes) ? raw.frameTimes : [];
  const longTaskDurations = Array.isArray(raw.longTaskDurations) ? raw.longTaskDurations : [];
  const inputLatencies = Array.isArray(raw.inputLatencies) ? raw.inputLatencies : [];
  return {
    label: raw.label || "unknown",
    durationMs: Number.isFinite(raw.durationMs) ? raw.durationMs : null,
    frameTimeMs: {
      samples: frameTimes.length,
      average: average(frameTimes),
      p95: percentile(frameTimes),
      max: maxValue(frameTimes),
      droppedFrameSamples: frameTimes.filter((value) => value > 16.7).length,
    },
    longTasks: {
      observable: raw.longTasksObservable !== false,
      count: longTaskDurations.length,
      totalDurationMs: longTaskDurations.length ? longTaskDurations.reduce((total, value) => total + value, 0) : 0,
      maxDurationMs: maxValue(longTaskDurations),
      over50Ms: longTaskDurations.filter((value) => value > 50).length,
    },
    inputLatencyMs: {
      observable: raw.inputLatencyObservable !== false,
      samples: inputLatencies.length,
      p95: percentile(inputLatencies),
      max: maxValue(inputLatencies),
    },
    react: {
      commitCount: Number.isFinite(raw.reactCommitCount) ? raw.reactCommitCount : null,
      commitCountObservable: raw.reactCommitCountObservable === true,
      domMutationBatches: Number.isFinite(raw.domMutationBatches) ? raw.domMutationBatches : null,
    },
    mounted: {
      cellsMax: Number.isFinite(raw.maxMountedCells) ? raw.maxMountedCells : null,
      sheetCellsMax: Number.isFinite(raw.maxMountedSheetCells) ? raw.maxMountedSheetCells : null,
      domNodesMax: Number.isFinite(raw.maxDomNodes) ? raw.maxDomNodes : null,
    },
    resources: raw.resources || null,
    runtimeCounts: raw.runtimeCounts || null,
    memory: raw.memory || null,
  };
}

export function createMeasurementInitScript() {
  return `(${instrumentationSource.toString()})();`;
}

function instrumentationSource() {
  if (window.__tactilePerf) return;

  const state = {
    current: null,
    lastResult: null,
    original: {},
    counts: {
      listeners: 0,
      mutationObservers: 0,
      resizeObservers: 0,
      intersectionObservers: 0,
      performanceObservers: 0,
      timers: new Set(),
      intervals: new Set(),
      animationFrames: new Set(),
    },
    listenerRecords: new WeakMap(),
    observerRecords: new WeakMap(),
    internalDepth: 0,
  };

  state.reactCommitCount = 0;
  state.reactCommitCountObservable = false;

  const isInternal = () => state.internalDepth > 0;
  const withInternal = (callback) => {
    state.internalDepth += 1;
    try {
      return callback();
    } finally {
      state.internalDepth -= 1;
    }
  };

  if (window.EventTarget?.prototype) {
    state.original.addEventListener = EventTarget.prototype.addEventListener;
    state.original.removeEventListener = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function addEventListener(type, listener, options) {
      if (!isInternal()) {
        state.counts.listeners += 1;
        let records = state.listenerRecords.get(this);
        if (!records) {
          records = new Map();
          state.listenerRecords.set(this, records);
        }
        const key = `${String(type)}|${String(Boolean(options && typeof options === "object" ? options.capture : options))}|${String(listener)}`;
        records.set(key, (records.get(key) || 0) + 1);
      }
      return state.original.addEventListener.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function removeEventListener(type, listener, options) {
      if (!isInternal()) {
        const records = state.listenerRecords.get(this);
        const key = `${String(type)}|${String(Boolean(options && typeof options === "object" ? options.capture : options))}|${String(listener)}`;
        const count = records?.get(key) || 0;
        if (count > 0) {
          state.counts.listeners = Math.max(0, state.counts.listeners - 1);
          if (count === 1) records.delete(key);
          else records.set(key, count - 1);
        }
      }
      return state.original.removeEventListener.call(this, type, listener, options);
    };
  }

  const patchObserver = (name, countKey) => {
    const Original = window[name];
    if (!Original) return;
    window[name] = class InstrumentedObserver extends Original {
      constructor(...args) {
        super(...args);
        if (!isInternal()) {
          state.counts[countKey] += 1;
          state.observerRecords.set(this, true);
        }
      }

      disconnect(...args) {
        if (state.observerRecords.get(this)) {
          state.observerRecords.delete(this);
          state.counts[countKey] = Math.max(0, state.counts[countKey] - 1);
        }
        return super.disconnect(...args);
      }
    };
  };

  patchObserver("MutationObserver", "mutationObservers");
  patchObserver("ResizeObserver", "resizeObservers");
  patchObserver("IntersectionObserver", "intersectionObservers");
  patchObserver("PerformanceObserver", "performanceObservers");

  state.original.setTimeout = window.setTimeout?.bind(window);
  state.original.clearTimeout = window.clearTimeout?.bind(window);
  state.original.setInterval = window.setInterval?.bind(window);
  state.original.clearInterval = window.clearInterval?.bind(window);
  state.original.requestAnimationFrame = window.requestAnimationFrame?.bind(window);
  state.original.cancelAnimationFrame = window.cancelAnimationFrame?.bind(window);

  if (state.original.setTimeout) {
    window.setTimeout = (callback, delay, ...args) => {
      let timerId;
      const wrapped = (...callbackArgs) => {
        state.counts.timers.delete(timerId);
        callback(...callbackArgs);
      };
      timerId = state.original.setTimeout(wrapped, delay, ...args);
      if (!isInternal()) state.counts.timers.add(timerId);
      return timerId;
    };
    window.clearTimeout = (timerId) => {
      state.counts.timers.delete(timerId);
      return state.original.clearTimeout(timerId);
    };
  }
  if (state.original.setInterval) {
    window.setInterval = (callback, delay, ...args) => {
      const timerId = state.original.setInterval(callback, delay, ...args);
      if (!isInternal()) state.counts.intervals.add(timerId);
      return timerId;
    };
    window.clearInterval = (timerId) => {
      state.counts.intervals.delete(timerId);
      return state.original.clearInterval(timerId);
    };
  }
  if (state.original.requestAnimationFrame) {
    window.requestAnimationFrame = (callback) => {
      let frameId;
      const wrapped = (timestamp) => {
        state.counts.animationFrames.delete(frameId);
        callback(timestamp);
      };
      frameId = state.original.requestAnimationFrame(wrapped);
      if (!isInternal()) state.counts.animationFrames.add(frameId);
      return frameId;
    };
    window.cancelAnimationFrame = (frameId) => {
      state.counts.animationFrames.delete(frameId);
      return state.original.cancelAnimationFrame(frameId);
    };
  }

  const countDom = () => ({
    domNodes: document.getElementsByTagName("*").length,
    mountedCells: document.querySelectorAll(".virtual-cell-slot").length,
    mountedSheetCells: document.querySelectorAll(".sheet-cell").length,
  });

  const runtimeCounts = () => ({
    listeners: state.counts.listeners,
    mutationObservers: state.counts.mutationObservers,
    resizeObservers: state.counts.resizeObservers,
    intersectionObservers: state.counts.intersectionObservers,
    performanceObservers: state.counts.performanceObservers,
    timers: state.counts.timers.size,
    intervals: state.counts.intervals.size,
    animationFrames: state.counts.animationFrames.size,
  });

  const memorySnapshot = async () => {
    if (performance.memory) {
      return {
        observable: true,
        source: "performance.memory",
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      };
    }
    if (typeof performance.measureUserAgentSpecificMemory === "function") {
      try {
        const result = await performance.measureUserAgentSpecificMemory();
        return { observable: true, source: "measureUserAgentSpecificMemory", ...result };
      } catch (error) {
        return { observable: false, reason: error?.message || "memory measurement denied" };
      }
    }
    return { observable: false, reason: "browser does not expose JavaScript heap measurement" };
  };

  const stop = async () => {
    const current = state.current;
    if (!current) return state.lastResult;
    current.running = false;
    if (current.frameId != null) window.cancelAnimationFrame(current.frameId);
    current.longTaskObserver?.disconnect();
    current.eventObserver?.disconnect();
    current.mutationObserver?.disconnect();
    withInternal(() => state.original.removeEventListener?.call(document, "keydown", current.inputListener, true));
    const end = performance.now();
    const memory = await memorySnapshot();
    const result = {
      label: current.label,
      durationMs: end - current.startedAt,
      frameTimes: current.frameTimes,
      longTaskDurations: current.longTaskDurations,
      longTasksObservable: current.longTasksObservable,
      inputLatencies: current.inputLatencies,
      inputLatencyObservable: current.inputLatencyObservable,
      reactCommitCount: current.reactCommitStart == null ? null : state.reactCommitCount - current.reactCommitStart,
      reactCommitCountObservable: state.reactCommitCountObservable,
      domMutationBatches: current.domMutationBatches,
      maxMountedCells: current.maxMountedCells,
      maxMountedSheetCells: current.maxMountedSheetCells,
      maxDomNodes: current.maxDomNodes,
      runtimeCounts: runtimeCounts(),
      memory,
    };
    state.current = null;
    state.lastResult = result;
    return result;
  };

  const recordReactCommit = (hook, originalCommit) => {
    try {
      hook.onCommitFiberRoot = function onCommitFiberRoot(...args) {
        state.reactCommitCount += 1;
        state.reactCommitCountObservable = true;
        if (typeof originalCommit === "function") return originalCommit.apply(this, args);
        return undefined;
      };
      return true;
    } catch {
      return false;
    }
  };

  let reactHook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!reactHook) {
    let nextRendererId = 0;
    reactHook = {
      isDisabled: false,
      supportsFiber: true,
      renderers: new Map(),
      inject(internals) {
        const rendererId = ++nextRendererId;
        this.renderers.set(rendererId, internals);
        return rendererId;
      },
      onCommitFiberUnmount() {},
    };
    try {
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = reactHook;
    } catch {
      reactHook = null;
    }
  }
  if (reactHook) {
    recordReactCommit(reactHook, reactHook.onCommitFiberRoot);
  }

  window.__tactilePerf = {
    start(label = "scenario") {
      if (state.current) throw new Error("A performance scenario is already running.");
      const current = {
        label,
        startedAt: performance.now(),
        lastFrame: null,
        frameId: null,
        running: true,
        frameTimes: [],
        longTaskDurations: [],
        longTasksObservable: false,
        inputLatencies: [],
        inputLatencyObservable: false,
        domMutationBatches: 0,
        maxMountedCells: 0,
        maxMountedSheetCells: 0,
        maxDomNodes: 0,
        reactCommitStart: state.reactCommitCountObservable ? state.reactCommitCount : null,
      };
      state.current = current;

      const sample = (timestamp) => {
        if (!current.running) return;
        if (current.lastFrame != null) current.frameTimes.push(timestamp - current.lastFrame);
        current.lastFrame = timestamp;
        const dom = countDom();
        current.maxMountedCells = Math.max(current.maxMountedCells, dom.mountedCells);
        current.maxMountedSheetCells = Math.max(current.maxMountedSheetCells, dom.mountedSheetCells);
        current.maxDomNodes = Math.max(current.maxDomNodes, dom.domNodes);
        current.frameId = window.requestAnimationFrame(sample);
      };

      const inputListener = () => {
        const started = performance.now();
        window.requestAnimationFrame(() => {
          if (current.running) current.inputLatencies.push(performance.now() - started);
        });
      };
      current.inputListener = inputListener;
      withInternal(() => state.original.addEventListener?.call(document, "keydown", inputListener, true));
      current.inputLatencyObservable = true;

      if (typeof PerformanceObserver === "function") {
        try {
          current.longTaskObserver = withInternal(
            () =>
              new PerformanceObserver((list) => {
                list.getEntries().forEach((entry) => current.longTaskDurations.push(entry.duration));
              }),
          );
          current.longTaskObserver.observe({ type: "longtask", buffered: true });
          current.longTasksObservable = true;
        } catch {
          current.longTasksObservable = false;
        }
        try {
          current.eventObserver = withInternal(
            () =>
              new PerformanceObserver((list) => {
                list.getEntries().forEach((entry) => {
                  if (entry.name === "keydown" || entry.name === "input" || entry.name === "click") {
                    current.inputLatencies.push(entry.duration);
                  }
                });
              }),
          );
          current.eventObserver.observe({ type: "event", buffered: true, durationThreshold: 0 });
          current.inputLatencyObservable = true;
        } catch {
          // Event Timing is not exposed in every browser.
        }
      }

      current.mutationObserver = withInternal(
        () =>
          new MutationObserver(() => {
            if (current.running) current.domMutationBatches += 1;
          }),
      );
      current.mutationObserver.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
      current.frameId = window.requestAnimationFrame(sample);
      return { label, startedAt: current.startedAt };
    },
    stop,
    snapshot() {
      return {
        lastResult: state.lastResult,
        runtimeCounts: runtimeCounts(),
        dom: countDom(),
        reactCommitCount: state.reactCommitCountObservable ? state.reactCommitCount : null,
        reactCommitCountObservable: state.reactCommitCountObservable,
      };
    },
  };
}

export function comparePerformanceResults(baseline, candidate, tolerance = DEFAULT_REGRESSION_TOLERANCE) {
  const metricPaths = [
    ["scroll.frameTimeMs.p95", ["scenarios", "scroll", "frameTimeMs", "p95"]],
    ["scroll.longTasks.maxDurationMs", ["scenarios", "scroll", "longTasks", "maxDurationMs"]],
    ["typing.inputLatencyMs.p95", ["scenarios", "typing", "inputLatencyMs", "p95"]],
    ["scroll.mounted.cellsMax", ["scenarios", "scroll", "mounted", "cellsMax"]],
    ["scroll.runtimeCounts.listeners", ["scenarios", "scroll", "runtimeCounts", "listeners"]],
    ["nested.runtimeCounts.listeners", ["scenarios", "nested", "runtimeCounts", "listeners"]],
    ["bundle.javascript.gzipBytes", ["bundle", "javascript", "gzipBytes"]],
    ["bundle.css.gzipBytes", ["bundle", "css", "gzipBytes"]],
  ];
  const read = (value, path) => path.reduce((current, key) => current?.[key], value);
  const comparisons = metricPaths.map(([name, path]) => {
    const before = read(baseline, path);
    const after = read(candidate, path);
    if (!Number.isFinite(before) || !Number.isFinite(after)) {
      return { name, status: "unmeasurable", baseline: before ?? null, candidate: after ?? null };
    }
    const allowed = before === 0 ? 0 : before * (1 + tolerance);
    const passed = after <= allowed;
    return {
      name,
      status: passed ? "pass" : "regression",
      baseline: before,
      candidate: after,
      allowed,
      deltaRatio: before === 0 ? (after === 0 ? 0 : Infinity) : (after - before) / before,
    };
  });
  return {
    tolerance,
    passed: comparisons.every((comparison) => comparison.status !== "regression"),
    comparisons,
  };
}
