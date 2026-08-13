import { useEffect, useMemo, useRef, useState } from "react";
import { IconArrowRight, IconChevronDown, IconFilterOff } from "@tabler/icons-react";
import { coordinatesFromAddress } from "../sheet/coordinates.js";
import { FORMULA_CATALOG } from "../sheet/formulas.js";
import { CellFormatMenu } from "./CellFormatMenu.jsx";

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

function FormulaEditor({ value, address, inputRef, onChange, onFormulaModeChange }) {
  const localInputRef = useRef(null);
  const editorRef = inputRef || localInputRef;
  const [query, setQuery] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const suggestions = useMemo(() => {
    if (!query?.prefix) return [];
    const starts = FORMULA_CATALOG.filter((item) => item.name.startsWith(query.prefix));
    const contains = FORMULA_CATALOG.filter((item) => !item.name.startsWith(query.prefix) && item.name.includes(query.prefix));
    return [...starts, ...contains].slice(0, 7);
  }, [query]);

  useEffect(() => {
    setQuery(null);
    setActiveIndex(0);
  }, [address]);

  const inspectCaret = (target) => {
    const next = formulaQuery(target.value, target.selectionStart);
    setQuery(next);
    setActiveIndex(0);
  };

  const choose = (item) => {
    if (!query) return;
    const nextValue = `${value.slice(0, query.start)}${item.name}(${value.slice(query.end)}`;
    const nextCaret = query.start + item.name.length + 1;
    onChange(nextValue);
    setQuery(null);
    window.requestAnimationFrame(() => {
      editorRef.current?.focus();
      editorRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const listOpen = Boolean(query && suggestions.length);

  return (
    <div className="formula-editor-shell">
      <input
        ref={editorRef}
        className="formula-editor"
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value;
          onChange(nextValue);
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
            editorRef.current?.blur();
            return;
          }
          if (!listOpen && (event.key === "Enter" || event.key === "Escape")) {
            event.preventDefault();
            onFormulaModeChange?.(false);
            editorRef.current?.blur();
          }
        }}
        onBlur={() => {
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

export function FormulaBar({ address, rangeLabel, cell, inputRef, onChange, onFormulaModeChange, onAddressChange, onFormat, onConditionalFormat, hasConditionalFormat, filterCount, onClearFilters }) {
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
          inputRef={inputRef}
          onChange={(value) => onChange(value)}
          onFormulaModeChange={onFormulaModeChange}
        />
      </div>
    </div>
  );
}
