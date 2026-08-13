export const PERFORMANCE_SCHEMA_VERSION = 2;

export const DEFAULT_REGRESSION_TOLERANCE = 0.1;

export const RELEASE_BUDGETS = Object.freeze({
  frameTimeP95Ms: 16.7,
  inputToPaintP95Ms: 50,
  repeatedMainThreadTaskMs: 50,
  initialJavascriptGzipBytes: 110 * 1024,
  cssGzipBytes: 18 * 1024,
});

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
    runtimeBaseline: raw.runtimeBaseline || null,
    runtimeCounts: raw.runtimeCounts || null,
    runtimeDelta: raw.runtimeDelta || null,
    leakChecks: raw.leakChecks || null,
    memoryStart: raw.memoryStart || null,
    memory: raw.memory || null,
    memoryDeltaBytes: Number.isFinite(raw.memoryDeltaBytes) ? raw.memoryDeltaBytes : null,
  };
}

function budgetCheck(name, observed, budget, unit) {
  if (!Number.isFinite(observed)) {
    return { name, status: "unmeasurable", observed: null, budget, unit };
  }
  return {
    name,
    status: observed <= budget ? "pass" : "fail",
    observed,
    budget,
    unit,
    delta: observed - budget,
  };
}

function runtimeLeakCheck(name, leakChecks) {
  if (!leakChecks?.runtime?.observable) {
    return { name, status: "unmeasurable", observed: null, budget: 0, unit: "active resources" };
  }
  const leakedResources = leakChecks.runtime.leakedResources || [];
  return {
    name,
    status: leakedResources.length === 0 ? "pass" : "fail",
    observed: leakedResources,
    budget: 0,
    unit: "positive resource delta",
  };
}

export function evaluatePerformanceCertification(result, budgets = RELEASE_BUDGETS) {
  const checks = [];
  const blockers = [];
  const interactiveScenarios = ["scroll", "typing", "in-out", "nested"];

  if (result?.status !== "measured") {
    blockers.push(`Browser run status is ${result?.status || "unknown"}.`);
  }
  if (result?.fixture?.valid !== true) {
    blockers.push("The deterministic performance fixture did not validate.");
  }

  for (const label of interactiveScenarios) {
    const scenario = result?.scenarios?.[label];
    if (!scenario) {
      blockers.push(`Missing measured scenario: ${label}.`);
      checks.push({ name: `${label}.measurement`, status: "unmeasurable", observed: null });
      continue;
    }
    if (scenario.actionError) blockers.push(`${label} action failed: ${scenario.actionError}`);
    checks.push(budgetCheck(`${label}.frameTimeMs.p95`, scenario.frameTimeMs?.p95, budgets.frameTimeP95Ms, "ms"));
    checks.push(
      budgetCheck(
        `${label}.longTasks.over50Ms`,
        scenario.longTasks?.over50Ms,
        0,
        `count of tasks over ${budgets.repeatedMainThreadTaskMs} ms`,
      ),
    );
    if (label !== "scroll") {
      checks.push(
        budgetCheck(`${label}.inputLatencyMs.p95`, scenario.inputLatencyMs?.p95, budgets.inputToPaintP95Ms, "ms"),
      );
    }
    checks.push(runtimeLeakCheck(`${label}.runtimeLeaks`, scenario.leakChecks));
  }

  checks.push(
    budgetCheck(
      "bundle.javascript.gzipBytes",
      result?.bundle?.javascript?.gzipBytes,
      budgets.initialJavascriptGzipBytes,
      "bytes across all client JavaScript output",
    ),
  );
  checks.push(
    budgetCheck(
      "bundle.css.gzipBytes",
      result?.bundle?.css?.gzipBytes,
      budgets.cssGzipBytes,
      "bytes across all client CSS output",
    ),
  );

  const teardown = result?.teardown;
  checks.push(runtimeLeakCheck("teardown.runtimeLeaks", teardown?.leakChecks));
  if (teardown?.leakChecks?.memory?.observable !== true) {
    blockers.push("Final memory measurement was unavailable; leak certification is blocked.");
  }

  for (const check of checks) {
    if (check.status === "unmeasurable") blockers.push(`${check.name} was not measurable.`);
  }

  const failedChecks = checks.filter((check) => check.status === "fail");
  const unmeasurableChecks = checks.filter((check) => check.status === "unmeasurable");
  const status = blockers.length ? "blocked" : failedChecks.length ? "fail" : "pass";
  return {
    status,
    passed: status === "pass",
    releaseBudgets: budgets,
    checks,
    failedChecks,
    unmeasurableChecks,
    blockers: [...new Set(blockers)],
    memory: teardown?.leakChecks?.memory || null,
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
  state.referenceRuntime = null;
  state.referenceMemory = null;
  state.referenceLabel = null;

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
        let records = state.listenerRecords.get(this);
        if (!records) {
          records = new Map();
          state.listenerRecords.set(this, records);
        }
        const key = `${String(type)}|${String(Boolean(options && typeof options === "object" ? options.capture : options))}`;
        let listeners = records.get(key);
        if (!listeners) {
          listeners = new Set();
          records.set(key, listeners);
        }
        if (!listeners.has(listener)) {
          listeners.add(listener);
          state.counts.listeners += 1;
        }
      }
      return state.original.addEventListener.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function removeEventListener(type, listener, options) {
      if (!isInternal()) {
        const records = state.listenerRecords.get(this);
        const key = `${String(type)}|${String(Boolean(options && typeof options === "object" ? options.capture : options))}`;
        const listeners = records?.get(key);
        if (listeners?.has(listener)) {
          listeners.delete(listener);
          state.counts.listeners = Math.max(0, state.counts.listeners - 1);
          if (listeners.size === 0) records.delete(key);
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

  const runtimeKeys = [
    "listeners",
    "mutationObservers",
    "resizeObservers",
    "intersectionObservers",
    "performanceObservers",
    "timers",
    "intervals",
    "animationFrames",
  ];

  const runtimeDelta = (before, after) =>
    Object.fromEntries(runtimeKeys.map((key) => [key, (after?.[key] || 0) - (before?.[key] || 0)]));

  const memoryBytes = (snapshot) => {
    if (!snapshot || snapshot.observable !== true) return null;
    if (Number.isFinite(snapshot.usedJSHeapSize)) return snapshot.usedJSHeapSize;
    if (Number.isFinite(snapshot.bytes)) return snapshot.bytes;
    return null;
  };

  const makeLeakChecks = (before, after, memoryBefore, memoryAfter) => {
    const delta = before && after ? runtimeDelta(before, after) : null;
    const leakedResources = delta
      ? runtimeKeys.filter((key) => delta[key] > 0).map((key) => ({ resource: key, delta: delta[key] }))
      : null;
    const memoryBeforeBytes = memoryBytes(memoryBefore);
    const memoryAfterBytes = memoryBytes(memoryAfter);
    return {
      runtime: {
        observable: Boolean(delta),
        clean: Boolean(delta) && leakedResources.length === 0,
        leakedResources,
      },
      memory: {
        observable: memoryBefore?.observable === true && memoryAfter?.observable === true,
        startBytes: memoryBeforeBytes,
        endBytes: memoryAfterBytes,
        deltaBytes:
          Number.isFinite(memoryBeforeBytes) && Number.isFinite(memoryAfterBytes)
            ? memoryAfterBytes - memoryBeforeBytes
            : null,
      },
    };
  };

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
    const runtime = runtimeCounts();
    const memory = await memorySnapshot();
    const runtimeDeltaValue = current.runtimeBaseline ? runtimeDelta(current.runtimeBaseline, runtime) : null;
    const leakChecks = makeLeakChecks(current.runtimeBaseline, runtime, current.memoryStart, memory);
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
      runtimeBaseline: current.runtimeBaseline,
      runtimeCounts: runtime,
      runtimeDelta: runtimeDeltaValue,
      leakChecks,
      memoryStart: current.memoryStart,
      memory,
      memoryDeltaBytes: leakChecks.memory.deltaBytes,
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
    async start(label = "scenario") {
      if (state.current) throw new Error("A performance scenario is already running.");
      const runtimeBaseline = state.referenceRuntime ? { ...state.referenceRuntime } : runtimeCounts();
      const memoryStart = state.referenceMemory || (await memorySnapshot());
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
        runtimeBaseline,
        memoryStart,
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
          // A scenario must measure only work that starts after start(). A
          // buffered observer would attribute fixture-import work to the
          // following scroll/typing scenario and inflate its p95.
          current.longTaskObserver.observe({ type: "longtask", buffered: false });
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
          current.eventObserver.observe({ type: "event", buffered: false, durationThreshold: 0 });
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
    async markBaseline(label = "reference") {
      state.referenceRuntime = runtimeCounts();
      state.referenceMemory = await memorySnapshot();
      state.referenceLabel = label;
      return {
        label,
        runtime: state.referenceRuntime,
        memory: state.referenceMemory,
      };
    },
    async snapshot() {
      const runtime = runtimeCounts();
      const memory = await memorySnapshot();
      const lastResult = state.lastResult
        ? {
            label: state.lastResult.label,
            durationMs: state.lastResult.durationMs,
            frameSamples: state.lastResult.frameTimes?.length || 0,
            longTaskCount: state.lastResult.longTaskDurations?.length || 0,
            inputSamples: state.lastResult.inputLatencies?.length || 0,
            memoryDeltaBytes: state.lastResult.memoryDeltaBytes ?? null,
          }
        : null;
      return {
        lastResult,
        referenceLabel: state.referenceLabel,
        referenceRuntime: state.referenceRuntime,
        runtimeCounts: runtime,
        runtimeDelta: state.referenceRuntime ? runtimeDelta(state.referenceRuntime, runtime) : null,
        dom: countDom(),
        reactCommitCount: state.reactCommitCountObservable ? state.reactCommitCount : null,
        reactCommitCountObservable: state.reactCommitCountObservable,
        memory,
        leakChecks: makeLeakChecks(state.referenceRuntime, runtime, state.referenceMemory, memory),
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
