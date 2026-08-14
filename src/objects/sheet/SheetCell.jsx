import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ObjectGlyph } from "../../components/ObjectGlyph.jsx";
import { FORMULA_CATALOG } from "../../sheet/formulas.js";
import {
  dispatchCellEditCommitAny,
  dispatchCellEditSeed,
  dispatchCellEditUpdate,
  useLocalCellDraft,
} from "../../components/localEditSession.js";
import {
  isObjectDragEvent,
  writeObjectDragData,
} from "../../shell/objectDrag.js";

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

function clearNativeSelectionWhenLeavingCell(event) {
  if (typeof window === "undefined") return;
  const selection = window.getSelection?.();
  if (!selection || selection.isCollapsed || !selection.anchorNode) return;

  const anchorElement = selection.anchorNode.nodeType === Node.ELEMENT_NODE
    ? selection.anchorNode
    : selection.anchorNode.parentElement;
  const selectedCell = anchorElement?.closest?.(".sheet-cell");
  if (selectedCell !== event.currentTarget) selection.removeAllRanges();
}

function inlineFormulaQuery(value, caret) {
  if (!value.startsWith("=") || caret == null) return null;
  const beforeCaret = value.slice(0, caret);
  const match = /(?:^|[=(,+\-*/^])([A-Za-z][A-Za-z0-9.]*)$/.exec(beforeCaret);
  if (match) {
    const prefix = match[1].toUpperCase();
    return { prefix, start: caret - match[1].length, end: caret };
  }
  if (/(?:^|[=(,+\-*/^])$/.test(beforeCaret)) {
    return { prefix: "", start: caret, end: caret };
  }
  return null;
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
  embedObject,
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
  multiSelected,
  inRange,
  inFormulaRange,
  fillPreview,
  conditionalTone,
  inSelectedRow,
  inSelectedColumn,
  inlineEditingCellId,
  onEmbeddedClick,
  onEmbeddedDoubleClick,
  onSelect,
  onDeleteSelectedText,
  onSelectionStart,
  onSelectionMove,
  formulaEditingCellId,
  onFormulaReferenceStart,
  onFormulaReferenceMove,
  onFillStart,
  onFocusFormulaBar,
  onContextMenu,
  dropTarget,
  onObjectDragOver,
  onObjectDragLeave,
  onObjectDrop,
}) {
  const cellRef = useRef(null);
  const inlineEditorRef = useRef(null);
  const [inlineQuery, setInlineQuery] = useState(null);
  const [inlineActiveIndex, setInlineActiveIndex] = useState(0);
  const localDraft = useLocalCellDraft(cellRef, cellId);
  const localValue = localDraft?.formula ? localDraft.displayValue || localDraft.formula : localDraft?.value;
  const shownValue = localDraft ? localValue : displayValue ?? value;
  const hasEmbed = Boolean(embedObjectId);
  const inlineEditing = inlineEditingCellId === cellId && !hasEmbed;
  const inlineValue = localDraft
    ? (localDraft.formula || localDraft.value || "")
    : (formula || value || "");
  const inlineSuggestions = useMemo(() => {
    if (!inlineQuery) return [];
    if (!inlineQuery.prefix) return FORMULA_CATALOG.slice(0, 7);
    const starts = FORMULA_CATALOG.filter((item) => item.name.startsWith(inlineQuery.prefix));
    const contains = FORMULA_CATALOG.filter((item) => !item.name.startsWith(inlineQuery.prefix) && item.name.includes(inlineQuery.prefix));
    return [...starts, ...contains].slice(0, 7);
  }, [inlineQuery]);
  const inlineListOpen = Boolean(inlineQuery && inlineSuggestions.length);
  const numeric = shownValue !== "" && !Number.isNaN(Number(String(shownValue).replace(/,/g, "")));
  const shownFormula = localDraft?.formula || formula;
  const formulaError = Boolean(shownFormula && String(shownValue).startsWith("#"));
  const hasFontSize = Number.isFinite(styleFontSize);
  const selectionPaintActive = selected || multiSelected || inRange || inSelectedRow || inSelectedColumn;
  const cellStyle = hasFontSize || selectionPaintActive
    ? {
      ...(hasFontSize ? { "--cell-font-size": `${styleFontSize}px` } : {}),
      ...(selectionPaintActive ? { transition: "none" } : {}),
    }
    : undefined;

  useEffect(() => {
    if (!inlineEditing) {
      setInlineQuery(null);
      setInlineActiveIndex(0);
      return;
    }
    const input = inlineEditorRef.current;
    if (!input) return;
    input.focus({ preventScroll: true });
    const caret = input.value.length;
    input.setSelectionRange(caret, caret);
    setInlineQuery(inlineFormulaQuery(input.value, caret));
    setInlineActiveIndex(0);
  }, [inlineEditing]);

  useEffect(() => {
    if (inlineEditing && inlineValue.startsWith("=")) {
      setInlineQuery(inlineFormulaQuery(inlineValue, inlineValue.length));
      setInlineActiveIndex(0);
    }
  }, [inlineEditing, inlineValue]);

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

  const inspectInlineCaret = (target) => {
    setInlineQuery(inlineFormulaQuery(target.value, target.selectionStart));
    setInlineActiveIndex(0);
  };

  const chooseInlineSuggestion = (item) => {
    if (!inlineQuery) return;
    const currentValue = inlineEditorRef.current?.value ?? inlineValue;
    const nextValue = `${currentValue.slice(0, inlineQuery.start)}${item.name}(${currentValue.slice(inlineQuery.end)}`;
    const nextCaret = inlineQuery.start + item.name.length + 1;
    dispatchCellEditUpdate(inlineEditorRef.current, nextValue);
    setInlineQuery(null);
    window.requestAnimationFrame(() => {
      inlineEditorRef.current?.focus({ preventScroll: true });
      inlineEditorRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  };

  return (
    <div
      ref={cellRef}
      className={`sheet-cell ${selected ? "is-selected" : ""} ${multiSelected ? "is-multi-selected" : ""} ${dropTarget ? "is-object-drop-target" : ""} ${inRange && !selected ? "is-in-range" : ""} ${inFormulaRange ? "is-formula-reference" : ""} ${fillPreview ? "is-fill-preview" : ""} ${inSelectedRow ? "is-selected-row" : ""} ${inSelectedColumn ? "is-selected-column" : ""} ${hasEmbed ? "is-embedded" : ""} ${role === "heading" ? "is-table-heading" : ""} ${role === "label" ? "is-row-label" : ""} ${numeric ? "is-numeric" : ""} ${styleBold ? "is-bold" : ""} ${styleHighlight ? `highlight-${styleHighlight}` : ""} ${styleTextColor ? `text-${styleTextColor}` : ""} ${styleAlign ? `align-${styleAlign}` : ""} ${styleVerticalAlign ? `align-${styleVerticalAlign}` : ""} ${conditionalTone ? `conditional-${conditionalTone}` : ""} ${formulaError ? "has-formula-error" : ""}`}
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
        if (inlineEditing && (event.target.closest?.(".cell-inline-editor") || event.target.closest?.(".cell-formula-suggestions"))) return;
        clearNativeSelectionWhenLeavingCell(event);
        const cell = eventCell();
        if (formulaEditingCellId) {
          event.preventDefault();
          if (formulaEditingCellId !== cellId) onFormulaReferenceStart?.(event, cell);
          return;
        }
        onSelectionStart?.(event, cell);
      }}
      onPointerEnter={(event) => {
        if (inlineEditing) return;
        const cell = eventCell();
        if (formulaEditingCellId && formulaEditingCellId !== cellId) onFormulaReferenceMove?.(cell);
        else if (!formulaEditingCellId) onSelectionMove?.(cell, event);
      }}
      onClick={hasEmbed ? (event) => {
        if (formulaEditingCellId) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onEmbeddedClick?.(event);
      } : undefined}
      onDoubleClick={(event) => {
        if (formulaEditingCellId) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (hasEmbed) {
          onEmbeddedDoubleClick?.(event);
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        onFocusFormulaBar?.(undefined, address);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        if (!formulaEditingCellId && !inRange) onSelect(address);
        onContextMenu?.(event, eventCell());
      }}
      onKeyDown={(event) => {
        if (inlineEditing) return;
        if ((event.key === "Delete" || event.key === "Backspace") && onDeleteSelectedText?.(event)) {
          event.stopPropagation();
          return;
        }
        if ((event.key === "Enter" || event.key === "F2") && !hasEmbed && !formulaEditingCellId) {
          event.preventDefault();
          onFocusFormulaBar?.();
          return;
        }
        const isPrintable = event.key.length === 1
          && !event.ctrlKey
          && !event.metaKey
          && !event.altKey
          && !event.isComposing;
        const isEmpty = !hasEmbed && !value && !formula;
        const isNavigationShortcut = event.key === "[" || event.key === "]";
        if (isPrintable && !isNavigationShortcut && isEmpty && !formulaEditingCellId) {
          event.preventDefault();
          onFocusFormulaBar?.();
          if (!dispatchCellEditSeed(event.currentTarget, event.key)) onFocusFormulaBar?.(event.key);
        }
      }}
    >
      <span className="cell-content">
        {hasEmbed ? (
          <ObjectGlyph
            item={embedObject || { type: embedType }}
            className="embed-icon"
            size={14}
            stroke={1.55}
          />
        ) : null}
        {inlineEditing ? (
          <>
            <input
              ref={inlineEditorRef}
              className="cell-inline-editor"
              value={inlineValue}
              onChange={(event) => {
                dispatchCellEditUpdate(event.currentTarget, event.currentTarget.value);
                inspectInlineCaret(event.currentTarget);
              }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => inspectInlineCaret(event.currentTarget)}
              onKeyUp={(event) => {
                if (!["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(event.key)) inspectInlineCaret(event.currentTarget);
              }}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (inlineListOpen && event.key === "ArrowDown") {
                  event.preventDefault();
                  setInlineActiveIndex((current) => (current + 1) % inlineSuggestions.length);
                  return;
                }
                if (inlineListOpen && event.key === "ArrowUp") {
                  event.preventDefault();
                  setInlineActiveIndex((current) => (current - 1 + inlineSuggestions.length) % inlineSuggestions.length);
                  return;
                }
                if (inlineListOpen && (event.key === "Enter" || event.key === "Tab")) {
                  event.preventDefault();
                  chooseInlineSuggestion(inlineSuggestions[inlineActiveIndex]);
                  return;
                }
                if (inlineListOpen && event.key === "Escape") {
                  event.preventDefault();
                  setInlineQuery(null);
                  return;
                }
                if (event.key === "Enter" || event.key === "Escape") {
                  event.preventDefault();
                  dispatchCellEditCommitAny(event.currentTarget, { moveAfter: event.key === "Enter" });
                }
              }}
              onBlur={(event) => dispatchCellEditCommitAny(event.currentTarget)}
              aria-label={`Edit ${address}`}
              aria-autocomplete="list"
              aria-expanded={inlineListOpen}
              aria-controls={`${cellId}-formula-suggestions`}
              spellCheck="false"
            />
            {inlineListOpen ? (
            <div
              className="formula-suggestions cell-formula-suggestions"
              id={`${cellId}-formula-suggestions`}
              role="listbox"
              aria-label="Formula suggestions"
            >
              <div className="formula-suggestions-label">Functions</div>
              {inlineSuggestions.map((item, index) => (
                <button
                  id={`${cellId}-formula-suggestion-${index}`}
                  key={item.name}
                  className={index === inlineActiveIndex ? "formula-suggestion is-active" : "formula-suggestion"}
                  type="button"
                  role="option"
                  aria-selected={index === inlineActiveIndex}
                  onPointerDown={(event) => event.preventDefault()}
                  onPointerMove={() => setInlineActiveIndex(index)}
                  onClick={() => chooseInlineSuggestion(item)}
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
          </>
        ) : <span className="cell-value">{shownValue || " "}</span>}
      </span>
      {inFormulaRange ? (
        <svg className="formula-reference-outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <rect x="1" y="1" width="98" height="98" rx="7" pathLength="100" />
        </svg>
      ) : null}
      {selected && !formulaEditingCellId && !hasEmbed ? (
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
