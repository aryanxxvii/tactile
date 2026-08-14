import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_COLUMNS,
  DEFAULT_ROWS,
  createBlankWorkspace,
  createCellRecord,
  createId,
  createObjectForType,
  deleteObjectFromWorkspace,
  generatedObjectTitle,
  inferFileObjectType,
  isCellUsed,
  normalizeWorkspace,
} from "../model.js";
import { normalizeIconEmoji } from "../iconEmoji.js";
import { repairWorkspaceTopology } from "../core/topology.js";
import { reparentWorkspace } from "../core/reparenting.js";
import { cellAddress, cellId, coordinatesFromCellId } from "../sheet/coordinates.js";
import {
  adjustAxisGroups,
  adjustColumnFilters,
  adjustConditionalFormats,
  adjustFormulaForAxis,
  reorderFormulaForAxis,
} from "../sheet/structure.js";
import { loadWorkspace, loadWorkspaceCache, saveWorkspace } from "../storage.js";
import { createWave2Shadow } from "../core/engine/shadow.js";
import { recordCellChanges } from "../objects/sheet/grid/cellChangeJournal.js";

function initialWorkspace() {
  return normalizeWorkspace(loadWorkspaceCache() || createBlankWorkspace());
}

function touch(workspace, objects, repairTopology = false) {
  const next = {
    ...workspace,
    updatedAt: new Date().toISOString(),
    objects,
  };
  return repairTopology ? repairWorkspaceTopology(next) : next;
}

function cloneHistoryWorkspace(workspace) {
  if (typeof structuredClone === "function") return structuredClone(workspace);
  return JSON.parse(JSON.stringify(workspace));
}

function cloneHistoryCell(cell) {
  return cell ? { ...cell } : null;
}

function applyCellHistory(workspace, entry, direction) {
  const object = workspace.objects[entry.objectId];
  if (object?.type !== "sheet") return workspace;
  const cells = object.cells;
  entry.changes.forEach((change) => {
    const cell = change[direction];
    if (cell) cells[change.cellId] = { ...cell };
    else delete cells[change.cellId];
  });
  recordCellChanges(cells, entry.changes.map((change) => change.cellId));
  return touch({
    ...workspace,
    objects: { ...workspace.objects, [entry.objectId]: { ...object, cells } },
  }, { ...workspace.objects, [entry.objectId]: { ...object, cells } }, entry.changes.some((change) => Boolean(change.before?.embed || change.after?.embed)));
}

function shiftCells(object, axis, index) {
  const cells = {};
  Object.values(object.cells || {}).forEach((cell) => {
    const row = axis === "row" && cell.row >= index ? cell.row + 1 : cell.row;
    const column = axis === "column" && cell.column >= index ? cell.column + 1 : cell.column;
    const shifted = {
      ...cell,
      id: cellId(row, column),
      address: cellAddress(row, column),
      row,
      column,
      formula: adjustFormulaForAxis(cell.formula, axis, index, "insert"),
    };
    cells[shifted.id] = shifted;
  });
  return cells;
}

function removeSheetAxisCells(object, axis, index) {
  const cells = {};
  Object.values(object.cells || {}).forEach((cell) => {
    if ((axis === "row" && cell.row === index) || (axis === "column" && cell.column === index)) return;
    const row = axis === "row" && cell.row > index ? cell.row - 1 : cell.row;
    const column = axis === "column" && cell.column > index ? cell.column - 1 : cell.column;
    const shifted = {
      ...cell,
      id: cellId(row, column),
      address: cellAddress(row, column),
      row,
      column,
      formula: adjustFormulaForAxis(cell.formula, axis, index, "delete"),
    };
    cells[shifted.id] = shifted;
  });
  return cells;
}

function shiftAxisSizes(sizes, index, operation) {
  const next = {};
  Object.entries(sizes || {}).forEach(([key, value]) => {
    const current = Number(key);
    if (!Number.isInteger(current)) return;
    if (operation === "delete" && current === index) return;
    const shifted = operation === "insert" && current >= index
      ? current + 1
      : operation === "delete" && current > index
        ? current - 1
        : current;
    next[shifted] = value;
  });
  return next;
}

function reorderAxisSizes(sizes, indexMap) {
  const next = {};
  Object.entries(sizes || {}).forEach(([key, value]) => {
    const current = Number(key);
    const reordered = indexMap.get(current);
    if (Number.isInteger(reordered)) next[reordered] = value;
  });
  return next;
}

function reorderSheetAxis(object, axis, from, to) {
  const length = axis === "row" ? object.rows : object.columns;
  if (from === to || from < 0 || to < 0 || from >= length || to >= length) return object;
  const order = Array.from({ length }, (_, index) => index);
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved);
  const indexMap = new Map(order.map((original, next) => [original, next]));
  const cells = {};
  Object.values(object.cells || {}).forEach((cell) => {
    const row = axis === "row" ? indexMap.get(cell.row) : cell.row;
    const column = axis === "column" ? indexMap.get(cell.column) : cell.column;
    const shifted = {
      ...cell,
      id: cellId(row, column),
      address: cellAddress(row, column),
      row,
      column,
      formula: reorderFormulaForAxis(cell.formula, axis, indexMap),
    };
    cells[shifted.id] = shifted;
  });
  return {
    ...object,
    cells,
    rowHeights: axis === "row" ? reorderAxisSizes(object.rowHeights, indexMap) : object.rowHeights,
    columnWidths: axis === "column" ? reorderAxisSizes(object.columnWidths, indexMap) : object.columnWidths,
    filters: axis === "column"
      ? (object.filters || []).map((filter) => ({ ...filter, column: indexMap.get(filter.column) ?? filter.column }))
      : object.filters,
    conditionalFormats: (object.conditionalFormats || []).map((rule) => ({
      ...rule,
      range: reorderFormulaForAxis(`=${rule.range}`, axis, indexMap).slice(1),
    })),
  };
}

export function useLocalWorkspace() {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [saveState, setSaveState] = useState("loading local copy");
  const [hydrated, setHydrated] = useState(false);
  const saveTimer = useRef(null);
  const saveSequenceRef = useRef(0);
  const historyRef = useRef({ past: [], future: [], lastKey: null, lastAt: 0 });
  const wave2ShadowRef = useRef(null);
  const workspaceMutationRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadWorkspace().then(async (stored) => {
      if (cancelled) return;
      const initial = normalizeWorkspace(stored || initialWorkspace());
      const controller = createWave2Shadow(initial, {
        useInitialSnapshot: true,
      });
      wave2ShadowRef.current = controller;
      const resolved = await controller.ready;
      if (cancelled) {
        controller.dispose();
        wave2ShadowRef.current = null;
        return;
      }
      // Keep the render snapshot independent from the bridge's normalized
      // snapshot. Cell edits intentionally update only the affected sparse
      // records in place, so sharing this object would let a render update
      // mutate the bridge's previous-state baseline before reconciliation.
      if (!workspaceMutationRef.current) {
        setWorkspace(normalizeWorkspace(cloneHistoryWorkspace(resolved || initial)));
      }
      historyRef.current = { past: [], future: [], lastKey: null, lastAt: 0 };
      setHydrated(true);
      setSaveState("saved");
    });
    return () => {
      cancelled = true;
      wave2ShadowRef.current?.dispose?.();
      wave2ShadowRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return undefined;
    const shadow = wave2ShadowRef.current;
    const sequence = ++saveSequenceRef.current;
    // The Wave 2 record adapter persists dirty cells and metadata as patches.
    // Falling back to the legacy snapshot writer here during normal edits
    // serializes the entire workspace on the input path, including large
    // fixtures and binary metadata. Keep the snapshot writer for environments
    // where the record adapter is unavailable.
    window.clearTimeout(saveTimer.current);
    if (shadow?.state?.persistence === "active") return undefined;
    setSaveState("saving");
    saveTimer.current = window.setTimeout(async () => {
      const persisted = await saveWorkspace(workspace);
      if (sequence !== saveSequenceRef.current) return;
      setSaveState(persisted ? "saved" : "saved in local cache");
    }, 120);
    return () => window.clearTimeout(saveTimer.current);
  }, [hydrated, workspace]);

  useEffect(() => {
    const shadow = wave2ShadowRef.current;
    if (!hydrated || !shadow) return undefined;
    let current = true;
    setSaveState("saving");
    Promise.resolve(shadow.reconcile(workspace, { normalized: true })).then(
      () => {
        if (!current) return;
        setSaveState(shadow.state.persistence === "active" ? "saved" : "saved in local cache");
      },
      () => {
        if (current) setSaveState("saved in local cache");
      },
    );
    return () => { current = false; };
  }, [hydrated, workspace]);

  const commitWorkspace = useCallback((updater, historyKey = "workspace") => {
    setWorkspace((current) => {
      const next = updater(current);
      if (next === current) return current;
      const history = historyRef.current;
      const now = Date.now();
      const coalesced = history.lastKey === historyKey && now - history.lastAt < 650;
      if (!coalesced) {
        history.past.push({ kind: "snapshot", value: cloneHistoryWorkspace(current) });
        if (history.past.length > 120) history.past.shift();
      }
      history.future = [];
      history.lastKey = historyKey;
      history.lastAt = now;
      return next;
    });
  }, []);

  const commitCellChanges = useCallback((objectId, changes, historyKey = "range") => {
    if (!Array.isArray(changes) || !changes.length) return;
    setWorkspace((current) => {
      const object = current.objects[objectId];
      if (object?.type !== "sheet") return current;
      const historyChanges = [];
      let changed = false;
      const cells = object.cells;
      changes.forEach(({ cellId: targetCellId, patch }) => {
        const coordinates = coordinatesFromCellId(targetCellId);
        if (!coordinates) return;
        const before = cells[targetCellId] || null;
        const cell = createCellRecord(coordinates.row, coordinates.column, {
          ...(before || {}),
          ...(patch || {}),
        });
        const after = isCellUsed(cell) ? cell : null;
        const beforeValue = JSON.stringify(before || null);
        const afterValue = JSON.stringify(after || null);
        if (beforeValue === afterValue) return;
        if (after) cells[targetCellId] = after;
        else delete cells[targetCellId];
        changed = true;
        historyChanges.push({
          cellId: targetCellId,
          before: cloneHistoryCell(before),
          after: cloneHistoryCell(after),
        });
      });
      if (!changed) return current;

      recordCellChanges(cells, historyChanges.map((change) => change.cellId));

      const history = historyRef.current;
      const now = Date.now();
      const coalesced = history.lastKey === historyKey && now - history.lastAt < 650;
      const last = history.past.at(-1);
      if (coalesced && last?.kind === "cells" && last.historyKey === historyKey && last.objectId === objectId) {
        const byCell = new Map(last.changes.map((change) => [change.cellId, change]));
        historyChanges.forEach((change) => {
          const existing = byCell.get(change.cellId);
          if (existing) existing.after = change.after;
          else byCell.set(change.cellId, change);
        });
        last.changes = [...byCell.values()];
      } else {
        history.past.push({ kind: "cells", historyKey, objectId, changes: historyChanges });
        if (history.past.length > 120) history.past.shift();
      }
      history.future = [];
      history.lastKey = historyKey;
      history.lastAt = now;
      return touch({
        ...current,
        objects: { ...current.objects, [objectId]: { ...object, cells } },
      }, { ...current.objects, [objectId]: { ...object, cells } }, changes.some(({ patch }) => Object.prototype.hasOwnProperty.call(patch || {}, "embed")));
    });
  }, []);

  const replaceWorkspace = useCallback((nextWorkspace) => {
    workspaceMutationRef.current = true;
    historyRef.current = { past: [], future: [], lastKey: null, lastAt: 0 };
    setWorkspace(normalizeWorkspace(nextWorkspace));
  }, []);

  const updateObject = useCallback((objectId, patch) => {
    const normalizedPatch = Object.prototype.hasOwnProperty.call(patch || {}, "iconEmoji")
      ? { ...patch, iconEmoji: normalizeIconEmoji(patch.iconEmoji) }
      : patch;
    commitWorkspace((current) => {
      const object = current.objects[objectId];
      if (!object) return current;
      return touch(current, {
          ...current.objects,
        [objectId]: { ...object, ...normalizedPatch },
      });
    }, `object:${objectId}:${Object.keys(normalizedPatch || {}).sort().join(",")}`);
  }, [commitWorkspace]);

  const updateCell = useCallback((objectId, targetCellId, patch) => {
    commitCellChanges(objectId, [{ cellId: targetCellId, patch }], `cell:${objectId}:${targetCellId}`);
  }, [commitCellChanges]);

  const updateCells = useCallback((objectId, changes, historyKey = "range") => {
    commitCellChanges(objectId, changes, `${historyKey}:${objectId}`);
  }, [commitCellChanges]);

  const clearCell = useCallback((objectId, targetCellId) => {
    commitCellChanges(objectId, [{ cellId: targetCellId, patch: {
      value: "",
      formula: "",
      embed: null,
      note: null,
      style: null,
      validation: null,
      role: null,
    } }], `clear:${objectId}:${targetCellId}`);
  }, [commitCellChanges]);

  const clearCells = useCallback((objectId, targetCellIds) => {
    if (!Array.isArray(targetCellIds) || !targetCellIds.length) return;
    commitCellChanges(objectId, targetCellIds.map((cellId) => ({ cellId, patch: {
      value: "",
      formula: "",
      embed: null,
      note: null,
      style: null,
      validation: null,
      role: null,
    } })), `clear-range:${objectId}`);
  }, [commitCellChanges]);

  const createEmbeddedObject = useCallback((parentObjectId, parentCellId, type) => {
    const coordinates = coordinatesFromCellId(parentCellId);
    if (!coordinates) return null;
    const address = cellAddress(coordinates.row, coordinates.column);
    const created = createObjectForType(type, {
      title: generatedObjectTitle(type, address),
    });
    const linkId = createId("link");
    created.parent = {
      linkId,
      parentObjectId,
      parentCellId,
      sourceAddress: address,
    };
    commitWorkspace((current) => {
      const parent = current.objects[parentObjectId];
      if (parent?.type !== "sheet") return current;
      const cell = createCellRecord(coordinates.row, coordinates.column, {
        ...(parent.cells[parentCellId] || {}),
        value: created.title,
        formula: "",
        embed: {
          objectId: created.id,
          type: created.type,
          linkId,
          relation: "containment",
        },
      });
      return touch(current, {
        ...current.objects,
        [parentObjectId]: {
          ...parent,
          cells: { ...parent.cells, [parentCellId]: cell },
        },
        [created.id]: created,
      }, true);
    }, `create:${parentObjectId}:${parentCellId}`);
    return created;
  }, [commitWorkspace]);

  const createObject = useCallback((type) => {
    if (type !== "sheet" && type !== "markdown") return null;
    const created = createObjectForType(type);
    commitWorkspace((current) => touch(current, {
      ...current.objects,
      [created.id]: created,
    }, true), `create-root:${created.id}`);
    return created;
  }, [commitWorkspace]);

  const createEmbeddedFile = useCallback((parentObjectId, parentCellId, fileAsset) => {
    const coordinates = coordinatesFromCellId(parentCellId);
    if (!coordinates || !fileAsset) return null;
    const type = inferFileObjectType(fileAsset);
    const assetId = fileAsset.id || `asset-${Date.now().toString(36)}`;
    const fileName = fileAsset.fileName || fileAsset.name || generatedObjectTitle(type);
    const title = fileName.replace(/\.[^.]+$/, "") || generatedObjectTitle(type, cellAddress(coordinates.row, coordinates.column));
    const created = createObjectForType(type, type === "markdown"
      ? { title, content: fileAsset.text || "" }
      : { title, assetId, source: type === "html" ? fileAsset.text || "" : "" });
    const linkId = createId("link");
    created.parent = {
      linkId,
      parentObjectId,
      parentCellId,
      sourceAddress: cellAddress(coordinates.row, coordinates.column),
    };
    const asset = { ...fileAsset, id: assetId, fileName };
    commitWorkspace((current) => {
      const parent = current.objects[parentObjectId];
      if (parent?.type !== "sheet") return current;
      const cell = createCellRecord(coordinates.row, coordinates.column, {
        ...(parent.cells[parentCellId] || {}),
        value: created.title,
        formula: "",
        embed: {
          objectId: created.id,
          type: created.type,
          linkId,
          relation: "containment",
        },
      });
      const next = touch(current, {
          ...current.objects,
          [parentObjectId]: {
            ...parent,
            cells: { ...parent.cells, [parentCellId]: cell },
          },
          [created.id]: created,
        }, true);
      return type === "markdown"
        ? next
        : { ...next, assets: { ...current.assets, [assetId]: asset } };
    }, `create-file:${parentObjectId}:${parentCellId}`);
    return created;
  }, [commitWorkspace]);

  const replaceObjectFile = useCallback((objectId, fileAsset) => {
    if (!fileAsset) return;
    const type = inferFileObjectType(fileAsset);
    const assetId = fileAsset.id || `asset-${Date.now().toString(36)}`;
    const fileName = fileAsset.fileName || fileAsset.name || generatedObjectTitle(type);
    commitWorkspace((current) => {
      const previous = current.objects[objectId];
      if (!previous || previous.type === "sheet") return current;
      const replacement = type === "markdown"
        ? {
            id: previous.id,
            type: "markdown",
            title: previous.title,
            description: previous.description || "",
            parent: previous.parent || null,
            content: fileAsset.text || "",
          }
        : {
            id: previous.id,
            type,
            title: previous.title,
            description: previous.description || "",
            parent: previous.parent || null,
            assetId,
            source: type === "html" ? fileAsset.text || "" : "",
          };
      const objects = Object.fromEntries(Object.entries(current.objects).map(([id, object]) => {
        if (id === objectId) return [id, replacement];
        if (object.type !== "sheet") return [id, object];
        let changed = false;
        const cells = Object.fromEntries(Object.entries(object.cells || {}).map(([cellKey, cell]) => {
          if (cell.embed?.objectId !== objectId) return [cellKey, cell];
          changed = true;
          return [cellKey, { ...cell, embed: { ...cell.embed, type } }];
        }));
        return [id, changed ? { ...object, cells } : object];
      }));
      const assets = { ...current.assets };
      if (previous.assetId) delete assets[previous.assetId];
      if (type !== "markdown") assets[assetId] = { ...fileAsset, id: assetId, fileName };
      return {
        ...touch(current, objects),
        assets,
      };
    }, `replace-file:${objectId}`);
  }, [commitWorkspace]);

  const reparentObject = useCallback((input = {}) => {
    const preview = reparentWorkspace(workspace, input);
    if (!preview.ok) return preview;
    const historyKey = `reparent:${preview.objectId}:${preview.linkId}:${preview.targetObjectId}:${preview.targetCellId}`;
    commitWorkspace((current) => {
      const result = reparentWorkspace(current, input);
      return result.ok ? result.workspace : current;
    }, historyKey);
    return preview;
  }, [commitWorkspace, workspace]);
  const deleteObject = useCallback((objectId) => {
    commitWorkspace((current) => deleteObjectFromWorkspace(current, objectId), `object-delete:${objectId}`);
  }, [commitWorkspace]);

  const insertSheetAxis = useCallback((objectId, axis, index) => {
    commitWorkspace((current) => {
      const object = current.objects[objectId];
      if (object?.type !== "sheet") return current;
      const rows = axis === "row" ? Math.max(DEFAULT_ROWS, object.rows + 1) : object.rows;
      const columns = axis === "column" ? Math.max(DEFAULT_COLUMNS, object.columns + 1) : object.columns;
      return touch(current, {
        ...current.objects,
        [objectId]: {
          ...object,
          rows,
          columns,
          cells: shiftCells(object, axis, index),
          rowHeights: axis === "row" ? shiftAxisSizes(object.rowHeights, index, "insert") : object.rowHeights,
          columnWidths: axis === "column" ? shiftAxisSizes(object.columnWidths, index, "insert") : object.columnWidths,
          rowGroups: axis === "row" ? adjustAxisGroups(object.rowGroups, index, "insert") : object.rowGroups,
          columnGroups: axis === "column" ? adjustAxisGroups(object.columnGroups, index, "insert") : object.columnGroups,
          filters: axis === "column" ? adjustColumnFilters(object.filters, index, "insert") : object.filters,
          conditionalFormats: adjustConditionalFormats(object.conditionalFormats, axis, index, "insert"),
        },
      }, true);
    }, `insert:${objectId}:${axis}:${index}`);
  }, [commitWorkspace]);

  const deleteSheetAxis = useCallback((objectId, axis, index) => {
    commitWorkspace((current) => {
      const object = current.objects[objectId];
      if (object?.type !== "sheet") return current;
      const rows = axis === "row" ? Math.max(DEFAULT_ROWS, object.rows - 1) : object.rows;
      const columns = axis === "column" ? Math.max(DEFAULT_COLUMNS, object.columns - 1) : object.columns;
      return touch(current, {
        ...current.objects,
        [objectId]: {
          ...object,
          rows,
          columns,
          cells: removeSheetAxisCells(object, axis, index),
          rowHeights: axis === "row" ? shiftAxisSizes(object.rowHeights, index, "delete") : object.rowHeights,
          columnWidths: axis === "column" ? shiftAxisSizes(object.columnWidths, index, "delete") : object.columnWidths,
          rowGroups: axis === "row" ? adjustAxisGroups(object.rowGroups, index, "delete") : object.rowGroups,
          columnGroups: axis === "column" ? adjustAxisGroups(object.columnGroups, index, "delete") : object.columnGroups,
          filters: axis === "column" ? adjustColumnFilters(object.filters, index, "delete") : object.filters,
          conditionalFormats: adjustConditionalFormats(object.conditionalFormats, axis, index, "delete"),
        },
      }, true);
    }, `delete:${objectId}:${axis}:${index}`);
  }, [commitWorkspace]);

  const moveSheetAxis = useCallback((objectId, axis, from, to) => {
    if (!Number.isInteger(from) || !Number.isInteger(to) || from === to) return;
    commitWorkspace((current) => {
      const object = current.objects[objectId];
      if (object?.type !== "sheet") return current;
      return touch(current, {
        ...current.objects,
        [objectId]: reorderSheetAxis(object, axis, from, to),
      }, true);
    }, `move:${objectId}:${axis}`);
  }, [commitWorkspace]);

  const setHomeObject = useCallback((objectId, homePath = []) => {
    commitWorkspace((current) => current.objects[objectId]
      ? normalizeWorkspace({
        ...current,
        homeObjectId: objectId,
        homePath: Array.isArray(homePath) ? homePath : [],
        updatedAt: new Date().toISOString(),
      })
      : current, `home:${objectId}`);
  }, [commitWorkspace]);

  const setActiveTheme = useCallback((themeId) => {
    commitWorkspace((current) => ({
      ...current,
      activeThemeId: themeId,
      updatedAt: new Date().toISOString(),
    }), `theme-select:${themeId}`);
  }, [commitWorkspace]);

  const saveTheme = useCallback((theme) => {
    commitWorkspace((current) => ({
      ...current,
      activeThemeId: theme.id,
      updatedAt: new Date().toISOString(),
      themes: { ...current.themes, [theme.id]: theme },
    }), `theme-save:${theme.id}`);
  }, [commitWorkspace]);

  const updateTheme = useCallback((themeId, patch) => {
    commitWorkspace((current) => {
      const theme = current.themes[themeId];
      if (!theme) return current;
      const nextTheme = {
        ...theme,
        ...patch,
        tokens: patch.tokens ? { ...theme.tokens, ...patch.tokens } : theme.tokens,
      };
      return {
        ...current,
        updatedAt: new Date().toISOString(),
        themes: { ...current.themes, [themeId]: nextTheme },
      };
    }, `theme-update:${themeId}:${Object.keys(patch.tokens || patch).sort().join(",")}`);
  }, [commitWorkspace]);

  const deleteTheme = useCallback((themeId) => {
    commitWorkspace((current) => {
      if (!current.themes[themeId]) return current;
      const themes = { ...current.themes };
      delete themes[themeId];
      return {
        ...current,
        activeThemeId: current.activeThemeId === themeId ? "paper-public" : current.activeThemeId,
        updatedAt: new Date().toISOString(),
        themes,
      };
    }, `theme-delete:${themeId}`);
  }, [commitWorkspace]);

  const updateSettings = useCallback((patch) => {
    commitWorkspace((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      settings: { ...current.settings, ...patch },
    }), `settings:${Object.keys(patch).sort().join(",")}`);
  }, [commitWorkspace]);

  const undo = useCallback(() => {
    setWorkspace((current) => {
      const history = historyRef.current;
      const previous = history.past.pop();
      if (!previous) return current;
      if (previous.kind === "cells") {
        history.future.push(previous);
        history.lastKey = null;
        history.lastAt = 0;
        return applyCellHistory(current, previous, "before");
      }
      history.future.push({ kind: "snapshot", value: cloneHistoryWorkspace(current) });
      history.lastKey = null;
      history.lastAt = 0;
      return { ...previous.value, updatedAt: new Date().toISOString() };
    });
  }, []);

  const redo = useCallback(() => {
    setWorkspace((current) => {
      const history = historyRef.current;
      const next = history.future.pop();
      if (!next) return current;
      if (next.kind === "cells") {
        history.past.push(next);
        history.lastKey = null;
        history.lastAt = 0;
        return applyCellHistory(current, next, "after");
      }
      history.past.push({ kind: "snapshot", value: cloneHistoryWorkspace(current) });
      history.lastKey = null;
      history.lastAt = 0;
      return { ...next.value, updatedAt: new Date().toISOString() };
    });
  }, []);

  return {
    workspace,
    hydrated,
    saveState,
    replaceWorkspace,
    updateObject,
    updateCell,
    updateCells,
    clearCell,
    clearCells,
    createObject,
    createEmbeddedObject,
    createEmbeddedFile,
    replaceObjectFile,
    reparentObject,
    deleteObject,
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
    canUndo: historyRef.current.past.length > 0,
    canRedo: historyRef.current.future.length > 0,
  };
}
