import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { materializeCell } from "../model.js";
import { coordinatesFromAddress } from "../sheet/coordinates.js";
import {
  canonicalPathForObject,
  findEmbeddedEdge,
  pathEntryForEdge,
  routeFromLinkIds,
  TOPOLOGY_REVISION,
  validateNavigationRoute,
} from "../core/topology.js";

export const IN_OUT_TIMING = {
  toFloating: 32,
  floatingToFull: 520,
  nestedAdvance: 260,
  closeToOrigin: 460,
  closeComplete: 820,
  floatingCloseToOrigin: 24,
  floatingCloseComplete: 430,
};

export const MAX_VISIBLE_LAYERS = 2;

export const HISTORY_KIND = "tactile-in-out";

export function historyUrlForStack(stack, workspaceId = "", rootObjectId = "") {
  const url = new URL(window.location.href);
  ["in", "mode", "from", "cell", "depth", "workspace", "route", "root"].forEach((key) => url.searchParams.delete(key));
  const top = stack[stack.length - 1];
  if (workspaceId && (top || rootObjectId)) url.searchParams.set("workspace", workspaceId);
  if (rootObjectId) url.searchParams.set("root", rootObjectId);
  if (top) {
    url.searchParams.set("in", top.objectId);
    url.searchParams.set("mode", top.mode || "floating");
    if (top.sourceObjectId) url.searchParams.set("from", top.sourceObjectId);
    if (top.sourceAddress) url.searchParams.set("cell", top.sourceAddress);
    if (stack.length > 1) url.searchParams.set("depth", String(stack.length));
    const route = stack.map((entry) => entry.linkId).filter(Boolean);
    if (route.length === stack.length) url.searchParams.set("route", route.join(","));
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function layerHistoryEntry(layer) {
  return {
    objectId: layer.objectId,
    linkId: layer.linkId,
    sourceObjectId: layer.sourceObjectId,
    sourceCellId: layer.sourceCellId,
    sourceAddress: layer.sourceAddress,
    sourceLabel: layer.sourceLabel,
    sourceType: layer.sourceType,
    mode: layer.phase === "full" ? "full" : "floating",
  };
}

function validatedHomePath(objects, targetObjectId, path) {
  if (!Array.isArray(path) || !path.length) return null;
  const result = validateNavigationRoute(objects, path);
  return result.valid && result.stack.at(-1)?.objectId === targetObjectId
    ? result.stack
    : null;
}

export function deriveObjectPath(objects, targetObjectId) {
  return canonicalPathForObject(objects, targetObjectId);
}

export function resolveHomePath(objects, targetObjectId, savedPath = []) {
  const saved = validatedHomePath(objects, targetObjectId, savedPath);
  if (saved) {
    const prefix = deriveObjectPath(objects, saved[0].sourceObjectId);
    const combined = [...(prefix || []), ...saved];
    const validated = validatedHomePath(objects, targetObjectId, combined);
    if (validated) return validated;
  }
  return deriveObjectPath(objects, targetObjectId) || [];
}

function historyEntryForPath(objects, entry, mode = "full") {
  const sourceObject = objects?.[entry.sourceObjectId];
  const coordinates = coordinatesFromAddress(entry.sourceAddress);
  const sourceCell = coordinates
    ? materializeCell(sourceObject, coordinates.row, coordinates.column)
    : null;
  const object = objects?.[entry.objectId];
  return {
    ...entry,
    sourceLabel: object?.title || sourceCell?.value || "Embedded object",
    sourceType: sourceCell?.embed?.type || object?.type,
    mode,
  };
}

function stableHistoryStackFromLinkIds(objects, stack) {
  if (!Array.isArray(stack) || !stack.length || !stack.every((entry) => entry?.linkId)) return null;
  const routed = routeFromLinkIds(
    objects,
    stack.map((entry) => entry.linkId),
    stack.at(-1)?.mode === "full" ? "full" : "floating",
  );
  if (!routed.valid || routed.stack.length !== stack.length) return null;
  return routed.stack.map((entry, index) => historyEntryForPath(
    objects,
    entry,
    stack[index]?.mode === "full" ? "full" : "floating",
  ));
}

function rebaseHistoryStack(objects, stack) {
  const stableStack = stableHistoryStackFromLinkIds(objects, stack);
  if (!stableStack?.length) return stableStack;
  const prefix = canonicalPathForObject(objects, stableStack[0].sourceObjectId) || [];
  const combined = validateNavigationRoute(objects, [...prefix, ...stableStack]);
  if (!combined.valid || combined.stack.length !== prefix.length + stableStack.length) return null;
  const modes = new Map(stableStack.map((entry) => [entry.linkId, entry.mode]));
  return combined.stack.map((entry) => historyEntryForPath(
    objects,
    entry,
    modes.get(entry.linkId) || "full",
  ));
}

export function homeStackFromWorkspace(workspace) {
  return resolveHomePath(
    workspace?.objects,
    workspace?.homeObjectId,
    workspace?.homePath,
  ).map((entry) => historyEntryForPath(workspace.objects, entry));
}

export function historyStackFromState(state, objects = null, workspaceId = "") {
  if (state?.tactile !== HISTORY_KIND || !Array.isArray(state.tactileStack)) return [];
  if (workspaceId && state.tactileWorkspaceId && state.tactileWorkspaceId !== workspaceId) return [];
  if (!objects) return state.tactileStack;
  const stable = stableHistoryStackFromLinkIds(objects, state.tactileStack);
  if (stable) return stable;
  const result = validateNavigationRoute(objects, state.tactileStack);
  return result.stack.map((entry) => historyEntryForPath(objects, entry, entry.mode));
}

export function historyStackFromLocation(objects, workspaceId = "") {
  const url = new URL(window.location.href);
  if (workspaceId && url.searchParams.get("workspace") && url.searchParams.get("workspace") !== workspaceId) return [];
  const route = url.searchParams.get("route");
  if (route) {
    const routed = routeFromLinkIds(
      objects,
      route.split(",").filter(Boolean),
      url.searchParams.get("mode") === "full" ? "full" : "floating",
    );
    const rootObjectId = url.searchParams.get("root");
    if (routed.stack.length && (!rootObjectId || routed.stack[0].sourceObjectId === rootObjectId)) {
      return routed.stack.map((entry) => historyEntryForPath(objects, entry, entry.mode));
    }
  }
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
  const entry = {
    objectId,
    linkId: embedded.linkId,
    sourceObjectId,
    sourceCellId: sourceCell.id,
    sourceAddress,
    sourceLabel: objects?.[objectId]?.title || sourceCell.value || "Embedded object",
    sourceType: embedded.type,
    mode: url.searchParams.get("mode") === "full" ? "full" : "floating",
  };
  const prefix = deriveObjectPath(objects, sourceObjectId) || [];
  const result = validateNavigationRoute(objects, [
    ...prefix.map((pathEntry) => historyEntryForPath(objects, pathEntry)),
    entry,
  ]);
  return result.stack.map((pathEntry) => historyEntryForPath(objects, pathEntry, pathEntry.mode));
}

export function navigationRootFromState(state, objects, fallbackId) {
  const stateRoot = state?.tactileRootObjectId;
  if (stateRoot && objects?.[stateRoot]) return String(stateRoot);
  if (typeof window !== "undefined") {
    const urlRoot = new URL(window.location.href).searchParams.get("root");
    if (urlRoot && objects?.[urlRoot]) return String(urlRoot);
  }
  const stack = historyStackFromState(state, objects);
  const candidate = stack[0]?.sourceObjectId;
  return candidate && objects?.[candidate] ? candidate : fallbackId;
}

function locationHasExplicitRoot(objects) {
  if (typeof window === "undefined") return false;
  const root = new URL(window.location.href).searchParams.get("root");
  return Boolean(root && objects?.[root]);
}

function navigationStackForStartup(workspace) {
  if (typeof window === "undefined") return homeStackFromWorkspace(workspace);
  const stateStack = historyStackFromState(window.history.state, workspace.objects, workspace.id);
  if (stateStack.length) return stateStack;
  const locationStack = historyStackFromLocation(workspace.objects, workspace.id);
  return locationStack.length ? locationStack : homeStackFromWorkspace(workspace);
}

function navigationRootFromHistory(workspace, fallbackId) {
  if (typeof window === "undefined") return fallbackId;
  const state = window.history.state;
  const stateStack = historyStackFromState(state, workspace.objects, workspace.id);
  const locationStack = historyStackFromLocation(workspace.objects, workspace.id);
  if (stateStack.length || locationStack.length || locationHasExplicitRoot(workspace.objects)) {
    return navigationRootFromState(state, workspace.objects, fallbackId);
  }
  const homeStack = homeStackFromWorkspace(workspace);
  return homeStack[0]?.sourceObjectId || fallbackId;
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

export function useInOut({ workspace, workspaceRootId, workspaceHydrated = true }) {
  const initialRootId = navigationRootFromHistory(workspace, workspaceRootId);
  const [layers, setLayers] = useState([
    { key: "root", objectId: initialRootId, phase: "base", closing: false },
  ]);
  const timers = useRef(new Set());
  const transitionTimers = useRef(new Set());
  const layerKeySequenceRef = useRef(0);
  const layersRef = useRef(layers);
  const workspaceRef = useRef(workspace);
  const workspaceIdRef = useRef(workspace.id);
  const hydrationRef = useRef(workspaceHydrated);
  const navigationInteractedRef = useRef(false);
  const historySyncRef = useRef(0);
  const historyReadyRef = useRef(false);
  const pendingOpenRef = useRef(0);
  const topologyRevision = workspace?.[TOPOLOGY_REVISION] || 0;
  const topologyRevisionRef = useRef(topologyRevision);

  workspaceRef.current = workspace;

  useLayoutEffect(() => {
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

  const cancelTransitionTimers = useCallback(() => {
    transitionTimers.current.forEach((timer) => window.clearTimeout(timer));
    transitionTimers.current.clear();
  }, []);

  const scheduleTransition = useCallback((callback, delay) => {
    const timer = window.setTimeout(() => {
      transitionTimers.current.delete(timer);
      callback();
    }, delay);
    transitionTimers.current.add(timer);
    return timer;
  }, []);

  const nextLayerKey = useCallback((prefix) => {
    layerKeySequenceRef.current += 1;
    return `${prefix}-${Date.now()}-${layerKeySequenceRef.current}`;
  }, []);

  const removeTopLayerAndPromoteSlot = useCallback((items, key) => {
    const top = items[items.length - 1];
    if (!top || top.key !== key) return items;
    const retained = items.slice(0, -1);
    if (retained.length <= 1) return retained;
    const parent = retained[retained.length - 1];
    retained[retained.length - 1] = { ...parent, key };
    return retained;
  }, []);

  const trimLayersAndPromoteSlot = useCallback((items, length, key) => {
    const retained = items.slice(0, length);
    if (retained.length <= 1) return retained;
    const parent = retained[retained.length - 1];
    retained[retained.length - 1] = { ...parent, key };
    return retained;
  }, []);

  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current.clear();
    cancelTransitionTimers();
  }, [cancelTransitionTimers]);

  useEffect(() => {
    const workspaceChanged = workspaceIdRef.current !== workspace.id;
    const becameHydrated = workspaceHydrated && !hydrationRef.current;
    const replacingWorkspace = workspaceChanged && !becameHydrated;
    workspaceIdRef.current = workspace.id;
    hydrationRef.current = workspaceHydrated;
    if (!workspaceChanged && !becameHydrated) return;
    if (replacingWorkspace) {
      pendingOpenRef.current += 1;
      historyReadyRef.current = false;
      navigationInteractedRef.current = false;
      window.history.replaceState(
        { ...(window.history.state || {}), tactile: HISTORY_KIND, tactileWorkspaceId: workspace.id, tactileStack: [] },
        "",
        historyUrlForStack([], workspace.id),
      );
    }
    setLayers((current) => {
      const rootId = navigationRootFromHistory(workspace, workspaceRootId);
      const currentRootExists = current[0]?.objectId && workspace.objects?.[current[0].objectId];
      if (!replacingWorkspace && currentRootExists && (
        !becameHydrated
        || navigationInteractedRef.current
        || rootId === current[0].objectId
      )) return current;
      return [{ key: "root", objectId: rootId, phase: "base", closing: false }];
    });
  }, [workspace.id, workspace.objects, workspaceRootId, workspaceHydrated]);

  const setLayerPhase = useCallback((key, phase, closing = false) => {
    setLayers((current) => current.map((layer) => (
      layer.key === key ? { ...layer, phase, closing } : layer
    )));
  }, []);

  const currentHistoryStack = useCallback(
    () => layersRef.current.slice(1).map(layerHistoryEntry),
    [],
  );

  const homePathForObject = useCallback((objectId) => {
    const objectIndex = layersRef.current.findIndex((layer) => layer.objectId === objectId);
      const activePath = objectIndex > 0
      ? layersRef.current.slice(1, objectIndex + 1).map((layer) => ({
        objectId: layer.objectId,
        linkId: layer.linkId,
        sourceObjectId: layer.sourceObjectId,
        sourceCellId: layer.sourceCellId,
        sourceAddress: layer.sourceAddress,
      }))
      : [];
    return resolveHomePath(workspace.objects, objectId, activePath);
  }, [workspace.objects]);

  const writeHistoryStack = useCallback((stack, replace = false, rootObjectId = layersRef.current[0]?.objectId || workspaceRootId) => {
    const nextState = {
      ...(window.history.state || {}),
      tactile: HISTORY_KIND,
      tactileWorkspaceId: workspace.id,
      tactileStack: stack,
      tactileRootObjectId: rootObjectId,
    };
    const method = replace ? "replaceState" : "pushState";
    window.history[method](nextState, "", historyUrlForStack(stack, workspace.id, rootObjectId));
  }, [workspace.id, workspaceRootId]);

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
      linkId: entry.linkId,
      sourceObjectId: entry.sourceObjectId,
      sourceCellId: entry.sourceCellId,
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
    const edge = findEmbeddedEdge(workspace.objects, {
      linkId: payload.linkId,
      objectId: payload.objectId,
      sourceObjectId: payload.sourceObjectId,
      sourceCellId: payload.sourceCellId,
      sourceAddress: payload.sourceAddress,
    });
    if (!edge) return;
    navigationInteractedRef.current = true;
    const openRequestId = pendingOpenRef.current + 1;
    pendingOpenRef.current = openRequestId;

    const currentTop = layersRef.current[layersRef.current.length - 1];
    if (layersRef.current.some((layer) => (
      layer.phase !== "base"
      && layer.objectId === edge.objectId
      && !(layer.key === currentTop?.key && layer.linkId === edge.linkId)
    ))) return;
    const reopensCurrentLayer = currentTop
      && currentTop.phase !== "base"
      && !currentTop.closing
      && currentTop.objectId === edge.objectId
      && currentTop.linkId === edge.linkId;
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
        cancelTransitionTimers();
        scheduleTransition(
          () => setLayerPhase(currentTop.key, "full"),
          Math.max(0, IN_OUT_TIMING.floatingToFull - elapsed),
        );
      }
      return;
    }

    cancelTransitionTimers();

    const entry = {
      ...pathEntryForEdge(edge),
      sourceLabel: payload.sourceLabel || workspace.objects[edge.objectId]?.title || "Embedded object",
      sourceType: payload.sourceType || edge.type,
      mode: payload.mode || "floating",
    };
    const currentStack = currentHistoryStack();
    const parentNeedsExpansion = currentTop?.phase === "floating" && !currentTop.closing;
    const parentStack = parentNeedsExpansion
      ? currentStack.map((item, index) => (
        index === currentStack.length - 1 ? { ...item, mode: "full" } : item
      ))
      : currentStack;
    const stack = [...parentStack, entry];

    if (parentNeedsExpansion) {
      writeHistoryStack(parentStack, true);
      setLayers((items) => items.map((layer) => (
        layer.key === currentTop.key
          ? { ...layer, phase: "full", requestedMode: "full", closing: false, fullHistoryStep: false }
          : layer
      )));
    }
    writeHistoryStack(stack);

    const appendLayer = () => {
      if (pendingOpenRef.current !== openRequestId) return;
      const current = layersRef.current;
      const parent = current[current.length - 1];
      if (parentNeedsExpansion && (
        !parent
        || parent.key !== currentTop.key
        || parent.closing
        || parent.phase !== "full"
      )) return;
      const nextSourceElement = sourceElementForEntry(entry) || sourceElement;
      const reusesSpatialSlot = currentTop?.phase !== "base";
      if (reusesSpatialSlot && (
        !parent
        || parent.key !== currentTop.key
        || parent.closing
      )) return;
      const key = reusesSpatialSlot ? currentTop.key : nextLayerKey("layer");
      const promotedParentKey = reusesSpatialSlot ? nextLayerKey("parent") : null;
      const layer = makeLayerFromEntry(entry, key, nextSourceElement);
      if (payload.sourceRect) layer.sourceRect = payload.sourceRect;
      setLayers((items) => {
        if (!promotedParentKey) return [...items, layer];
        const activeParent = items[items.length - 1];
        if (!activeParent || activeParent.key !== currentTop.key) return items;
        return [
          ...items.slice(0, -1),
          { ...activeParent, key: promotedParentKey },
          layer,
        ];
      });
      scheduleTransition(() => setLayerPhase(key, "floating"), IN_OUT_TIMING.toFloating);
      if (layer.requestedMode === "full") {
        scheduleTransition(() => setLayerPhase(key, "full"), IN_OUT_TIMING.floatingToFull);
      }
    };

    if (parentNeedsExpansion) scheduleTransition(appendLayer, IN_OUT_TIMING.nestedAdvance);
    else appendLayer();
  }, [cancelTransitionTimers, currentHistoryStack, makeLayerFromEntry, nextLayerKey, scheduleTransition, setLayerPhase, sourceElementForEntry, workspace.objects, writeHistoryStack]);

  const expandLayer = useCallback((key) => {
    const current = layersRef.current;
    const top = current[current.length - 1];
    if (!top || top.key !== key || top.phase !== "floating" || top.closing) return false;
    cancelTransitionTimers();
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
  }, [cancelTransitionTimers, currentHistoryStack, writeHistoryStack]);

  const expandTopLayer = useCallback(() => {
    const top = layersRef.current[layersRef.current.length - 1];
    return top ? expandLayer(top.key) : false;
  }, [expandLayer]);

  const closeLayerWithoutHistory = useCallback((layer) => {
    if (!layer || layer.phase === "base" || layer.closing) return;
    cancelTransitionTimers();
    pendingOpenRef.current += 1;
    const closingFromFloating = layer.phase === "floating";
    if (!closingFromFloating) setLayerPhase(layer.key, "floating", true);
    scheduleTransition(
      () => setLayerPhase(layer.key, "origin", true),
      closingFromFloating ? IN_OUT_TIMING.floatingCloseToOrigin : IN_OUT_TIMING.closeToOrigin,
    );
    scheduleTransition(() => {
      setLayers((current) => removeTopLayerAndPromoteSlot(current, layer.key));
      const selector = `[data-object-id="${layer.sourceObjectId}"][data-cell-address="${layer.sourceAddress}"]`;
      document.querySelector(selector)?.focus({ preventScroll: true });
    }, closingFromFloating ? IN_OUT_TIMING.floatingCloseComplete : IN_OUT_TIMING.closeComplete);
  }, [cancelTransitionTimers, removeTopLayerAndPromoteSlot, scheduleTransition, setLayerPhase]);

  const syncHistoryStack = useCallback((targetStack, targetRootId = null, { immediate = false } = {}) => {
    pendingOpenRef.current += 1;
    const syncId = historySyncRef.current + 1;
    historySyncRef.current = syncId;

    const current = layersRef.current;
    const desiredRootId = targetRootId || targetStack[0]?.sourceObjectId || current[0]?.objectId || workspaceRootId;

    if (immediate) {
      const openedAt = Date.now();
      const rootLayer = {
        key: `root-${desiredRootId}-${openedAt}`,
        objectId: desiredRootId,
        phase: "base",
        closing: false,
      };
      const directLayers = targetStack.map((entry, index) => {
        const key = `history-${entry.objectId}-${openedAt}-${index}`;
        const layer = makeLayerFromEntry(entry, key, sourceElementForEntry(entry));
        return {
          ...layer,
          phase: "full",
          requestedMode: "full",
          fullHistoryStep: false,
          closing: false,
        };
      });
      setLayers([rootLayer, ...directLayers]);
      return;
    }

    if (desiredRootId && current[0]?.objectId !== desiredRootId) {
      setLayers([{ key: `root-${desiredRootId}-${Date.now()}`, objectId: desiredRootId, phase: "base", closing: false }]);
      window.requestAnimationFrame(() => {
        if (historySyncRef.current === syncId) syncHistoryStack(targetStack, desiredRootId);
      });
      return;
    }
    let commonDepth = 0;
    while (
      commonDepth < current.length - 1
      && commonDepth < targetStack.length
      && current[commonDepth + 1].objectId === targetStack[commonDepth].objectId
      && current[commonDepth + 1].linkId === targetStack[commonDepth].linkId
      && current[commonDepth + 1].sourceObjectId === targetStack[commonDepth].sourceObjectId
      && current[commonDepth + 1].sourceAddress === targetStack[commonDepth].sourceAddress
    ) {
      commonDepth += 1;
    }

    const setTargetStackState = (items, { trim = false } = {}) => {
      const retained = trim ? items.slice(0, targetStack.length + 1) : items;
      return retained.map((layer, index) => {
        if (index === 0) return { ...layer, phase: "base", closing: false };
        const entry = targetStack[index - 1];
        if (!entry) return layer;
        return {
          ...layer,
          requestedMode: entry.mode || "floating",
          phase: entry.mode === "full" ? "full" : "floating",
          closing: false,
        };
      });
    };

    const applyModes = () => {
      if (historySyncRef.current !== syncId) return;
      setLayers((items) => setTargetStackState(items));
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
      const activeParent = currentItems[currentItems.length - 1];
      const reusesSpatialSlot = activeParent?.phase !== "base";
      const key = reusesSpatialSlot ? activeParent.key : nextLayerKey("history");
      const promotedParentKey = reusesSpatialSlot ? nextLayerKey("history-parent") : null;
      const layer = makeLayerFromEntry(entry, key, sourceElement);
      setLayers((items) => {
        if (!promotedParentKey) return [...items, layer];
        const currentParent = items[items.length - 1];
        if (!currentParent || currentParent.key !== activeParent.key) return items;
        return [
          ...items.slice(0, -1),
          { ...currentParent, key: promotedParentKey },
          layer,
        ];
      });
      scheduleTransition(() => setLayerPhase(key, "floating"), IN_OUT_TIMING.toFloating);
      const settleDelay = entry.mode === "full" ? IN_OUT_TIMING.floatingToFull : IN_OUT_TIMING.toFloating;
      if (entry.mode === "full") {
        scheduleTransition(() => setLayerPhase(key, "full"), IN_OUT_TIMING.floatingToFull);
      }
      scheduleTransition(appendNext, settleDelay + 30);
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
      if (top.closing) {
        scheduleTransition(closeUntil, 24);
        return;
      }
      const closingFromFloating = top.phase === "floating";
      if (!closingFromFloating) setLayerPhase(top.key, "floating", true);
      scheduleTransition(
        () => setLayerPhase(top.key, "origin", true),
        closingFromFloating ? IN_OUT_TIMING.floatingCloseToOrigin : IN_OUT_TIMING.closeToOrigin,
      );
      scheduleTransition(() => {
        if (historySyncRef.current !== syncId) return;
        setLayers((items) => removeTopLayerAndPromoteSlot(items, top.key));
        window.requestAnimationFrame(closeUntil);
      }, closingFromFloating ? IN_OUT_TIMING.floatingCloseComplete : IN_OUT_TIMING.closeComplete);
    };

    const canCollapseDirectly = targetStack.length < current.length - 1
      && commonDepth === targetStack.length;
    if (canCollapseDirectly) {
      const top = current[current.length - 1];
      const closingFromFloating = top.phase === "floating";
      if (!closingFromFloating) setLayerPhase(top.key, "floating", true);
      scheduleTransition(
        () => setLayerPhase(top.key, "origin", true),
        closingFromFloating ? IN_OUT_TIMING.floatingCloseToOrigin : IN_OUT_TIMING.closeToOrigin,
      );
      scheduleTransition(() => {
        if (historySyncRef.current !== syncId) return;
        setLayers((items) => {
          const retained = trimLayersAndPromoteSlot(items, targetStack.length + 1, top.key);
          return setTargetStackState(retained);
        });
      }, closingFromFloating ? IN_OUT_TIMING.floatingCloseComplete : IN_OUT_TIMING.closeComplete);
    } else if (current.length - 1 > commonDepth) closeUntil();
    else if (current.length - 1 < targetStack.length) appendNext();
    else applyModes();
  }, [makeLayerFromEntry, nextLayerKey, removeTopLayerAndPromoteSlot, scheduleTransition, setLayerPhase, sourceElementForEntry, trimLayersAndPromoteSlot, workspaceRootId]);

  const navigateToRoute = useCallback((route, { history = "push", mode = "full", immediate = false } = {}) => {
    const segments = Array.isArray(route?.segments) ? route.segments : [];
    const validated = validateNavigationRoute(workspace.objects, segments);
    if (!validated.valid || validated.stack.length !== segments.length) return false;
    const inferredRootId = validated.stack[0]?.sourceObjectId || route?.rootObjectId;
    const rootObjectId = inferredRootId && workspace.objects?.[inferredRootId]
      ? String(inferredRootId)
      : null;
    if (!rootObjectId) return false;
    if (validated.stack[0] && validated.stack[0].sourceObjectId !== rootObjectId) return false;

    const targetStack = validated.stack.map((entry, index, list) => historyEntryForPath(
      workspace.objects,
      entry,
      immediate ? "full" : route?.segments?.[index]?.mode || (index === list.length - 1 ? mode : "full"),
    ));
    const current = layersRef.current;
    const currentStack = current.slice(1).map(layerHistoryEntry);
    const isSameRoute = current[0]?.objectId === rootObjectId
      && currentStack.length === targetStack.length
      && currentStack.every((entry, index) => (
        entry.objectId === targetStack[index].objectId
        && entry.linkId === targetStack[index].linkId
        && entry.sourceObjectId === targetStack[index].sourceObjectId
        && entry.sourceAddress === targetStack[index].sourceAddress
      ));
    navigationInteractedRef.current = true;
    if (isSameRoute) return true;
    if (history === "replace") {
      writeHistoryStack(targetStack, true, rootObjectId);
    } else {
      const currentRootId = current[0]?.objectId;
      const commonPrefix = currentRootId === rootObjectId
        && currentStack.every((entry, index) => (
          targetStack[index]?.objectId === entry.objectId
          && targetStack[index]?.linkId === entry.linkId
          && targetStack[index]?.sourceObjectId === entry.sourceObjectId
          && targetStack[index]?.sourceAddress === entry.sourceAddress
        ));
      const firstMissingIndex = commonPrefix ? currentStack.length : 0;
      if (!commonPrefix || currentRootId !== rootObjectId) writeHistoryStack([], false, rootObjectId);
      if (targetStack.length < currentStack.length && commonPrefix) {
        writeHistoryStack(targetStack, false, rootObjectId);
      } else {
        for (let index = firstMissingIndex; index < targetStack.length; index += 1) {
          writeHistoryStack(targetStack.slice(0, index + 1), false, rootObjectId);
        }
      }
    }
    syncHistoryStack(targetStack, rootObjectId, { immediate });
    return true;
  }, [syncHistoryStack, workspace.objects, writeHistoryStack]);

  const navigateToObject = useCallback((objectId) => {
    const path = canonicalPathForObject(workspace.objects, objectId);
    if (!workspace.objects?.[objectId] || !path) return false;
    return navigateToRoute({
      rootObjectId: path[0]?.sourceObjectId || objectId,
      segments: path.map((entry, index) => ({ ...entry, mode: index === path.length - 1 ? "full" : "full" })),
    });
  }, [navigateToRoute, workspace.objects]);

  useEffect(() => {
    if (!workspaceHydrated || !historyReadyRef.current) return;
    const current = layersRef.current;
    if (!current.length) return;
    const currentStack = current.slice(1).map(layerHistoryEntry);
    const validated = validateNavigationRoute(workspace.objects, currentStack);
    const currentRootId = current[0]?.objectId;
    const rootExists = Boolean(currentRootId && workspace.objects?.[currentRootId]);
    if (rootExists && validated.valid && validated.stack.length === currentStack.length) return;

    const rootObjectId = rootExists
      ? currentRootId
      : navigationRootFromHistory(workspace, workspaceRootId);
    navigationInteractedRef.current = true;
    writeHistoryStack(validated.stack, true, rootObjectId);
    syncHistoryStack(validated.stack, rootObjectId, { immediate: true });
  }, [syncHistoryStack, workspace, workspaceRootId, workspaceHydrated, writeHistoryStack]);

  const closeTopLayer = useCallback((layerKey = null) => {
    const current = layersRef.current;
    const top = current[current.length - 1];
    if (!top || top.closing) return false;
    if (layerKey && top.key !== layerKey) return false;
    navigationInteractedRef.current = true;
    if (top.phase === "base") {
      const parent = workspace.objects[top.objectId]?.parent;
      if (!parent?.parentObjectId) return false;
      const parentEdge = findEmbeddedEdge(workspace.objects, {
        linkId: parent.linkId,
        objectId: top.objectId,
        sourceObjectId: parent.parentObjectId,
        sourceCellId: parent.parentCellId,
        sourceAddress: parent.sourceAddress,
      });
      if (!parentEdge) return false;
      const targetStack = canonicalPathForObject(workspace.objects, parent.parentObjectId) || [];
      const targetRootId = targetStack[0]?.sourceObjectId || parent.parentObjectId;
      writeHistoryStack(targetStack, false, targetRootId);
      setLayers([{ key: "root", objectId: targetRootId, phase: "base", closing: false }]);
      window.requestAnimationFrame(() => syncHistoryStack(targetStack, targetRootId));
      return true;
    }
    if (window.history.state?.tactile === HISTORY_KIND && currentHistoryStack().length) {
      const historyMode = historyStackFromState(window.history.state, workspace.objects, workspace.id).at(-1)?.mode;
      window.history.go(historyMode === "full" && top.fullHistoryStep ? -2 : -1);
      return true;
    }
    closeLayerWithoutHistory(top);
    return true;
  }, [closeLayerWithoutHistory, currentHistoryStack, setLayers, syncHistoryStack, workspace.id, workspace.objects, writeHistoryStack]);

  const closeTopLayerRef = useRef(closeTopLayer);
  useEffect(() => {
    closeTopLayerRef.current = closeTopLayer;
  }, [closeTopLayer]);

  useEffect(() => {
    if (!workspaceHydrated) return;
    if (historyReadyRef.current) return;
    if (!workspace.objects?.[workspaceRootId]) return;
    const stateStack = historyStackFromState(window.history.state, workspace.objects, workspace.id);
    const locationStack = historyStackFromLocation(workspace.objects, workspace.id);
    const stack = stateStack.length
      ? stateStack
      : locationStack.length
        ? locationStack
        : locationHasExplicitRoot(workspace.objects)
          ? []
          : homeStackFromWorkspace(workspace);
    const rootObjectId = navigationRootFromState(window.history.state, workspace.objects, stack[0]?.sourceObjectId || workspaceRootId);
    if (stack.length && !stateStack.length) {
      window.history.replaceState(
        {
          ...(window.history.state || {}),
          tactile: HISTORY_KIND,
          tactileWorkspaceId: workspace.id,
          tactileStack: [],
          tactileRootObjectId: rootObjectId,
        },
        "",
        historyUrlForStack([], workspace.id, rootObjectId),
      );
      stack.forEach((_, index) => {
        const historyStack = stack.slice(0, index + 1);
        window.history.pushState(
          {
            ...(window.history.state || {}),
            tactile: HISTORY_KIND,
            tactileWorkspaceId: workspace.id,
            tactileStack: historyStack,
            tactileRootObjectId: rootObjectId,
          },
          "",
          historyUrlForStack(historyStack, workspace.id, rootObjectId),
        );
      });
    } else if (window.history.state?.tactile !== HISTORY_KIND || stateStack.length !== stack.length) {
      window.history.replaceState(
        {
          ...(window.history.state || {}),
          tactile: HISTORY_KIND,
          tactileWorkspaceId: workspace.id,
          tactileStack: stack,
          tactileRootObjectId: rootObjectId,
        },
        "",
        historyUrlForStack(stack, workspace.id, rootObjectId),
      );
    }
    historyReadyRef.current = true;
    syncHistoryStack(stack, rootObjectId, { immediate: true });
  }, [syncHistoryStack, workspace, workspaceRootId, workspaceHydrated]);

  useEffect(() => {
    if (!workspaceHydrated || !historyReadyRef.current) {
      topologyRevisionRef.current = topologyRevision;
      return;
    }
    if (topologyRevisionRef.current === topologyRevision) return;
    topologyRevisionRef.current = topologyRevision;
    const current = layersRef.current;
    const currentStack = current.slice(1).map(layerHistoryEntry);
    if (!currentStack.length) return;
    const nextStack = rebaseHistoryStack(workspace.objects, currentStack);
    if (!nextStack?.length) return;
    const rootObjectId = nextStack[0]?.sourceObjectId || current[0]?.objectId || workspaceRootId;
    writeHistoryStack(nextStack, true, rootObjectId);
    setLayers((items) => {
      const existingByLink = new Map(items.slice(1).map((layer) => [layer.linkId, layer]));
      const nextLayers = nextStack.map((entry, index) => {
        const existing = existingByLink.get(entry.linkId);
        if (existing) {
          const sourceElement = sourceElementForEntry(entry);
          return {
            ...existing,
            ...entry,
            sourceRect: sourceElement ? rectSnapshot(sourceElement) : existing.sourceRect,
          };
        }
        const key = `history-${entry.objectId}-${Date.now()}-${index}`;
        const layer = makeLayerFromEntry(entry, key, sourceElementForEntry(entry));
        return {
          ...layer,
          phase: "full",
          requestedMode: "full",
          fullHistoryStep: false,
          closing: false,
        };
      });
      return [
        { ...items[0], objectId: rootObjectId, phase: "base", closing: false },
        ...nextLayers,
      ];
    });
  }, [makeLayerFromEntry, sourceElementForEntry, topologyRevision, writeHistoryStack, workspace.objects, workspaceHydrated, workspaceRootId]);

  useEffect(() => {
    const handlePopState = (event) => {
      const currentWorkspace = workspaceRef.current;
      syncHistoryStack(
        historyStackFromState(event.state, currentWorkspace.objects, currentWorkspace.id),
        navigationRootFromState(event.state, currentWorkspace.objects, workspaceRootId),
      );
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [syncHistoryStack, workspaceRootId]);

  useEffect(() => {
    const handleOutsideFloatingPointer = (event) => {
      const top = layersRef.current[layersRef.current.length - 1];
      if (!top || top.phase !== "floating" || top.closing) return;
      if (event.target instanceof Element && event.target.closest(".files-layer")) return;
      if (event.target instanceof Element && event.target.closest(".app-bottom-bar")) return;
      if (event.target instanceof Element && event.target.closest(".app-dock-path-popover")) return;
      if (event.target instanceof Element && event.target.closest("[data-floating-interactive=\"true\"]")) return;
      if (event.target instanceof Element && event.target.closest(".object-window")) return;
      if (event.target instanceof Element && event.target.closest(".transition-backdrop")) return;
      closeTopLayerRef.current();
    };
    document.addEventListener("pointerdown", handleOutsideFloatingPointer, true);
    return () => document.removeEventListener("pointerdown", handleOutsideFloatingPointer, true);
  }, []);

  return {
    layers,
    layersRef,
    schedule,
    openObject,
    navigateToRoute,
    navigateToObject,
    expandLayer,
    expandTopLayer,
    closeTopLayer,
    homePathForObject,
  };
}
