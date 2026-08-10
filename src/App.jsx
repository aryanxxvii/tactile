import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SettingsPanel } from "./components/SettingsPanel.jsx";
import { SpatialLayer } from "./components/SpatialLayer.jsx";
import { downloadWorkspaceZip, importWorkspaceFile } from "./export.js";
import { useLocalWorkspace } from "./hooks/useLocalWorkspace.js";
import { materializeCell, usedSheetBounds } from "./model.js";
import { ObjectRenderer } from "./objects/objectRegistry.jsx";
import { cellAddress, coordinatesFromAddress, moveAddress } from "./sheet/coordinates.js";
import {
  cellIdsInRange,
  pasteChanges,
  rangeLabel,
  serializeRange,
} from "./sheet/ranges.js";
import {
  cloneTheme,
  downloadTheme,
  resolveTheme,
  themeFromFile,
  themeSheetMetrics,
  themeStyle,
} from "./themes.js";

const IN_OUT_TIMING = {
  toFloating: 24,
  floatingToFull: 900,
  closeToOrigin: 460,
  closeComplete: 820,
  floatingCloseToOrigin: 24,
  floatingCloseComplete: 430,
};

const HISTORY_KIND = "tactile-in-out";

function historyUrlForStack(stack) {
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

function layerHistoryEntry(layer) {
  return {
    objectId: layer.objectId,
    sourceObjectId: layer.sourceObjectId,
    sourceAddress: layer.sourceAddress,
    sourceLabel: layer.sourceLabel,
    sourceType: layer.sourceType,
    mode: layer.phase === "full" ? "full" : "floating",
  };
}

function historyStackFromState(state) {
  return state?.tactile === HISTORY_KIND && Array.isArray(state.tactileStack)
    ? state.tactileStack
    : [];
}

function historyStackFromLocation(objects) {
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

function readLocalFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const extension = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "bin";
      const isText = file.type.startsWith("text/") || ["md", "markdown", "html", "htm", "svg"].includes(extension);
      resolve({
        fileName: file.name,
        mime: file.type || "application/octet-stream",
        extension,
        size: file.size,
        lastModified: file.lastModified,
        dataUrl: reader.result,
        text: isText ? await file.text() : undefined,
      });
    };
    reader.onerror = () => reject(reader.error || new Error("Unable to read this local file."));
    reader.readAsDataURL(file);
  });
}

export function App() {
  const {
    workspace,
    saveState,
    replaceWorkspace,
    updateObject,
    updateCell,
    updateCells,
    clearCell,
    clearCells,
    createEmbeddedObject,
    createEmbeddedFile,
    replaceObjectFile,
    insertSheetAxis,
    deleteSheetAxis,
    moveSheetAxis,
    setHomeObject,
    setActiveTheme,
    saveTheme,
    updateTheme,
    deleteTheme,
    updateSettings,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useLocalWorkspace();
  const workspaceRootId = workspace.homeObjectId;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsReturnFocusRef = useRef(null);
  const [exportState, setExportState] = useState("idle");
  const [notice, setNotice] = useState("");
  const importInputRef = useRef(null);
  const [selectedByObject, setSelectedByObject] = useState({});
  const [rangeByObject, setRangeByObject] = useState({});
  const [layers, setLayers] = useState([
    { key: "root", objectId: workspaceRootId, phase: "base", closing: false },
  ]);
  const timers = useRef(new Set());
  const layersRef = useRef(layers);
  const historySyncRef = useRef(0);
  const historyReadyRef = useRef(false);
  const historyTargetRef = useRef([]);
  const timerEffectRunsRef = useRef(0);

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

  useEffect(() => {
    timerEffectRunsRef.current += 1;
    return () => {
      if (timerEffectRunsRef.current < 2) return;
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current.clear();
    };
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
    historyTargetRef.current = targetStack;

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

  const selectedCellFor = useCallback((object) => {
    const address = selectedByObject[object.id] || "A1";
    const coordinates = coordinatesFromAddress(address) || { row: 0, column: 0 };
    return materializeCell(object, coordinates.row, coordinates.column);
  }, [selectedByObject]);

  const openSelectedEmbeddedObject = useCallback(() => {
    const activeLayer = layers[layers.length - 1];
    const activeObject = workspace.objects[activeLayer.objectId];
    if (activeObject?.type !== "sheet") return;
    const cell = selectedCellFor(activeObject);
    if (!cell?.embed) return;

    const selector = `[data-object-id="${activeObject.id}"][data-cell-address="${cell.address}"]`;
    const sourceElement = document.querySelector(selector);
    if (!sourceElement) return;
    openObject({
      objectId: cell.embed.objectId,
      sourceObjectId: activeObject.id,
      sourceAddress: cell.address,
      sourceLabel: workspace.objects[cell.embed.objectId]?.title || cell.value || "Embedded object",
      sourceType: cell.embed.type,
      sourceElement,
      mode: "floating",
    });
  }, [layers, openObject, selectedCellFor, workspace.objects]);

  const selectAddress = useCallback((objectId, address) => {
    setSelectedByObject((current) => ({ ...current, [objectId]: address }));
    setRangeByObject((current) => ({
      ...current,
      [objectId]: { anchor: address, focus: address },
    }));
  }, []);

  const selectRange = useCallback((objectId, anchor, focus, activeAddress = focus) => {
    setSelectedByObject((current) => ({ ...current, [objectId]: activeAddress }));
    setRangeByObject((current) => ({
      ...current,
      [objectId]: { anchor, focus },
    }));
  }, []);

  const showNotice = useCallback((message) => {
    setNotice(message);
    schedule(() => setNotice(""), 2800);
  }, [schedule]);

  const openSettings = useCallback((sourceElement) => {
    settingsReturnFocusRef.current = sourceElement || document.activeElement;
    setSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    window.requestAnimationFrame(() => settingsReturnFocusRef.current?.focus?.());
  }, []);

  const exportWorkspace = useCallback(async () => {
    setExportState("exporting");
    try {
      await downloadWorkspaceZip(workspace);
      showNotice("Portable .tactile workspace exported");
    } catch (error) {
      showNotice(error?.message || "Export failed");
    } finally {
      setExportState("idle");
    }
  }, [showNotice, workspace]);

  const importWorkspace = useCallback(() => {
    importInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const imported = await importWorkspaceFile(file);
      replaceWorkspace(imported);
      setSelectedByObject({});
      setRangeByObject({});
      showNotice(`Imported ${imported.name}`);
    } catch (error) {
      showNotice(error?.message || "That file could not be imported");
    }
  }, [replaceWorkspace, showNotice]);

  const createInCell = useCallback((parentObjectId, cell, type, sourceElement) => {
    const created = createEmbeddedObject(parentObjectId, cell.id, type);
    if (!created || !sourceElement) return;
    schedule(() => {
      openObject({
        objectId: created.id,
        sourceObjectId: parentObjectId,
        sourceAddress: cell.address,
        sourceLabel: created.title,
        sourceType: created.type,
        sourceElement,
        mode: "floating",
      });
    }, 20);
  }, [createEmbeddedObject, openObject, schedule]);

  const createFileInCell = useCallback(async (parentObjectId, cell, file, sourceElement) => {
    try {
      const asset = await readLocalFile(file);
      const created = createEmbeddedFile(parentObjectId, cell.id, asset);
      if (!created || !sourceElement) return;
      schedule(() => {
        openObject({
          objectId: created.id,
          sourceObjectId: parentObjectId,
          sourceAddress: cell.address,
          sourceLabel: created.title,
          sourceType: created.type,
          sourceElement,
          mode: "floating",
        });
      }, 20);
    } catch (error) {
      showNotice(error?.message || "That file could not be attached");
    }
  }, [createEmbeddedFile, openObject, schedule, showNotice]);

  const replaceFileObject = useCallback(async (objectId, file) => {
    try {
      const asset = await readLocalFile(file);
      replaceObjectFile(objectId, asset);
      showNotice(`Replaced with ${file.name}`);
    } catch (error) {
      showNotice(error?.message || "That local file could not be opened");
    }
  }, [replaceObjectFile, showNotice]);

  const moveSelection = useCallback((rowDelta, columnDelta, extend = false) => {
    const activeLayer = layers[layers.length - 1];
    const activeObject = workspace.objects[activeLayer.objectId];
    if (activeObject?.type !== "sheet") return;
    const next = moveAddress(
      selectedByObject[activeObject.id] || "A1",
      rowDelta,
      columnDelta,
      activeObject.rows,
      activeObject.columns,
    );
    if (extend) {
      const anchor = rangeByObject[activeObject.id]?.anchor
        || selectedByObject[activeObject.id]
        || "A1";
      selectRange(activeObject.id, anchor, next);
    } else {
      selectAddress(activeObject.id, next);
    }
  }, [layers, rangeByObject, selectAddress, selectRange, selectedByObject, workspace.objects]);

  const clipboardSelectedCell = useCallback(async (mode) => {
    const activeLayer = layers[layers.length - 1];
    const object = workspace.objects[activeLayer.objectId];
    if (object?.type !== "sheet") return;
    const cell = selectedCellFor(object);
    const selection = rangeByObject[object.id] || { anchor: cell.address, focus: cell.address };
    if (mode === "copy" || mode === "cut") {
      await navigator.clipboard?.writeText(serializeRange(object, selection));
      if (mode === "cut") clearCells(object.id, cellIdsInRange(selection));
      showNotice(`${mode === "cut" ? "Cut" : "Copied"} ${rangeLabel(selection)}`);
    } else if (navigator.clipboard?.readText) {
      if (navigator.clipboard.read) {
        try {
          const clipboardItems = await navigator.clipboard.read();
          const imageItem = clipboardItems.find((item) => item.types.some((type) => type.startsWith("image/")));
          if (imageItem) {
            const imageType = imageItem.types.find((type) => type.startsWith("image/"));
            const blob = await imageItem.getType(imageType);
            const extension = imageType.split("/")[1] || "png";
            const file = new File([blob], `pasted-image-${Date.now()}.${extension}`, { type: imageType });
            const asset = await readLocalFile(file);
            const created = createEmbeddedFile(object.id, cell.id, asset);
            if (created) {
              showNotice("Pasted image into the selected tile");
              return;
            }
          }
        } catch {
          // Browsers may deny image clipboard reads; the text fallback remains available.
        }
      }
      const text = await navigator.clipboard.readText();
      const pasted = pasteChanges(cell.address, text);
      updateCells(object.id, pasted.changes, "paste");
      selectRange(object.id, cell.address, pasted.endAddress);
    }
  }, [clearCells, createEmbeddedFile, layers, rangeByObject, selectRange, selectedCellFor, showNotice, updateCells, workspace.objects]);

  const clearSelectedCell = useCallback(() => {
    const activeLayer = layers[layers.length - 1];
    const object = workspace.objects[activeLayer.objectId];
    if (object?.type !== "sheet") return;
    const cell = selectedCellFor(object);
    const selection = rangeByObject[object.id] || { anchor: cell.address, focus: cell.address };
    clearCells(object.id, cellIdsInRange(selection));
  }, [clearCells, layers, rangeByObject, selectedCellFor, workspace.objects]);

  const selectUsedSheet = useCallback(() => {
    const activeLayer = layers[layers.length - 1];
    const object = workspace.objects[activeLayer.objectId];
    if (object?.type !== "sheet") return;
    const bounds = usedSheetBounds(object);
    const end = bounds.rows && bounds.columns
      ? cellAddress(bounds.rows - 1, bounds.columns - 1)
      : "A1";
    const activeAddress = selectedByObject[object.id] || "A1";
    selectRange(object.id, "A1", end, activeAddress);
  }, [layers, selectRange, selectedByObject, workspace.objects]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const tagName = event.target?.tagName;
      const isTyping = tagName === "INPUT" || tagName === "TEXTAREA" || event.target?.isContentEditable;
      if (isTyping || event.defaultPrevented) return;

      const command = event.ctrlKey || event.metaKey;
      if (command && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (command && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (command && event.key.toLowerCase() === "c") {
        event.preventDefault();
        clipboardSelectedCell("copy");
        return;
      }
      if (command && event.key.toLowerCase() === "x") {
        event.preventDefault();
        clipboardSelectedCell("cut");
        return;
      }
      if (command && event.key.toLowerCase() === "v") {
        event.preventDefault();
        clipboardSelectedCell("paste");
        return;
      }
      if (command && event.key.toLowerCase() === "a") {
        event.preventDefault();
        selectUsedSheet();
        return;
      }

      if (event.key === "Escape" && settingsOpen) {
        event.preventDefault();
        closeSettings();
        return;
      }
      if (event.key === "]") {
        event.preventDefault();
        if (!expandTopLayer()) openSelectedEmbeddedObject();
        return;
      }
      if (event.key === "[" || event.key === "Escape") {
        event.preventDefault();
        closeTopLayer();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        clearSelectedCell();
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveSelection(-1, 0, event.shiftKey);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        moveSelection(1, 0, event.shiftKey);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveSelection(0, -1, event.shiftKey);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        moveSelection(0, 1, event.shiftKey);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearSelectedCell, clipboardSelectedCell, closeSettings, closeTopLayer, expandTopLayer, moveSelection, openSelectedEmbeddedObject, redo, selectUsedSheet, settingsOpen, undo]);

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

  const objectPaths = useMemo(() => layers.map((_, index) => [
    { id: workspace.id, title: workspace.name },
    ...layers.slice(0, index + 1).map((layer) => ({
      id: layer.objectId,
      title: workspace.objects[layer.objectId]?.title || "Untitled",
    })),
  ]), [layers, workspace]);

  const currentObject = workspace.objects[layers[layers.length - 1]?.objectId || workspaceRootId];
  const currentObjectTitle = currentObject?.title || workspace.name || "Home";

  useEffect(() => {
    document.title = `Tactile — ${currentObjectTitle}`;
  }, [currentObjectTitle]);

  const activeTheme = useMemo(
    () => resolveTheme(workspace.activeThemeId, workspace.themes),
    [workspace.activeThemeId, workspace.themes],
  );
  const sheetMetrics = useMemo(() => themeSheetMetrics(activeTheme), [activeTheme]);

  const importTheme = useCallback(async (file) => {
    try {
      const theme = await themeFromFile(file);
      saveTheme(theme);
      showNotice(`Imported theme: ${theme.name}`);
    } catch (error) {
      showNotice(error?.message || "That theme could not be imported");
    }
  }, [saveTheme, showNotice]);

  const renderObject = (layer, index) => {
    const object = workspace.objects[layer.objectId];
    if (!object) return null;
    const selectedAddress = selectedByObject[object.id] || "A1";
    const selectionRange = rangeByObject[object.id] || { anchor: selectedAddress, focus: selectedAddress };
    const sharedProps = {
      object,
      path: objectPaths[index],
      saveState,
      selectedAddress,
      selectionRange,
      workspaceObjects: workspace.objects,
      onSelectAddress: (address) => selectAddress(object.id, address),
      onSelectRange: (anchor, focus, active) => selectRange(object.id, anchor, focus, active),
      onUpdateObject: (patch) => updateObject(object.id, patch),
      onUpdateCell: (cellId, patch) => updateCell(object.id, cellId, patch),
      onUpdateCells: (changes, historyKey) => updateCells(object.id, changes, historyKey),
      onOpenObject: (payload) => openObject({ ...payload, sourceObjectId: object.id }),
      onCreateEmbedded: (cell, type, sourceElement) => createInCell(object.id, cell, type, sourceElement),
      onCreateFile: (cell, file, sourceElement) => createFileInCell(object.id, cell, file, sourceElement),
      onReplaceFile: (file) => replaceFileObject(object.id, file),
      onClearCell: (cellId) => clearCell(object.id, cellId),
      onInsertAxis: (axis, indexToInsert) => insertSheetAxis(object.id, axis, indexToInsert),
      onDeleteAxis: (axis, indexToDelete) => deleteSheetAxis(object.id, axis, indexToDelete),
      onMoveAxis: (axis, from, to) => moveSheetAxis(object.id, axis, from, to),
      sheetMetrics,
      assets: workspace.assets,
      workspaceActions: {
        homeObjectId: workspace.homeObjectId,
        exportState,
        onSetHome: (objectId) => {
          setHomeObject(objectId);
          showNotice(`${workspace.objects[objectId]?.title || "Object"} is now home`);
        },
        onExport: exportWorkspace,
        onImport: importWorkspace,
      },
      onBack: closeTopLayer,
      canGoBack: index > 0,
      onOpenSettings: openSettings,
      onUndo: undo,
      onRedo: redo,
      canUndo,
      canRedo,
    };

    return <ObjectRenderer {...sharedProps} />;
  };

  return (
    <div
      className="tactile-app"
      data-paper-scheme
      data-reduce-motion={workspace.settings.reduceMotion ? "true" : "false"}
      style={themeStyle(activeTheme)}
    >
      <div className="workspace-shell" inert={settingsOpen} aria-hidden={settingsOpen ? "true" : undefined}>
        <input
          ref={importInputRef}
          className="native-file-input"
          type="file"
          accept=".tactile,.zip,.json,application/zip,application/json"
          onChange={handleImportFile}
          tabIndex={-1}
          aria-hidden="true"
        />
        <div className="base-object-layer">{renderObject(layers[0], 0)}</div>

        {layers.slice(1).map((layer, childIndex) => (
          <SpatialLayer layer={layer} depth={childIndex + 1} key={layer.key} onExpand={expandLayer} onClose={() => closeTopLayer()}>
            {renderObject(layer, childIndex + 1)}
          </SpatialLayer>
        ))}

      </div>

      {settingsOpen ? (
        <SettingsPanel
          activeTheme={activeTheme}
          customThemes={workspace.themes}
          settings={workspace.settings}
          onSelectTheme={setActiveTheme}
          onCloneTheme={(theme) => saveTheme(cloneTheme(theme))}
          onUpdateTheme={updateTheme}
          onDeleteTheme={deleteTheme}
          onImportTheme={importTheme}
          onExportTheme={downloadTheme}
          onUpdateSettings={updateSettings}
          onExportWorkspace={exportWorkspace}
          onImportWorkspace={importWorkspace}
          onClose={closeSettings}
        />
      ) : null}

      {notice ? <div className="app-notice" role="status">{notice}</div> : null}
    </div>
  );
}
