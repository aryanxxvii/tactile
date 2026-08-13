import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ObjectGlyph } from "../../components/ObjectGlyph.jsx";
import { FORMULA_CATALOG } from "../../sheet/formulas.js";

function formulaQuery(value, caret) {
  if (!value.startsWith("=") || caret == null) return null;
  const beforeCaret = value.slice(0, caret);
  const match = /(?:^|[=(,+\-*/^])([A-Za-z][A-Za-z0-9.]*)$/.exec(beforeCaret);
  if (!match) return null;
  const prefix = match[1].toUpperCase();
  return { prefix, start: caret - match[1].length, end: caret };
}

export function SheetCell({
  objectId,
  cell,
  embeddedObject,
  displayValue,
  selected,
  inRange,
  inFormulaRange,
  fillPreview,
  conditionalTone,
  inSelectedRow,
  inSelectedColumn,
  editing,
  onSelect,
  onSelectionStart,
  onSelectionMove,
  formulaEditingCellId,
  onFormulaReferenceStart,
  onFormulaReferenceMove,
  onFillStart,
  onEdit,
  onCommit,
  onValueChange,
  onOpenObject,
  onContextMenu,
}) {
  const inputRef = useRef(null);
  const openTimerRef = useRef(null);
  const [formulaHintQuery, setFormulaHintQuery] = useState(null);
  const [formulaHintIndex, setFormulaHintIndex] = useState(0);
  const shownValue = displayValue ?? cell.value ?? "";
  const numeric = shownValue !== "" && !Number.isNaN(Number(String(shownValue).replace(/,/g, "")));
  const formulaError = cell.formula && String(shownValue).startsWith("#");
  const alignment = cell.style?.align;
  const verticalAlignment = cell.style?.verticalAlign;
  const formulaHints = useMemo(() => {
    if (!formulaHintQuery?.prefix) return [];
    const starts = FORMULA_CATALOG.filter((item) => item.name.startsWith(formulaHintQuery.prefix));
    const contains = FORMULA_CATALOG.filter((item) => !item.name.startsWith(formulaHintQuery.prefix) && item.name.includes(formulaHintQuery.prefix));
    return [...starts, ...contains].slice(0, 7);
  }, [formulaHintQuery]);
  const formulaHintOpen = editing && Boolean(formulaHints.length);
  const fontSize = Number(cell.style?.fontSize);
  const cellStyle = Number.isFinite(fontSize)
    ? { "--cell-font-size": `${fontSize}px` }
    : undefined;

  useLayoutEffect(() => {
    if (!editing) return;
    const input = inputRef.current;
    input?.focus();
    if (input) {
      const caret = input.value.length;
      input.setSelectionRange(caret, caret);
    }
  }, [editing]);

  useEffect(() => () => {
    if (openTimerRef.current) window.clearTimeout(openTimerRef.current);
  }, []);

  const openEmbeddedObject = (event, mode) => {
    if (!cell.embed) return;
    const sourceElement = event.currentTarget;
    onOpenObject({
      objectId: cell.embed.objectId,
      linkId: cell.embed.linkId,
      sourceObjectId: objectId,
      sourceCellId: cell.id,
      sourceAddress: cell.address,
      sourceLabel: shownValue,
      sourceType: cell.embed.type,
      sourceElement,
      mode,
    });
  };

  const handleClick = (event) => {
    if (!cell.embed) return;
    const sourceElement = event.currentTarget;
    if (openTimerRef.current) window.clearTimeout(openTimerRef.current);
    openTimerRef.current = window.setTimeout(() => {
      openTimerRef.current = null;
      onOpenObject({
        objectId: cell.embed.objectId,
        linkId: cell.embed.linkId,
        sourceObjectId: objectId,
        sourceCellId: cell.id,
        sourceAddress: cell.address,
        sourceLabel: shownValue,
        sourceType: cell.embed.type,
        sourceElement,
        mode: "floating",
      });
    }, 170);
  };

  const handleDoubleClick = (event) => {
    if (!cell.embed) {
      event.preventDefault();
      event.stopPropagation();
      onEdit(cell.id);
      return;
    }
    if (openTimerRef.current) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    openEmbeddedObject(event, "full");
  };

  const inspectFormulaCaret = (input) => {
    const next = formulaQuery(input.value, input.selectionStart);
    setFormulaHintQuery(next);
    setFormulaHintIndex(0);
  };

  const chooseFormulaHint = (item) => {
    if (!formulaHintQuery) return;
    const value = cell.formula || cell.value || "";
    const nextValue = `${value.slice(0, formulaHintQuery.start)}${item.name}(${value.slice(formulaHintQuery.end)}`;
    const nextCaret = formulaHintQuery.start + item.name.length + 1;
    onValueChange(cell.id, nextValue);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextCaret, nextCaret);
      inspectFormulaCaret(inputRef.current);
    });
  };

  return (
    <div
      className={`sheet-cell ${selected ? "is-selected" : ""} ${inRange && !selected ? "is-in-range" : ""} ${inFormulaRange ? "is-formula-reference" : ""} ${fillPreview ? "is-fill-preview" : ""} ${inSelectedRow ? "is-selected-row" : ""} ${inSelectedColumn ? "is-selected-column" : ""} ${editing ? "is-editing" : ""} ${cell.embed ? "is-embedded" : ""} ${cell.role === "heading" ? "is-table-heading" : ""} ${cell.role === "label" ? "is-row-label" : ""} ${numeric ? "is-numeric" : ""} ${cell.style?.bold ? "is-bold" : ""} ${cell.style?.highlight ? `highlight-${cell.style.highlight}` : ""} ${cell.style?.textColor ? `text-${cell.style.textColor}` : ""} ${alignment ? `align-${alignment}` : ""} ${verticalAlignment ? `align-${verticalAlignment}` : ""} ${conditionalTone ? `conditional-${conditionalTone}` : ""} ${formulaError ? "has-formula-error" : ""}`}
      role="gridcell"
      aria-selected={selected}
      aria-label={`${cell.address}${shownValue ? `, ${shownValue}` : ""}${cell.embed ? ", embedded object" : ""}`}
      tabIndex={selected ? 0 : -1}
      data-object-id={objectId}
      data-cell-address={cell.address}
      style={cellStyle}
      onPointerDown={(event) => {
        if (formulaEditingCellId && formulaEditingCellId !== cell.id) {
          onFormulaReferenceStart?.(event, cell);
          return;
        }
        onSelectionStart?.(event, cell);
      }}
      onPointerEnter={() => {
        if (formulaEditingCellId && formulaEditingCellId !== cell.id) onFormulaReferenceMove?.(cell);
        else onSelectionMove?.(cell);
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={(event) => {
        event.preventDefault();
        if (!inRange) onSelect(cell.address);
        onContextMenu?.(event, cell);
      }}
      onFocus={() => {
        if (!inRange) onSelect(cell.address);
      }}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === "F2") && !cell.embed && !editing) {
          event.preventDefault();
          onEdit(cell.id);
          return;
        }
        const isPrintable = event.key.length === 1
          && !event.ctrlKey
          && !event.metaKey
          && !event.altKey
          && !event.isComposing;
        const isEmpty = !cell.embed && !cell.value && !cell.formula;
        if (isPrintable && isEmpty && !editing) {
          event.preventDefault();
          onEdit(cell.id, event.key);
        }
      }}
    >
      {editing ? (
        <input
          ref={inputRef}
          className="cell-editor"
          value={cell.formula || cell.value}
          onChange={(event) => {
            onValueChange(cell.id, event.target.value);
            inspectFormulaCaret(event.currentTarget);
          }}
          onFocus={(event) => {
            const input = event.currentTarget;
            const caret = input.value.length;
            input.setSelectionRange(caret, caret);
          }}
          onBlur={onCommit}
          onClick={(event) => inspectFormulaCaret(event.currentTarget)}
          onKeyUp={(event) => {
            if (!["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(event.key)) inspectFormulaCaret(event.currentTarget);
          }}
          onKeyDown={(event) => {
            if (formulaHintOpen) {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setFormulaHintIndex((current) => (current + 1) % formulaHints.length);
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setFormulaHintIndex((current) => (current - 1 + formulaHints.length) % formulaHints.length);
                return;
              }
              if (event.key === "Tab" || event.key === "Enter") {
                event.preventDefault();
                chooseFormulaHint(formulaHints[formulaHintIndex]);
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setFormulaHintQuery(null);
                return;
              }
            }
            if (event.key === "Enter") {
              event.preventDefault();
              onCommit();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              onCommit();
            }
          }}
          aria-label={`Edit ${cell.address}`}
        />
      ) : (
        <span className="cell-content">
          {cell.embed ? (
            <ObjectGlyph
              item={embeddedObject || { type: cell.embed.type }}
              className="embed-icon"
              size={14}
              stroke={1.55}
            />
          ) : null}
          <span className="cell-value">{shownValue || " "}</span>
        </span>
      )}
      {formulaHintOpen ? (
        <div className="formula-suggestions cell-formula-suggestions" role="listbox" aria-label={`Formula suggestions for ${cell.address}`}>
          <div className="formula-suggestions-label">Functions</div>
          {formulaHints.map((item, index) => (
            <button
              key={item.name}
              className={`formula-suggestion ${index === formulaHintIndex ? "is-active" : ""}`}
              type="button"
              role="option"
              aria-selected={index === formulaHintIndex}
              onPointerDown={(event) => event.preventDefault()}
              onPointerMove={() => setFormulaHintIndex(index)}
              onClick={() => chooseFormulaHint(item)}
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
      {selected && !editing && !cell.embed ? (
        <button
          className="cell-fill-handle"
          type="button"
          tabIndex={-1}
          aria-label={`Fill from ${cell.address}`}
          data-tooltip="Drag to fill"
          onPointerDown={(event) => onFillStart?.(event, cell)}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        />
      ) : null}
    </div>
  );
}
