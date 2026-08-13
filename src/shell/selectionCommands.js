import { useCallback, useRef, useState } from "react";
import { materializeCell, usedSheetBounds } from "../model.js";
import { cellAddress, coordinatesFromAddress, moveAddress } from "../sheet/coordinates.js";
import { cellIdsInRange, pasteChanges, rangeLabel, serializeRange } from "../sheet/ranges.js";

function isTypingTarget(target) {
  const tagName = target?.tagName;
  return tagName === "INPUT" || tagName === "TEXTAREA" || target?.isContentEditable;
}

function isGridTarget(target) {
  return Boolean(target?.closest?.(".sheet-grid-shell"));
}

function activeElement() {
  return typeof document === "undefined" ? null : document.activeElement;
}

function isTypingSurface(target) {
  return isTypingTarget(target) || isTypingTarget(activeElement());
}

function isGridSurface(target) {
  return isGridTarget(target) || isGridTarget(activeElement());
}

function isSheetCellTarget(target) {
  return Boolean(target?.closest?.(".sheet-cell"));
}

function hasActiveSheetCell() {
  return typeof document !== "undefined"
    && Boolean(document.querySelector('.sheet-grid-shell .sheet-cell[aria-selected="true"]'));
}

function isSheetNavigationTarget(target) {
  return isSheetCellTarget(target) || isGridTarget(target) || hasActiveSheetCell();
}

function focusSheetCell(objectId, address, attempt = 0) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  window.requestAnimationFrame(() => {
    const nextCell = document.querySelector(
      `[data-object-id="${objectId}"][data-cell-address="${address}"]`,
    );
    if (nextCell?.getAttribute("aria-selected") === "true") {
      nextCell.focus({ preventScroll: true });
    } else if (attempt < 8) {
      focusSheetCell(objectId, address, attempt + 1);
    }
  });
}

function clipboardMethodAvailable(method) {
  return typeof navigator !== "undefined" && typeof navigator.clipboard?.[method] === "function";
}

function imageFileFromClipboard(data) {
  const imageItem = Array.from(data?.items || []).find((item) => item.type?.startsWith("image/"));
  return imageItem?.getAsFile?.() || null;
}

export function useSelectionCommands({
  workspace,
  layers,
  openObject,
  showNotice,
  updateCells,
  clearCells,
  createEmbeddedFile,
  undo,
  redo,
}) {
  const [selectedByObject, setSelectedByObject] = useState({});
  const [rangeByObject, setRangeByObject] = useState({});
  const selectedByObjectRef = useRef({});
  const rangeByObjectRef = useRef({});

  const resetSelection = useCallback(() => {
    selectedByObjectRef.current = {};
    rangeByObjectRef.current = {};
    setSelectedByObject({});
    setRangeByObject({});
  }, []);

  const selectedCellFor = useCallback((object) => {
    const address = selectedByObjectRef.current[object.id] || "A1";
    const coordinates = coordinatesFromAddress(address) || { row: 0, column: 0 };
    return materializeCell(object, coordinates.row, coordinates.column);
  }, []);

  const selectAddress = useCallback((objectId, address) => {
    const nextSelected = { ...selectedByObjectRef.current, [objectId]: address };
    const nextRanges = {
      ...rangeByObjectRef.current,
      [objectId]: { anchor: address, focus: address },
    };
    selectedByObjectRef.current = nextSelected;
    rangeByObjectRef.current = nextRanges;
    setSelectedByObject(nextSelected);
    setRangeByObject(nextRanges);
  }, []);

  const selectRange = useCallback((objectId, anchor, focus, activeAddress = focus) => {
    const nextSelected = { ...selectedByObjectRef.current, [objectId]: activeAddress };
    const nextRanges = {
      ...rangeByObjectRef.current,
      [objectId]: { anchor, focus },
    };
    selectedByObjectRef.current = nextSelected;
    rangeByObjectRef.current = nextRanges;
    setSelectedByObject(nextSelected);
    setRangeByObject(nextRanges);
  }, []);

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
      linkId: cell.embed.linkId,
      sourceObjectId: activeObject.id,
      sourceCellId: cell.id,
      sourceAddress: cell.address,
      sourceLabel: workspace.objects[cell.embed.objectId]?.title || cell.value || "Embedded object",
      sourceType: cell.embed.type,
      sourceElement,
      mode: "floating",
    });
  }, [layers, openObject, selectedCellFor, workspace.objects]);

  const moveSelection = useCallback((rowDelta, columnDelta, extend = false) => {
    const activeLayer = layers[layers.length - 1];
    const activeObject = workspace.objects[activeLayer.objectId];
    if (activeObject?.type !== "sheet") return;
    const currentAddress = selectedByObjectRef.current[activeObject.id] || "A1";
    const next = moveAddress(
      currentAddress,
      rowDelta,
      columnDelta,
      activeObject.rows,
      activeObject.columns,
    );
    if (extend) {
      const anchor = rangeByObjectRef.current[activeObject.id]?.anchor || currentAddress;
      selectRange(activeObject.id, anchor, next);
    } else {
      selectAddress(activeObject.id, next);
    }
    focusSheetCell(activeObject.id, next);
  }, [layers, selectAddress, selectRange, workspace.objects]);

  const pasteTextIntoActiveCell = useCallback((object, cell, text) => {
    const pasted = pasteChanges(cell.address, text);
    updateCells(object.id, pasted.changes, "paste");
    selectRange(object.id, cell.address, pasted.endAddress, cell.address);
    focusSheetCell(object.id, cell.address);
  }, [selectRange, updateCells]);

  const clipboardSelectedCell = useCallback(async (mode) => {
    const activeLayer = layers[layers.length - 1];
    const object = workspace.objects[activeLayer.objectId];
    if (object?.type !== "sheet") return;
    const cell = selectedCellFor(object);
    const selection = rangeByObjectRef.current[object.id] || { anchor: cell.address, focus: cell.address };
    if (mode === "copy" || mode === "cut") {
      if (!clipboardMethodAvailable("writeText")) return;
      try {
        await navigator.clipboard.writeText(serializeRange(object, selection));
      } catch {
        showNotice("Could not write to the clipboard");
        return;
      }
      if (mode === "cut") clearCells(object.id, cellIdsInRange(selection));
      showNotice(`${mode === "cut" ? "Cut" : "Copied"} ${rangeLabel(selection)}`);
    } else if (clipboardMethodAvailable("readText")) {
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
              focusSheetCell(object.id, cell.address);
              showNotice("Pasted image into the selected tile");
              return;
            }
          }
        } catch {
          // Browsers may deny image clipboard reads; the text fallback remains available.
        }
      }
      try {
        const text = await navigator.clipboard.readText();
        pasteTextIntoActiveCell(object, cell, text);
      } catch {
        showNotice("Could not read the clipboard");
      }
    }
  }, [clearCells, createEmbeddedFile, layers, pasteTextIntoActiveCell, selectedCellFor, showNotice, workspace.objects]);

  const handlePaste = useCallback(async (event) => {
    const activeLayer = layers[layers.length - 1];
    const object = workspace.objects[activeLayer?.objectId];
    if (object?.type !== "sheet") return;
    const cell = selectedCellFor(object);
    const imageFile = imageFileFromClipboard(event.clipboardData);
    const pasteProxy = event.target?.dataset?.tactilePasteProxy === "true";
    if (event.defaultPrevented || (!imageFile && isTypingTarget(event.target) && !pasteProxy)) return;
    const clipboardTypes = Array.from(event.clipboardData?.types || []);
    const text = typeof event.clipboardData?.getData === "function"
      ? event.clipboardData.getData("text/plain")
      : "";
    const hasText = clipboardTypes.includes("text/plain") || Boolean(text);
    if (!imageFile && !hasText) return;
    event.preventDefault();
    if (imageFile) {
      try {
        const asset = await readLocalFile(imageFile);
        const created = createEmbeddedFile(object.id, cell.id, asset);
        if (created) {
          focusSheetCell(object.id, cell.address);
          showNotice("Pasted image into the selected tile");
        }
      } catch {
        showNotice("Could not paste the image");
      }
      return;
    }
    pasteTextIntoActiveCell(object, cell, text);
  }, [createEmbeddedFile, layers, pasteTextIntoActiveCell, selectedCellFor, showNotice, workspace.objects]);

  const clearSelectedCell = useCallback(() => {
    const activeLayer = layers[layers.length - 1];
    const object = workspace.objects[activeLayer.objectId];
    if (object?.type !== "sheet") return;
    const cell = selectedCellFor(object);
    const selection = rangeByObjectRef.current[object.id] || { anchor: cell.address, focus: cell.address };
    clearCells(object.id, cellIdsInRange(selection));
  }, [clearCells, layers, selectedCellFor, workspace.objects]);

  const selectUsedSheet = useCallback(() => {
    const activeLayer = layers[layers.length - 1];
    const object = workspace.objects[activeLayer.objectId];
    if (object?.type !== "sheet") return;
    const bounds = usedSheetBounds(object);
    const end = bounds.rows && bounds.columns
      ? cellAddress(bounds.rows - 1, bounds.columns - 1)
      : "A1";
    const activeAddress = selectedByObjectRef.current[object.id] || "A1";
    selectRange(object.id, "A1", end, activeAddress);
  }, [layers, selectRange, workspace.objects]);

  const handleKeyboard = useCallback((event, settingsOpen, closeSettings, closeTopLayer, expandTopLayer) => {
    if (isTypingSurface(event.target) || event.defaultPrevented) return;

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
      // Let the browser emit its native paste event. The window-level paste
      // handler below can read its DataTransfer even when the async clipboard
      // API is unavailable or permission-denied, which is common in previews.
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
    if ((event.key === "Delete" || event.key === "Backspace") && isGridSurface(event.target)) {
      event.preventDefault();
      clearSelectedCell();
      return;
    }
    if (!isSheetNavigationTarget(event.target)) return;
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
  }, [clearSelectedCell, clipboardSelectedCell, moveSelection, openSelectedEmbeddedObject, redo, selectUsedSheet, undo]);

  return {
    selectedByObject,
    rangeByObject,
    resetSelection,
    selectedCellFor,
    selectAddress,
    selectRange,
    openSelectedEmbeddedObject,
    moveSelection,
    clipboardSelectedCell,
    clearSelectedCell,
    handlePaste,
    selectUsedSheet,
    handleKeyboard,
  };
}

export function readLocalFile(file) {
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
