import { useCallback, useRef, useState } from "react";
import { materializeCell, usedSheetBounds } from "../model.js";
import { cellAddress, coordinatesFromAddress, moveAddress } from "../sheet/coordinates.js";
import { cellIdsInRange, normalizeRange, pasteChanges, rangeLabel, serializeRange } from "../sheet/ranges.js";

function isTypingTarget(target) {
  if (target?.dataset?.tactilePasteProxy === "true") return false;
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

function textOffsetWithin(root, node, offset) {
  if (!root || !node || (node !== root && !root.contains(node))) return null;
  const range = document.createRange?.();
  if (!range) return null;
  try {
    range.selectNodeContents(root);
    range.setEnd(node, offset);
    return range.toString().length;
  } catch {
    return null;
  }
}

function selectedCellTextTarget(event) {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  const selection = window.getSelection?.();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
  const range = selection.getRangeAt(0);

  const anchorElement = selection.anchorNode?.nodeType === Node.ELEMENT_NODE
    ? selection.anchorNode
    : selection.anchorNode?.parentElement;
  const focusElement = selection.focusNode?.nodeType === Node.ELEMENT_NODE
    ? selection.focusNode
    : selection.focusNode?.parentElement;
  const commonAncestorElement = range.commonAncestorContainer?.nodeType === Node.ELEMENT_NODE
    ? range.commonAncestorContainer
    : range.commonAncestorContainer?.parentElement;
  const cell = event.target?.closest?.(".sheet-cell")
    || anchorElement?.closest?.(".sheet-cell")
    || focusElement?.closest?.(".sheet-cell")
    || commonAncestorElement?.closest?.(".sheet-cell")
    || activeElement()?.closest?.(".sheet-cell");
  const valueNode = cell?.querySelector?.(".cell-value");
  if (!cell) return null;
  if (!valueNode || !valueNode.contains(anchorElement) || !valueNode.contains(focusElement)) {
    return { blocked: true };
  }

  const anchorOffset = textOffsetWithin(valueNode, selection.anchorNode, selection.anchorOffset);
  const focusOffset = textOffsetWithin(valueNode, selection.focusNode, selection.focusOffset);
  if (anchorOffset == null || focusOffset == null || anchorOffset === focusOffset) {
    return { blocked: true };
  }
  return {
    cell,
    valueNode,
    start: Math.min(anchorOffset, focusOffset),
    end: Math.max(anchorOffset, focusOffset),
    selection,
  };
}

function deleteSelectedCellText(event, object, updateCells) {
  const target = selectedCellTextTarget(event);
  if (!target) return false;
  if (target.blocked) {
    event.preventDefault();
    return true;
  }

  const address = target.cell.dataset.cellAddress;
  const coordinates = coordinatesFromAddress(address);
  const cell = coordinates ? materializeCell(object, coordinates.row, coordinates.column) : null;
  const value = cell?.value == null ? "" : String(cell.value);
  const renderedValue = target.valueNode.textContent || "";

  // Formula results, formatted values, and embedded labels do not map
  // cleanly back to a plain text slice. Consume the key rather than allowing
  // a partial browser selection to fall through to whole-cell clearing.
  if (!cell || cell.embed || cell.formula || value !== renderedValue) {
    event.preventDefault();
    return true;
  }

  event.preventDefault();
  updateCells(object.id, [{
    cellId: cell.id,
    patch: {
      value: `${value.slice(0, target.start)}${value.slice(target.end)}`,
      formula: "",
    },
  }], "text-edit");
  target.selection.removeAllRanges();
  focusSheetCell(object.id, address);
  return true;
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

function clipboardItemType(item, prefix) {
  return item?.types?.find((type) => type.startsWith(prefix));
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
  const [multiSelectedByObject, setMultiSelectedByObject] = useState({});
  const selectedByObjectRef = useRef({});
  const rangeByObjectRef = useRef({});
  const multiSelectedByObjectRef = useRef({});

  const resetSelection = useCallback(() => {
    selectedByObjectRef.current = {};
    rangeByObjectRef.current = {};
    multiSelectedByObjectRef.current = {};
    setSelectedByObject({});
    setRangeByObject({});
    setMultiSelectedByObject({});
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
    const nextMultiSelected = { ...multiSelectedByObjectRef.current, [objectId]: [] };
    selectedByObjectRef.current = nextSelected;
    rangeByObjectRef.current = nextRanges;
    multiSelectedByObjectRef.current = nextMultiSelected;
    setSelectedByObject(nextSelected);
    setRangeByObject(nextRanges);
    setMultiSelectedByObject(nextMultiSelected);
  }, []);

  const selectRange = useCallback((objectId, anchor, focus, activeAddress = focus) => {
    const nextSelected = { ...selectedByObjectRef.current, [objectId]: activeAddress };
    const nextRanges = {
      ...rangeByObjectRef.current,
      [objectId]: { anchor, focus },
    };
    const nextMultiSelected = { ...multiSelectedByObjectRef.current, [objectId]: [] };
    selectedByObjectRef.current = nextSelected;
    rangeByObjectRef.current = nextRanges;
    multiSelectedByObjectRef.current = nextMultiSelected;
    setSelectedByObject(nextSelected);
    setRangeByObject(nextRanges);
    setMultiSelectedByObject(nextMultiSelected);
  }, []);

  const toggleMultiSelect = useCallback((objectId, address) => {
    const currentActive = selectedByObjectRef.current[objectId] || address;
    const currentMultiSelected = multiSelectedByObjectRef.current[objectId] || [];
    const selectedAddresses = new Set(currentMultiSelected.length ? currentMultiSelected : [currentActive]);
    let nextActive = address;
    if (selectedAddresses.has(address)) {
      selectedAddresses.delete(address);
      if (!selectedAddresses.size) selectedAddresses.add(address);
      else if (address === currentActive) nextActive = [...selectedAddresses].at(-1);
    } else {
      selectedAddresses.add(address);
    }

    const nextSelected = { ...selectedByObjectRef.current, [objectId]: nextActive };
    const nextRanges = {
      ...rangeByObjectRef.current,
      [objectId]: { anchor: nextActive, focus: nextActive },
    };
    const nextMultiSelected = {
      ...multiSelectedByObjectRef.current,
      [objectId]: [...selectedAddresses],
    };
    selectedByObjectRef.current = nextSelected;
    rangeByObjectRef.current = nextRanges;
    multiSelectedByObjectRef.current = nextMultiSelected;
    setSelectedByObject(nextSelected);
    setRangeByObject(nextRanges);
    setMultiSelectedByObject(nextMultiSelected);
  }, []);

  const toggleAxisSelection = useCallback((objectId, axis, index) => {
    const object = workspace.objects[objectId];
    if (object?.type !== "sheet") return;
    const activeAddress = selectedByObjectRef.current[objectId] || "A1";
    const currentAddresses = new Set(multiSelectedByObjectRef.current[objectId] || []);
    if (!currentAddresses.size) {
      const currentRange = rangeByObjectRef.current[objectId];
      const normalizedCurrentRange = normalizeRange(currentRange?.anchor, currentRange?.focus);
      if (normalizedCurrentRange) {
        for (let row = normalizedCurrentRange.rowStart; row <= normalizedCurrentRange.rowEnd; row += 1) {
          for (let column = normalizedCurrentRange.columnStart; column <= normalizedCurrentRange.columnEnd; column += 1) {
            currentAddresses.add(cellAddress(row, column));
          }
        }
      }
      if (!currentAddresses.size) currentAddresses.add(activeAddress);
    }
    const axisAddresses = [];
    if (axis === "row") {
      for (let column = 0; column < object.columns; column += 1) {
        axisAddresses.push(cellAddress(index, column));
      }
    } else if (axis === "column") {
      for (let row = 0; row < object.rows; row += 1) {
        axisAddresses.push(cellAddress(row, index));
      }
    } else {
      return;
    }

    const axisIsSelected = axisAddresses.every((address) => currentAddresses.has(address));
    axisAddresses.forEach((address) => {
      if (axisIsSelected) currentAddresses.delete(address);
      else currentAddresses.add(address);
    });
    if (!currentAddresses.size) currentAddresses.add(activeAddress);

    const nextSelected = { ...selectedByObjectRef.current, [objectId]: activeAddress };
    const nextRanges = {
      ...rangeByObjectRef.current,
      [objectId]: { anchor: activeAddress, focus: activeAddress },
    };
    const nextMultiSelected = {
      ...multiSelectedByObjectRef.current,
      [objectId]: [...currentAddresses],
    };
    selectedByObjectRef.current = nextSelected;
    rangeByObjectRef.current = nextRanges;
    multiSelectedByObjectRef.current = nextMultiSelected;
    setSelectedByObject(nextSelected);
    setRangeByObject(nextRanges);
    setMultiSelectedByObject(nextMultiSelected);
  }, [workspace.objects]);

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

  const clipboardSelectedCell = useCallback(async (mode, pasteRequest = null) => {
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
    } else {
      let clipboardReadFailed = false;
      if (clipboardMethodAvailable("read")) {
        try {
          const clipboardItems = await navigator.clipboard.read();
          if (pasteRequest?.handled) return;
          const imageItem = clipboardItems.find((item) => clipboardItemType(item, "image/"));
          if (imageItem) {
            const imageType = clipboardItemType(imageItem, "image/");
            const blob = await imageItem.getType(imageType);
            if (pasteRequest?.handled) return;
            if (pasteRequest) pasteRequest.handled = true;
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
          const textItem = clipboardItems.find((item) => clipboardItemType(item, "text/plain"));
          if (textItem) {
            const textType = clipboardItemType(textItem, "text/plain");
            const textBlob = await textItem.getType(textType);
            const text = await textBlob.text();
            if (pasteRequest?.handled) return;
            if (pasteRequest) pasteRequest.handled = true;
            pasteTextIntoActiveCell(object, cell, text);
            return;
          }
        } catch {
          clipboardReadFailed = true;
        }
      }
      if (clipboardMethodAvailable("readText")) {
        try {
          const text = await navigator.clipboard.readText();
          if (pasteRequest?.handled) return;
          if (pasteRequest) pasteRequest.handled = true;
          pasteTextIntoActiveCell(object, cell, text);
          return;
        } catch {
          clipboardReadFailed = true;
        }
      }
      if (!pasteRequest?.handled && clipboardReadFailed) showNotice("Could not read the clipboard");
      focusSheetCell(object.id, cell.address);
    }
  }, [clearCells, createEmbeddedFile, layers, pasteTextIntoActiveCell, selectedCellFor, showNotice, workspace.objects]);

  const handlePaste = useCallback(async (event, pasteRequest = null) => {
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
    if (pasteRequest) pasteRequest.handled = true;
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
    const multiSelectedAddresses = multiSelectedByObjectRef.current[object.id] || [];
    if (multiSelectedAddresses.length > 1) {
      const cellIds = multiSelectedAddresses
        .map((address) => coordinatesFromAddress(address))
        .filter(Boolean)
        .map(({ row, column }) => materializeCell(object, row, column).id);
      clearCells(object.id, cellIds);
      return;
    }
    const selection = rangeByObjectRef.current[object.id] || { anchor: cell.address, focus: cell.address };
    clearCells(object.id, cellIdsInRange(selection));
  }, [clearCells, layers, selectedCellFor, workspace.objects]);

  const deleteSelectedText = useCallback((objectId, event) => {
    const object = workspace.objects[objectId];
    if (object?.type !== "sheet") return false;
    return deleteSelectedCellText(event, object, updateCells);
  }, [updateCells, workspace.objects]);

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
    if (event.key === "Enter" && isSheetNavigationTarget(event.target)) {
      event.preventDefault();
      if (!expandTopLayer()) openSelectedEmbeddedObject();
      return;
    }
    if (event.key === "[" || event.key === "Escape") {
      event.preventDefault();
      closeTopLayer();
      return;
    }
    const activeLayer = layers[layers.length - 1];
    const activeObject = workspace.objects[activeLayer?.objectId];
    if ((event.key === "Delete" || event.key === "Backspace")
      && activeObject?.type === "sheet"
      && deleteSelectedCellText(event, activeObject, updateCells)) return;
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
  }, [clearSelectedCell, clipboardSelectedCell, layers, moveSelection, openSelectedEmbeddedObject, redo, selectUsedSheet, undo, updateCells, workspace.objects]);

  return {
    selectedByObject,
    rangeByObject,
    multiSelectedByObject,
    resetSelection,
    selectedCellFor,
    selectAddress,
    selectRange,
    toggleMultiSelect,
    toggleAxisSelection,
    openSelectedEmbeddedObject,
    moveSelection,
    clipboardSelectedCell,
    clearSelectedCell,
    deleteSelectedText,
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
