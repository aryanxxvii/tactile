import { useCallback, useEffect, useRef, useState } from "react";
import { materializeCell } from "../model.js";
import { coordinatesFromAddress } from "../sheet/coordinates.js";

export const IN_OUT_TIMING = {
  toFloating: 24,
  floatingToFull: 900,
  closeToOrigin: 460,
  closeComplete: 820,
  floatingCloseToOrigin: 24,
  floatingCloseComplete: 430,
};

export const HISTORY_KIND = "tactile-in-out";

export function historyUrlForStack(stack) {
  const url = new URL(window.location.href);
  ["in", "mode", "from", "cell", "depth"].forEach((key) => url.searchParams.delete(key));
  const top = stack[stack.length - 1];
  if (top) {
    url.searchParams.set("in", top.objectId);
    url.searchParams.set("mode", top.mode || "floating");
    if (top.sourceObjectId) url.searchParams.set("from", top.sourceObjectId);
    if (top.sourceAddress) url.searchParams.set("cell", top.sourceAddress);
    if (stack.length > 1) url.searchParams.set("depth", String(stack.length));
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function layerHistoryEntry(layer) {
  return {
    objectId: layer.objectId,
    sourceObjectId: layer.sourceObjectId,
    sourceAddress: layer.sourceAddress,
    sourceLabel: layer.sourceLabel,
    sourceType: layer.sourceType,
    mode: layer.phase === "full" ? "full" : "floating",
  };
}

export function historyStackFromState(state) {
  return state?.tactile === HISTORY_KIND && Array.isArray(state.tactileStack)
    ? state.tactileStack
    : [];
}

export function historyStackFromLocation(objects) {
  const url = new URL(window.location.href);
  const objectId = url.searchParams.get("in");
  const sourceObjectId = url.searchParams.get("from");
  const sourceAddress = url.searchParams.get("cell");
  if (!objectId || !sourceObjectId || !sourceAddress) return [];
  const sourceObject = objects?.[sourceObjectId];
  const coordinates = coordinatesFromAddress(sourceAddress);
  if (!sourceObject || !coordinates) return [];
  const sourceCell = materializeCell(sourceObject, coordinates.row, coordinates.column);
  const embedded = sourceCell?.embed;
  if (!embedded || embedded.objectId !== objectId) return [];
  return [{
    objectId,
    sourceObjectId,
    sourceAddress,
    sourceLabel: objects?.[objectId]?.title || sourceCell.value || "Embedded object",
    sourceType: embedded.type,
    mode: url.searchParams.get("mode") === "full" ? "full" : "floating",
  }];
}

function rectSnapshot(element) {
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

export function useInOut({ workspace, workspaceRootId }) {
  const [layers, setLayers] = useState([
    { key: "root", objectId: workspaceRootId, phase: "base", closing: false },
  ]);
  const timers = useRef(new Set());
  const layersRef = useRef(layers);
  const historySyncRef = useRef(0);
  const historyReadyRef = useRef(false);

  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  const schedule = useCallback((callback, delay) => {
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      callback();
    }, delay);
    timers.current.add(timer);
    return timer;
  }, []);

  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current.clear();
  }, []);

  useEffect(() => {
    setLayers((current) => (
      current[0]?.objectId === workspaceRootId
        ? current
        : [{ key: "root", objectId: workspaceRootId, phase: "base", closing: false }]
    ));
  }, [workspaceRootId]);

  const setLayerPhase = useCallback((key, phase, closing = false) => {
    setLayers((current) => current.map((layer) => (
      layer.key === key ? { ...layer, phase, closing } : layer
    )));
  }, []);

  const currentHistoryStack = useCallback(
    () => layersRef.current.slice(1).map(layerHistoryEntry),
    [],
  );

  const writeHistoryStack = useCallback((stack, replace = false) => {
    const nextState = {
      ...(window.history.state || {}),
      tactile: HISTORY_KIND,
      tactileStack: stack,
    };
    const method = replace ? "replaceState" : "pushState";
    window.history[method](nextState, "", historyUrlForStack(stack));
  }, []);

  const sourceElementForEntry = useCallback((entry) => {
    if (!entry?.sourceObjectId || !entry?.sourceAddress) return null;
    return document.querySelector(
      `[data-object-id="${entry.sourceObjectId}"][data-cell-address="${entry.sourceAddress}"]`,
    );
  }, []);

  const makeLayerFromEntry = useCallback((entry, key, sourceElement) => {
    const sourceRect = sourceElement
      ? rectSnapshot(sourceElement)
      : {
          left: Math.round(window.innerWidth * 0.5 - 42),
          top: Math.round(window.innerHeight * 0.5 - 18),
          width: 84,
          height: 36,
        };
    return {
      key,
      objectId: entry.objectId,
      sourceObjectId: entry.sourceObjectId,
      sourceAddress: entry.sourceAddress,
      sourceLabel: entry.sourceLabel,
      sourceType: entry.sourceType,
      sourceRect,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      openedAt: Date.now(),
      phase: "origin",
      requestedMode: entry.mode || "floating",
      closing: false,
    };
  }, []);

  const openObject = useCallback((payload) => {
    if (!payload.objectId) return;
    const sourceElement = payload.sourceElement || null;
    if (!sourceElement && !payload.sourceRect) return;

    const currentTop = layersRef.current[layersRef.current.length - 1];
    const reopensCurrentLayer = currentTop
      && currentTop.phase !== "base"
      && !currentTop.closing
      && currentTop.objectId === payload.objectId
      && currentTop.sourceObjectId === payload.sourceObjectId
      && currentTop.sourceAddress === payload.sourceAddress;
    if (reopensCurrentLayer) {
      if (payload.mode === "full" && currentTop.phase !== "full") {
        const stack = currentHistoryStack();
        if (stack.length) {
          stack[stack.length - 1] = { ...stack[stack.length - 1], mode: "full" };
          writeHistoryStack(stack);
        }
        setLayers((items) => items.map((layer) => (
          layer.key === currentTop.key
            ? { ...layer, requestedMode: "full", fullHistoryStep: true }
            : layer
        )));
        const elapsed = Date.now() - (currentTop.openedAt || Date.now());
        schedule(
          () => setLayerPhase(currentTop.key, "full"),
          Math.max(0, IN_OUT_TIMING.floatingToFull - elapsed),
        );
      }
      return;
    }

    const entry = {
      objectId: payload.objectId,
      sourceObjectId: payload.sourceObjectId,
      sourceAddress: payload.sourceAddress,
      sourceLabel: payload.sourceLabel,
      sourceType: payload.sourceType,
      mode: payload.mode || "floating",
    };
    const stack = [...currentHistoryStack(), entry];
    writeHistoryStack(stack);

    const key = `layer-${payload.objectId}-${Date.now()}`;
    const layer = makeLayerFromEntry(entry, key, sourceElement);
    if (payload.sourceRect) layer.sourceRect = payload.sourceRect;
    setLayers((current) => [...current, layer]);
    schedule(() => setLayerPhase(key, "floating"), IN_OUT_TIMING.toFloating);
    if (layer.requestedMode === "full") {
      schedule(() => setLayerPhase(key, "full"), IN_OUT_TIMING.floatingToFull);
    }
  }, [currentHistoryStack, makeLayerFromEntry, schedule, setLayerPhase, writeHistoryStack]);

  const expandLayer = useCallback((key) => {
    const current = layersRef.current;
    const top = current[current.length - 1];
    if (!top || top.key !== key || top.phase !== "floating" || top.closing) return false;
    setLayers((items) => items.map((layer) => (
      layer.key === top.key
        ? { ...layer, phase: "full", closing: false, fullHistoryStep: true }
        : layer
    )));
    const stack = currentHistoryStack();
    if (stack.length) {
      stack[stack.length - 1] = { ...stack[stack.length - 1], mode: "full" };
      writeHistoryStack(stack);
    }
    return true;
  }, [currentHistoryStack, writeHistoryStack]);

  const expandTopLayer = useCallback(() => {
    const top = layersRef.current[layersRef.current.length - 1];
    return top ? expandLayer(top.key) : false;
  }, [expandLayer]);

  const closeLayerWithoutHistory = useCallback((layer) => {
    if (!layer || layer.phase === "base" || layer.closing) return;
    const closingFromFloating = layer.phase === "floating";
    if (!closingFromFloating) setLayerPhase(layer.key, "floating", true);
    schedule(
      () => setLayerPhase(layer.key, "origin", true),
      closingFromFloating ? IN_OUT_TIMING.floatingCloseToOrigin : IN_OUT_TIMING.closeToOrigin,
    );
    schedule(() => {
      setLayers((current) => current.filter((item) => item.key !== layer.key));
      const selector = `[data-object-id="${layer.sourceObjectId}"][data-cell-address="${layer.sourceAddress}"]`;
      document.querySelector(selector)?.focus({ preventScroll: true });
    }, closingFromFloating ? IN_OUT_TIMING.floatingCloseComplete : IN_OUT_TIMING.closeComplete);
  }, [schedule, setLayerPhase]);

  const closeTopLayer = useCallback(() => {
    const current = layersRef.current;
    const top = current[current.length - 1];
    if (!top || top.phase === "base" || top.closing) return;
    if (window.history.state?.tactile === HISTORY_KIND && currentHistoryStack().length) {
      const historyMode = historyStackFromState(window.history.state).at(-1)?.mode;
      window.history.go(historyMode === "full" && top.fullHistoryStep ? -2 : -1);
      return;
    }
    closeLayerWithoutHistory(top);
  }, [closeLayerWithoutHistory, currentHistoryStack]);

  const syncHistoryStack = useCallback((targetStack) => {
    const syncId = historySyncRef.current + 1;
    historySyncRef.current = syncId;

    const current = layersRef.current;
    let commonDepth = 0;
    while (
      commonDepth < current.length - 1
      && commonDepth < targetStack.length
      && current[commonDepth + 1].objectId === targetStack[commonDepth].objectId
    ) {
      commonDepth += 1;
    }

    const applyModes = () => {
      if (historySyncRef.current !== syncId) return;
      setLayers((items) => items.map((layer, index) => {
        if (index === 0) return { ...layer, phase: "base", closing: false };
        const entry = targetStack[index - 1];
        if (!entry) return layer;
        return {
          ...layer,
          requestedMode: entry.mode || "floating",
          phase: entry.mode === "full" ? "full" : "floating",
          closing: false,
        };
      }));
    };

    const appendNext = () => {
      if (historySyncRef.current !== syncId) return;
      const currentItems = layersRef.current;
      const nextIndex = currentItems.length - 1;
      const entry = targetStack[nextIndex];
      if (!entry) {
        applyModes();
        return;
      }
      const sourceElement = sourceElementForEntry(entry);
      const key = `history-${entry.objectId}-${Date.now()}-${nextIndex}`;
      const layer = makeLayerFromEntry(entry, key, sourceElement);
      setLayers((items) => [...items, layer]);
      schedule(() => setLayerPhase(key, "floating"), IN_OUT_TIMING.toFloating);
      const settleDelay = entry.mode === "full" ? IN_OUT_TIMING.floatingToFull : IN_OUT_TIMING.toFloating;
      if (entry.mode === "full") {
        schedule(() => setLayerPhase(key, "full"), IN_OUT_TIMING.floatingToFull);
      }
      schedule(appendNext, settleDelay + 30);
    };

    const closeUntil = () => {
      if (historySyncRef.current !== syncId) return;
      const currentItems = layersRef.current;
      if (currentItems.length - 1 <= commonDepth) {
        if (currentItems.length - 1 < targetStack.length) appendNext();
        else applyModes();
        return;
      }
      const top = currentItems[currentItems.length - 1];
      if (top.closing) return;
      const closingFromFloating = top.phase === "floating";
      if (!closingFromFloating) setLayerPhase(top.key, "floating", true);
      schedule(
        () => setLayerPhase(top.key, "origin", true),
        closingFromFloating ? IN_OUT_TIMING.floatingCloseToOrigin : IN_OUT_TIMING.closeToOrigin,
      );
      schedule(() => {
        if (historySyncRef.current !== syncId) return;
        setLayers((items) => items.filter((item) => item.key !== top.key));
        window.requestAnimationFrame(closeUntil);
      }, closingFromFloating ? IN_OUT_TIMING.floatingCloseComplete : IN_OUT_TIMING.closeComplete);
    };

    if (current.length - 1 > commonDepth) closeUntil();
    else if (current.length - 1 < targetStack.length) appendNext();
    else applyModes();
  }, [makeLayerFromEntry, schedule, setLayerPhase, sourceElementForEntry]);

  useEffect(() => {
    if (historyReadyRef.current) return;
    if (!workspace.objects?.[workspaceRootId]) return;
    let stack = historyStackFromState(window.history.state);
    if (!stack.length) stack = historyStackFromLocation(workspace.objects);
    const stateStack = historyStackFromState(window.history.state);
    if (window.history.state?.tactile !== HISTORY_KIND || stateStack.length !== stack.length) {
      window.history.replaceState(
        { ...(window.history.state || {}), tactile: HISTORY_KIND, tactileStack: stack },
        "",
        historyUrlForStack(stack),
      );
    }
    historyReadyRef.current = true;
    if (stack.length) syncHistoryStack(stack);
  }, [syncHistoryStack, workspace.objects, workspaceRootId]);

  useEffect(() => {
    const handlePopState = (event) => {
      syncHistoryStack(historyStackFromState(event.state));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [syncHistoryStack]);

  useEffect(() => {
    const handleOutsideFloatingPointer = (event) => {
      const top = layersRef.current[layersRef.current.length - 1];
      if (!top || top.phase !== "floating" || top.closing) return;
      if (event.target instanceof Element && event.target.closest(".object-window")) return;
      if (event.target instanceof Element && event.target.closest(".transition-backdrop")) return;
      closeTopLayer();
    };
    document.addEventListener("pointerdown", handleOutsideFloatingPointer, true);
    return () => document.removeEventListener("pointerdown", handleOutsideFloatingPointer, true);
  }, [closeTopLayer]);

  return {
    layers,
    layersRef,
    schedule,
    openObject,
    expandLayer,
    expandTopLayer,
    closeTopLayer,
  };
}
