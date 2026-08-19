import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconArrowRight, IconChevronDown, IconFilterOff } from "@tabler/icons-react";
import { coordinatesFromAddress } from "../sheet/coordinates.js";
import { FORMULA_CATALOG, formatFormulaResult } from "../sheet/formulas.js";
import { createFormulaWorker } from "../workers/formula/index.js";
import { CellFormatMenu } from "./CellFormatMenu.jsx";
import {
  CELL_EDIT_SEED_EVENT,
  CELL_EDIT_UPDATE_EVENT,
  CELL_EDIT_COMMIT_EVENT,
  setLocalCellDraft,
  useLocalDraft,
} from "./localEditSession.js";

function AddressPicker({ address, rangeLabel, onChange }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(address);
  const [invalid, setInvalid] = useState(false);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => setDraft(address), [address]);
  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    window.addEventListener("pointerdown", closeOutside);
    window.requestAnimationFrame(() => inputRef.current?.select());
    return () => window.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  const go = () => {
    const next = draft.trim().toUpperCase();
    if (!coordinatesFromAddress(next)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onChange(next);
    setOpen(false);
  };

  return (
    <div className="address-picker" ref={rootRef}>
      <button className="name-box" type="button" data-tooltip="Go to tile" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span>{rangeLabel || address || "A1"}</span>
        <IconChevronDown size={13} stroke={1.6} />
      </button>
      {open ? (
        <div className="address-popover" role="dialog" aria-label="Go to tile">
          <label>
            <span>Go to tile</span>
            <div className={invalid ? "address-input is-invalid" : "address-input"}>
              <input
                ref={inputRef}
                value={draft}
                onChange={(event) => { setDraft(event.target.value); setInvalid(false); }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") { event.preventDefault(); go(); }
                  if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
                }}
                spellCheck="false"
                aria-invalid={invalid}
              />
              <button type="button" onClick={go} aria-label="Go"><IconArrowRight size={14} stroke={1.7} /></button>
            </div>
          </label>
          <small>{invalid ? "Use an A1-style address" : "A1 addressing stays familiar"}</small>
        </div>
      ) : null}
    </div>
  );
}

function formulaQuery(value, caret) {
  if (!value.startsWith("=") || caret == null) return null;
  const beforeCaret = value.slice(0, caret);
  const match = /(?:^|[=(,+\-*/^])([A-Za-z][A-Za-z0-9.]*)$/.exec(beforeCaret);
  if (!match) return null;
  const prefix = match[1].toUpperCase();
  return { prefix, start: caret - match[1].length, end: caret };
}

function previewSheetForCell(sheet, cell, address) {
  if (sheet?.cells) return sheet;
  const row = Number.isInteger(cell?.row) ? cell.row : 0;
  const column = Number.isInteger(cell?.column) ? cell.column : 0;
  const id = cell?.id || `r${row + 1}c${column + 1}`;
  const normalizedAddress = address || cell?.address || "A1";
  return {
    id: `formula-preview-${id}`,
    type: "sheet",
    rows: Math.max(1, row + 1),
    columns: Math.max(1, column + 1),
    cells: {
      [id]: {
        ...cell,
        id,
        address: normalizedAddress,
        row,
        column,
        value: cell?.value || "",
        formula: cell?.formula || "",
        embed: cell?.embed || null,
      },
    },
  };
}

function useFormulaWorkerPreview({ value, address, cell, formulaSheet }) {
  const [preview, setPreview] = useState("");
  const workerRef = useRef(null);
  const initializeRef = useRef(null);
  const revisionRef = useRef(0);
  const requestRef = useRef(0);

  useEffect(() => {
    workerRef.current?.dispose?.();
    workerRef.current = null;
    initializeRef.current = null;
    revisionRef.current = 0;
    setPreview("");
  }, [formulaSheet]);

  useEffect(() => () => workerRef.current?.dispose?.(), []);

  useEffect(() => {
    if (!value.startsWith("=")) {
      setPreview("");
      return undefined;
    }
    if (typeof Worker === "undefined") return undefined;

    let cancelled = false;
    const requestSerial = ++requestRef.current;
    const sheet = previewSheetForCell(formulaSheet, cell, address);
    const run = async () => {
      try {
        if (!workerRef.current) {
          workerRef.current = createFormulaWorker();
          initializeRef.current = workerRef.current.initialize(sheet, { revision: 0 });
          await initializeRef.current;
        } else if (initializeRef.current) {
          await initializeRef.current;
        }
        if (cancelled || requestSerial !== requestRef.current || !workerRef.current) return;
        const revision = revisionRef.current + 1;
        revisionRef.current = revision;
        const result = await workerRef.current.update([{
          address: address || cell?.address || "A1",
          patch: { value: "", formula: value },
        }], { revision });
        if (cancelled || requestSerial !== requestRef.current) return;
        const resultAddress = address || cell?.address || "A1";
        const values = result.values || {};
        setPreview(Object.prototype.hasOwnProperty.call(values, resultAddress)
          ? formatFormulaResult(values[resultAddress])
          : "");
      } catch {
        if (!cancelled && requestSerial === requestRef.current) setPreview("");
      }
    };
    run();
    return () => { cancelled = true; };
  }, [address, cell, formulaSheet, value]);

  return preview;
}

function FormulaEditor({ value, address, cellId, cell, formulaSheet, inputRef, onChange, onFormulaModeChange, onCommit, onEditEnd }) {
  const localInputRef = useRef(null);
  const editorRef = inputRef || localInputRef;
  const editorCellIdRef = useRef(cellId);
  editorCellIdRef.current = cellId;
  const pendingCommitRef = useRef(0);
  const scheduleCommit = useCallback((next, options = {}) => {
    const input = editorRef.current;
    const surface = input?.closest?.(".object-surface");
    const commitId = pendingCommitRef.current + 1;
    pendingCommitRef.current = commitId;
    const publishCommit = () => {
      onChange(next);
      window.requestAnimationFrame(() => {
        if (pendingCommitRef.current !== commitId) return;
        if (editorCellIdRef.current !== cellId || editorRef.current?.value === next) {
          setLocalCellDraft(surface, cellId, null);
        }
      });
    };
    if (options.immediate) {
      publishCommit();
      return;
    }
    // Let the editor event paint its local draft before the canonical
    // workspace update can recalculate the active sheet. The draft remains
    // published until this queued transaction finishes, so the cell never
    // flashes back to its old value while the commit is pending.
    window.setTimeout(publishCommit, 0);
  }, [cellId, editorRef, onChange]);
  const session = useLocalDraft(value, scheduleCommit, cellId);
  const [query, setQuery] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const formulaPreview = useFormulaWorkerPreview({
    value: session.draft,
    address,
    cell,
    formulaSheet,
  });
  const suggestions = useMemo(() => {
    if (!query?.prefix) return [];
    const starts = FORMULA_CATALOG.filter((item) => item.name.startsWith(query.prefix));
    const contains = FORMULA_CATALOG.filter((item) => !item.name.startsWith(query.prefix) && item.name.includes(query.prefix));
    return [...starts, ...contains].slice(0, 7);
  }, [query]);

  const publishDraft = useCallback((next, preview = "") => {
    const input = editorRef.current;
    const surface = input?.closest?.(".object-surface");
    if (!surface || !cellId) return;
    const formula = next.startsWith("=") ? next : "";
    setLocalCellDraft(surface, cellId, {
      value: formula ? "" : next,
      formula,
      displayValue: formula ? preview || next : next,
    });
  }, [cellId, editorRef]);

  const commitDraft = useCallback((options) => {
    const next = session.draftRef.current;
    const changed = session.commitDraft(next, options);
    if (!changed) {
      const input = editorRef.current;
      const surface = input?.closest?.(".object-surface");
      setLocalCellDraft(surface, cellId, null);
    }
    return changed;
  }, [cellId, editorRef, session]);

  useEffect(() => {
    const input = editorRef.current;
    if (!input) return undefined;
    const commitFromCellSelection = (event) => {
      commitDraft({ immediate: true });
      onFormulaModeChange?.(false);
      onEditEnd?.();
      if (event.detail?.moveAfter) onCommit?.();
    };
    input.addEventListener(CELL_EDIT_COMMIT_EVENT, commitFromCellSelection);
    return () => input.removeEventListener(CELL_EDIT_COMMIT_EVENT, commitFromCellSelection);
  }, [commitDraft, editorRef, onCommit, onEditEnd, onFormulaModeChange]);

  useEffect(() => {
    const input = editorRef.current;
    if (!input) return undefined;
    const updateFromCell = (event) => {
      const next = String(event.detail?.value ?? "");
      session.updateDraft(next);
      publishDraft(next);
      onFormulaModeChange?.(next.startsWith("="));
    };
    input.addEventListener(CELL_EDIT_UPDATE_EVENT, updateFromCell);
    return () => input.removeEventListener(CELL_EDIT_UPDATE_EVENT, updateFromCell);
  }, [editorRef, onFormulaModeChange, publishDraft, session]);

  useEffect(() => {
    if (session.activeRef.current) publishDraft(session.draftRef.current, formulaPreview);
  }, [formulaPreview, publishDraft, session]);

  useEffect(() => {
    const input = editorRef.current;
    if (!input) return undefined;
    const seed = (event) => {
      const next = String(event.detail?.value || "");
      if (!next) return;
      session.beginDraft(next);
      setQuery(null);
      setActiveIndex(0);
      publishDraft(next);
      onFormulaModeChange?.(next.startsWith("="));
      if (event.detail?.focus === false) return;
      window.requestAnimationFrame(() => {
        input.focus();
        const caret = input.value.length;
        input.setSelectionRange(caret, caret);
      });
    };
    input.addEventListener(CELL_EDIT_SEED_EVENT, seed);
    return () => input.removeEventListener(CELL_EDIT_SEED_EVENT, seed);
  }, [editorRef, onFormulaModeChange, publishDraft, session]);

  useEffect(() => {
    setQuery(null);
    setActiveIndex(0);
  }, [address]);

  // Auto-grow the value editor so multi-line cell content stays visible as the
  // user types (Shift+Enter). Capped so a very tall value still scrolls.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.style.height = "auto";
    editor.style.height = `${Math.min(140, editor.scrollHeight)}px`;
  }, [session.draft]);

  const inspectCaret = (target) => {
    const next = formulaQuery(target.value, target.selectionStart);
    setQuery(next);
    setActiveIndex(0);
  };

  const choose = (item) => {
    if (!query) return;
    const currentValue = session.draftRef.current;
    const nextValue = `${currentValue.slice(0, query.start)}${item.name}(${currentValue.slice(query.end)}`;
    const nextCaret = query.start + item.name.length + 1;
    session.updateDraft(nextValue);
    publishDraft(nextValue);
    setQuery(null);
    window.requestAnimationFrame(() => {
      editorRef.current?.focus();
      editorRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const listOpen = Boolean(query && suggestions.length);

  return (
    <div className="formula-editor-shell">
      <textarea
        ref={editorRef}
        className="formula-editor"
        rows={1}
        value={session.draft}
        data-formula-preview={formulaPreview || undefined}
        onChange={(event) => {
          const nextValue = event.target.value;
          session.updateDraft(nextValue);
          publishDraft(nextValue);
          onFormulaModeChange?.(nextValue.startsWith("="));
          inspectCaret(event.target);
        }}
        onFocus={(event) => {
          onFormulaModeChange?.(event.currentTarget.value.startsWith("="));
          inspectCaret(event.currentTarget);
        }}
        onClick={(event) => inspectCaret(event.currentTarget)}
        onKeyUp={(event) => {
          if (["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(event.key)) return;
          inspectCaret(event.currentTarget);
        }}
        onKeyDown={(event) => {
          if (listOpen && event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) => (current + 1) % suggestions.length);
            return;
          }
          if (listOpen && event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
            return;
          }
          if (listOpen && (event.key === "Enter" || event.key === "Tab")) {
            event.preventDefault();
            choose(suggestions[activeIndex]);
            return;
          }
          if (listOpen && event.key === "Escape") {
            event.preventDefault();
            setQuery(null);
            onFormulaModeChange?.(false);
            commitDraft();
            editorRef.current?.blur();
            return;
          }
          if (!listOpen && event.key === "Escape") {
            event.preventDefault();
            commitDraft();
            onFormulaModeChange?.(false);
            editorRef.current?.blur();
            return;
          }
          // Shift+Enter (or Alt+Enter) inserts a newline so a cell value can be
          // multi-line; a plain Enter commits and moves below.
          if (!listOpen && event.key === "Enter" && !event.shiftKey && !event.altKey) {
            event.preventDefault();
            commitDraft({ immediate: true });
            onFormulaModeChange?.(false);
            editorRef.current?.blur();
            onCommit?.();
            return;
          }
        }}
        onBlur={() => {
          commitDraft();
          onFormulaModeChange?.(false);
          window.setTimeout(() => setQuery(null), 100);
        }}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={listOpen}
        aria-controls="formula-suggestions"
        aria-activedescendant={listOpen ? `formula-suggestion-${activeIndex}` : undefined}
        aria-label={`Formula or value for ${address || "selected cell"}`}
        spellCheck="false"
      />
      <span className="visually-hidden" aria-live="polite">
        {formulaPreview ? `Formula preview: ${formulaPreview}` : ""}
      </span>
      {listOpen ? (
        <div className="formula-suggestions" id="formula-suggestions" role="listbox" aria-label="Formula suggestions">
          <div className="formula-suggestions-label">Functions</div>
          {suggestions.map((item, index) => (
            <button
              id={`formula-suggestion-${index}`}
              key={item.name}
              className={index === activeIndex ? "formula-suggestion is-active" : "formula-suggestion"}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onPointerDown={(event) => event.preventDefault()}
              onPointerMove={() => setActiveIndex(index)}
              onClick={() => choose(item)}
            >
              <span className="formula-suggestion-copy">
                <strong>{item.name}</strong>
                <small>{item.description}</small>
              </span>
              <code>{item.signature}</code>
            </button>
          ))}
          <div className="formula-suggestions-hint"><kbd>↑</kbd><kbd>↓</kbd> choose <kbd>Enter</kbd> insert</div>
        </div>
      ) : null}
    </div>
  );
}

export function FormulaBar({ address, rangeLabel, cell, formulaSheet, inputRef, onChange, onFormulaModeChange, onCommit, onEditEnd, onAddressChange, onFormat, onConditionalFormat, hasConditionalFormat, filterCount, onClearFilters }) {
  const formulaValue = cell?.formula || cell?.value || "";

  return (
    <div className="formula-bar" aria-label="Formula bar">
      <div className="formula-toolbar-row">
        <CellFormatMenu
          style={cell?.style || {}}
          onChange={onFormat}
          onConditionalChange={onConditionalFormat}
          hasConditionalFormat={hasConditionalFormat}
        />
        {filterCount ? (
          <button className="formula-filter-chip" type="button" onClick={onClearFilters} data-tooltip="Clear active filters">
            <IconFilterOff size={13} stroke={1.65} />
            <span>{filterCount} filter{filterCount === 1 ? "" : "s"}</span>
          </button>
        ) : null}
      </div>
      <div className="formula-input-row">
        <AddressPicker address={address || "A1"} rangeLabel={rangeLabel} onChange={onAddressChange} />
        <span className="formula-mark" aria-hidden="true">fx</span>
        <FormulaEditor
          value={formulaValue}
          address={address}
          cellId={cell?.id}
          cell={cell}
          formulaSheet={formulaSheet}
          inputRef={inputRef}
          onChange={(value) => onChange(value)}
          onFormulaModeChange={onFormulaModeChange}
          onCommit={onCommit}
          onEditEnd={onEditEnd}
        />
      </div>
    </div>
  );
}
