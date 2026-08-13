import { useCallback, useEffect, useRef, useState } from "react";

export const CELL_EDIT_SEED_EVENT = "tactile:cell-edit-seed";

const surfaceDraftState = new WeakMap();

function stateForSurface(surface) {
  if (!surface) return null;
  let state = surfaceDraftState.get(surface);
  if (!state) {
    state = {
      drafts: new Map(),
      listeners: new Set(),
    };
    surfaceDraftState.set(surface, state);
  }
  return state;
}

export function setLocalCellDraft(surface, cellId, draft) {
  const state = stateForSurface(surface);
  if (!state || !cellId) return;
  if (draft) state.drafts.set(String(cellId), draft);
  else state.drafts.delete(String(cellId));
  state.listeners.forEach((listener) => listener());
}

export function dispatchCellEditSeed(sourceElement, value) {
  const editor = sourceElement?.closest?.(".object-surface")?.querySelector?.(".formula-editor");
  if (!editor) return false;
  editor.dispatchEvent(new CustomEvent(CELL_EDIT_SEED_EVENT, {
    detail: { value },
  }));
  return true;
}

export function useLocalCellDraft(cellRef, cellId) {
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    const surface = cellRef.current?.closest?.(".object-surface");
    const state = stateForSurface(surface);
    if (!state || !cellId) return undefined;
    const key = String(cellId);
    const update = () => setDraft(state.drafts.get(key) || null);
    state.listeners.add(update);
    update();
    return () => {
      state.listeners.delete(update);
      setDraft(null);
    };
  }, [cellId, cellRef]);

  return draft;
}

export function useLocalDraft(canonicalValue, onCommit) {
  const [draft, setDraft] = useState(canonicalValue);
  const draftRef = useRef(canonicalValue);
  const baselineRef = useRef(canonicalValue);
  const canonicalRef = useRef(canonicalValue);
  const activeRef = useRef(false);
  const onCommitRef = useRef(onCommit);
  canonicalRef.current = canonicalValue;
  onCommitRef.current = onCommit;

  useEffect(() => {
    if (activeRef.current) return;
    draftRef.current = canonicalValue;
    baselineRef.current = canonicalValue;
    setDraft(canonicalValue);
  }, [canonicalValue]);

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

  const commitDraft = useCallback((next = draftRef.current) => {
    const changed = !Object.is(next, baselineRef.current);
    draftRef.current = next;
    baselineRef.current = next;
    activeRef.current = false;
    setDraft(next);
    if (changed) onCommitRef.current(next);
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
