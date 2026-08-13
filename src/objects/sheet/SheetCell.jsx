import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ObjectGlyph } from "../../components/ObjectGlyph.jsx";
import { FORMULA_CATALOG } from "../../sheet/formulas.js";
import {
  isObjectDragEvent,
  writeObjectDragData,
} from "../../shell/objectDrag.js";

function formulaQuery(value, caret) {
  if (!value.startsWith("=") || caret == null) return null;
  const beforeCaret = value.slice(0, caret);
  const match = /(?:^|[=(,+\-*/^])([A-Za-z][A-Za-z0-9.]*)$/.exec(beforeCaret);
  if (!match) return null;
  const prefix = match[1].toUpperCase();
  return { prefix, start: caret - match[1].length, end: caret };
}

function cellEventData({ cellId, address, row, column, value, formula, embedObjectId, embedType, embedLinkId }) {
  return {
    id: cellId,
    address,
    row,
    column,
    value,
    formula,
    embed: embedObjectId
      ? { objectId: embedObjectId, type: embedType, ...(embedLinkId ? { linkId: embedLinkId } : {}) }
      : null,
  };
}

export const SheetCell = memo(function SheetCell({
  objectId,
  cellId,
  address,
  row,
  column,
  value = "",
  formula = "",
  displayValue,
  embedObjectId,
  embedType,
  embedLinkId,
  role,
  styleBold,
  styleHighlight,
  styleTextColor,
  styleAlign,
  styleVerticalAlign,
  styleFontSize,
  selected,
  inRange,
  inFormulaRange,
  fillPreview,
  conditionalTone,
  inSelectedRow,
  inSelectedColumn,
  editing,
  onEmbeddedClick,
  onEmbeddedDoubleClick,
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
  onContextMenu,
  dropTarget,
  onObjectDragOver,
  onObjectDragLeave,
  onObjectDrop,
}) {
  const inputRef = useRef(null);
  const [formulaHintQuery, setFormulaHintQuery] = useState(null);
  const [formulaHintIndex, setFormulaHintIndex] = useState(0);
  const shownValue = displayValue ?? value;
  const hasEmbed = Boolean(embedObjectId);
  const numeric = shownValue !== "" && !Number.isNaN(Number(String(shownValue).replace(/,/g, "")));
  const formulaError = Boolean(formula && String(shownValue).startsWith("#"));
  const formulaHints = useMemo(() => {
    if (!formulaHintQuery?.prefix) return [];
    const starts = FORMULA_CATALOG.filter((item) => item.name.startsWith(formulaHintQuery.prefix));
    const contains = FORMULA_CATALOG.filter((item) => !item.name.startsWith(formulaHintQuery.prefix) && item.name.includes(formulaHintQuery.prefix));
    return [...starts, ...contains].slice(0, 7);
  }, [formulaHintQuery]);
  const formulaHintOpen = editing && Boolean(formulaHints.length);
  const cellStyle = Number.isFinite(styleFontSize)
    ? { "--cell-font-size": `${styleFontSize}px` }
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

  const eventCell = () => cellEventData({
    cellId,
    address,
    row,
    column,
    value,
    formula,
    embedObjectId,
    embedType,
    embedLinkId,
  });

  const inspectFormulaCaret = (input) => {
    const next = formulaQuery(input.value, input.selectionStart);
    setFormulaHintQuery(next);
    setFormulaHintIndex(0);
  };

  const chooseFormulaHint = (item) => {
    if (!formulaHintQuery) return;
    const currentInputValue = formula || value || "";
    const nextValue = `${currentInputValue.slice(0, formulaHintQuery.start)}${item.name}(${currentInputValue.slice(formulaHintQuery.end)}`;
    const nextCaret = formulaHintQuery.start + item.name.length + 1;
    onValueChange(cellId, nextValue);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextCaret, nextCaret);
      if (inputRef.current) inspectFormulaCaret(inputRef.current);
    });
  };

  return (
    <div
      className={`sheet-cell ${selected ? "is-selected" : ""} ${dropTarget ? "is-object-drop-target" : ""} ${inRange && !selected ? "is-in-range" : ""} ${inFormulaRange ? "is-formula-reference" : ""} ${fillPreview ? "is-fill-preview" : ""} ${inSelectedRow ? "is-selected-row" : ""} ${inSelectedColumn ? "is-selected-column" : ""} ${editing ? "is-editing" : ""} ${hasEmbed ? "is-embedded" : ""} ${role === "heading" ? "is-table-heading" : ""} ${role === "label" ? "is-row-label" : ""} ${numeric ? "is-numeric" : ""} ${styleBold ? "is-bold" : ""} ${styleHighlight ? `highlight-${styleHighlight}` : ""} ${styleTextColor ? `text-${styleTextColor}` : ""} ${styleAlign ? `align-${styleAlign}` : ""} ${styleVerticalAlign ? `align-${styleVerticalAlign}` : ""} ${conditionalTone ? `conditional-${conditionalTone}` : ""} ${formulaError ? "has-formula-error" : ""}`}
      role="gridcell"
      aria-selected={selected}
      aria-label={`${address}${shownValue ? `, ${shownValue}` : ""}${hasEmbed ? ", embedded object" : ""}`}
      tabIndex={selected ? 0 : -1}
      data-object-id={objectId}
      data-cell-address={address}
      draggable={hasEmbed}
      style={cellStyle}
      onDragStart={(event) => {
        if (!hasEmbed) return;
        writeObjectDragData(event, {
          objectId: embedObjectId,
          linkId: embedLinkId,
          sourceObjectId: objectId,
          sourceCellId: cellId,
          sourceAddress: address,
        });
      }}
      onDragOver={(event) => {
        if (!isObjectDragEvent(event)) return;
        onObjectDragOver?.(event, address);
      }}
      onDragLeave={onObjectDragLeave}
      onDrop={(event) => onObjectDrop?.(event, address)}
      onPointerDown={(event) => {
        const cell = eventCell();
        if (formulaEditingCellId && formulaEditingCellId !== cellId) {
          onFormulaReferenceStart?.(event, cell);
          return;
        }
        onSelectionStart?.(event, cell);
      }}
      onPointerEnter={() => {
        const cell = eventCell();
        if (formulaEditingCellId && formulaEditingCellId !== cellId) onFormulaReferenceMove?.(cell);
        else onSelectionMove?.(cell);
      }}
      onClick={hasEmbed ? onEmbeddedClick : undefined}
      onDoubleClick={(event) => {
        if (hasEmbed) {
          onEmbeddedDoubleClick?.(event);
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        onEdit(cellId);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        if (!inRange) onSelect(address);
        onContextMenu?.(event, eventCell());
      }}
      onFocus={() => {
        if (!inRange) onSelect(address);
      }}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === "F2") && !hasEmbed && !editing) {
          event.preventDefault();
          onEdit(cellId);
          return;
        }
        const isPrintable = event.key.length === 1
          && !event.ctrlKey
          && !event.metaKey
          && !event.altKey
          && !event.isComposing;
        const isEmpty = !hasEmbed && !value && !formula;
        if (isPrintable && isEmpty && !editing) {
          event.preventDefault();
          onEdit(cellId, event.key);
        }
      }}
    >
      {editing ? (
        <input
          ref={inputRef}
          className="cell-editor"
          value={formula || value}
          onChange={(event) => {
            onValueChange(cellId, event.target.value);
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
          aria-label={`Edit ${address}`}
        />
      ) : (
        <span className="cell-content">
          {hasEmbed ? (
            <ObjectGlyph
              item={{ type: embedType }}
              className="embed-icon"
              size={14}
              stroke={1.55}
            />
          ) : null}
          <span className="cell-value">{shownValue || " "}</span>
        </span>
      )}
      {inFormulaRange ? (
        <svg className="formula-reference-outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <rect x="1" y="1" width="98" height="98" rx="7" pathLength="100" />
        </svg>
      ) : null}
      {formulaHintOpen ? (
        <div className="formula-suggestions cell-formula-suggestions" role="listbox" aria-label={`Formula suggestions for ${address}`}>
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
      {selected && !editing && !hasEmbed ? (
        <button
          className="cell-fill-handle"
          type="button"
          tabIndex={-1}
          aria-label={`Fill from ${address}`}
          data-tooltip="Drag to fill"
          onPointerDown={(event) => onFillStart?.(event, eventCell())}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        />
      ) : null}
    </div>
  );
});
