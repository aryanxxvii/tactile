import { useCallback, useEffect, useRef, useState } from "react";

export const CELL_EDIT_SEED_EVENT = "tactile:cell-edit-seed";
export const CELL_EDIT_UPDATE_EVENT = "tactile:cell-edit-update";
export const CELL_EDIT_COMMIT_EVENT = "tactile:cell-edit-commit";

const surfaceDraftState = new WeakMap();

function stateForSurface(surface) {
  if (!surface) return null;
  let state = surfaceDraftState.get(surface);
  if (!state) {
    state = {
      drafts: new Map(),
      listeners: new Map(),
    };
    surfaceDraftState.set(surface, state);
  }
  return state;
}

export function setLocalCellDraft(surface, cellId, draft) {
  const state = stateForSurface(surface);
  if (!state || !cellId) return;
  const key = String(cellId);
  if (draft) state.drafts.set(key, draft);
  else state.drafts.delete(key);
  state.listeners.get(key)?.forEach((listener) => listener());
  state.surfaceListeners?.forEach((listener) => listener());
}

export function getSurfaceCellDrafts(surface) {
  const state = stateForSurface(surface);
  return state ? state.drafts : null;
}

export function subscribeSurfaceCellDrafts(surface, listener) {
  const state = stateForSurface(surface);
  if (!state) return () => {};
  const listeners = state.surfaceListeners || new Set();
  listeners.add(listener);
  state.surfaceListeners = listeners;
  return () => {
    listeners.delete(listener);
    if (!listeners.size) delete state.surfaceListeners;
  };
}

export function dispatchCellEditSeed(sourceElement, value, options = {}) {
  const editor = sourceElement?.closest?.(".object-surface")?.querySelector?.(".formula-editor");
  if (!editor) return false;
  editor.dispatchEvent(new CustomEvent(CELL_EDIT_SEED_EVENT, {
    detail: { value, ...options },
  }));
  return true;
}

export function dispatchCellEditUpdate(sourceElement, value) {
  const editor = sourceElement?.closest?.(".object-surface")?.querySelector?.(".formula-editor");
  if (!editor) return false;
  editor.dispatchEvent(new CustomEvent(CELL_EDIT_UPDATE_EVENT, {
    detail: { value },
  }));
  return true;
}

export function dispatchCellEditCommitAny(sourceElement, detail) {
  const editor = sourceElement?.closest?.(".object-surface")?.querySelector?.(".formula-editor");
  if (!editor) return false;
  editor.dispatchEvent(new CustomEvent(CELL_EDIT_COMMIT_EVENT, { detail }));
  return true;
}

export function dispatchCellEditCommit(sourceElement) {
  const editor = sourceElement?.closest?.(".object-surface")?.querySelector?.(".formula-editor");
  if (!editor || document.activeElement !== editor) return false;
  return dispatchCellEditCommitAny(sourceElement);
}

export function useLocalCellDraft(cellRef, cellId) {
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    const surface = cellRef.current?.closest?.(".object-surface");
    const state = stateForSurface(surface);
    if (!state || !cellId) return undefined;
    const key = String(cellId);
    const update = () => setDraft(state.drafts.get(key) || null);
    const listeners = state.listeners.get(key) || new Set();
    listeners.add(update);
    state.listeners.set(key, listeners);
    update();
    return () => {
      const listeners = state.listeners.get(key);
      listeners?.delete(update);
      if (!listeners?.size) state.listeners.delete(key);
      setDraft(null);
    };
  }, [cellId, cellRef]);

  return draft;
}

export function useLocalDraft(canonicalValue, onCommit, draftKey) {
  const [draft, setDraft] = useState(canonicalValue);
  const draftRef = useRef(canonicalValue);
  const baselineRef = useRef(canonicalValue);
  const canonicalRef = useRef(canonicalValue);
  const draftKeyRef = useRef(draftKey);
  const activeRef = useRef(false);
  const onCommitRef = useRef(onCommit);
  canonicalRef.current = canonicalValue;
  onCommitRef.current = onCommit;

  useEffect(() => {
    const keyChanged = !Object.is(draftKeyRef.current, draftKey);
    draftKeyRef.current = draftKey;
    if (keyChanged) {
      activeRef.current = false;
      draftRef.current = canonicalValue;
      baselineRef.current = canonicalValue;
      setDraft(canonicalValue);
      return;
    }
    if (activeRef.current) return;
    draftRef.current = canonicalValue;
    baselineRef.current = canonicalValue;
    setDraft(canonicalValue);
  }, [canonicalValue, draftKey]);

  const updateDraft = useCallback((next) => {
    if (!activeRef.current) baselineRef.current = canonicalRef.current;
    activeRef.current = true;
    draftRef.current = next;
    setDraft(next);
  }, []);

  const beginDraft = useCallback((next = draftRef.current) => {
    if (!activeRef.current) baselineRef.current = canonicalRef.current;
    activeRef.current = true;
    draftRef.current = next;
    setDraft(next);
  }, []);

  const commitDraft = useCallback((next = draftRef.current, options) => {
    const changed = !Object.is(next, baselineRef.current);
    draftRef.current = next;
    baselineRef.current = next;
    activeRef.current = false;
    setDraft(next);
    if (changed) onCommitRef.current(next, options);
    return changed;
  }, []);

  const cancelDraft = useCallback(() => {
    const next = baselineRef.current;
    draftRef.current = next;
    activeRef.current = false;
    setDraft(next);
    return next;
  }, []);

  return {
    draft,
    draftRef,
    activeRef,
    updateDraft,
    beginDraft,
    commitDraft,
    cancelDraft,
  };
}
