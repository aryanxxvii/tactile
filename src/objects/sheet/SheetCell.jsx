import { memo, useRef } from "react";
import { ObjectGlyph } from "../../components/ObjectGlyph.jsx";
import {
  dispatchCellEditSeed,
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
  inRange,
  inFormulaRange,
  fillPreview,
  conditionalTone,
  inSelectedRow,
  inSelectedColumn,
  onEmbeddedClick,
  onEmbeddedDoubleClick,
  onSelect,
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
  const localDraft = useLocalCellDraft(cellRef, cellId);
  const localValue = localDraft?.formula ? localDraft.displayValue || localDraft.formula : localDraft?.value;
  const shownValue = localDraft ? localValue : displayValue ?? value;
  const hasEmbed = Boolean(embedObjectId);
  const numeric = shownValue !== "" && !Number.isNaN(Number(String(shownValue).replace(/,/g, "")));
  const shownFormula = localDraft?.formula || formula;
  const formulaError = Boolean(shownFormula && String(shownValue).startsWith("#"));
  const hasFontSize = Number.isFinite(styleFontSize);
  const selectionPaintActive = selected || inRange || inSelectedRow || inSelectedColumn;
  const cellStyle = hasFontSize || selectionPaintActive
    ? {
      ...(hasFontSize ? { "--cell-font-size": `${styleFontSize}px` } : {}),
      ...(selectionPaintActive ? { transition: "none" } : {}),
    }
    : undefined;

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

  return (
    <div
      ref={cellRef}
      className={`sheet-cell ${selected ? "is-selected" : ""} ${dropTarget ? "is-object-drop-target" : ""} ${inRange && !selected ? "is-in-range" : ""} ${inFormulaRange ? "is-formula-reference" : ""} ${fillPreview ? "is-fill-preview" : ""} ${inSelectedRow ? "is-selected-row" : ""} ${inSelectedColumn ? "is-selected-column" : ""} ${hasEmbed ? "is-embedded" : ""} ${role === "heading" ? "is-table-heading" : ""} ${role === "label" ? "is-row-label" : ""} ${numeric ? "is-numeric" : ""} ${styleBold ? "is-bold" : ""} ${styleHighlight ? `highlight-${styleHighlight}` : ""} ${styleTextColor ? `text-${styleTextColor}` : ""} ${styleAlign ? `align-${styleAlign}` : ""} ${styleVerticalAlign ? `align-${styleVerticalAlign}` : ""} ${conditionalTone ? `conditional-${conditionalTone}` : ""} ${formulaError ? "has-formula-error" : ""}`}
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
        clearNativeSelectionWhenLeavingCell(event);
        const cell = eventCell();
        if (formulaEditingCellId) {
          event.preventDefault();
          if (formulaEditingCellId !== cellId) onFormulaReferenceStart?.(event, cell);
          return;
        }
        onSelectionStart?.(event, cell);
      }}
      onPointerEnter={() => {
        const cell = eventCell();
        if (formulaEditingCellId && formulaEditingCellId !== cellId) onFormulaReferenceMove?.(cell);
        else if (!formulaEditingCellId) onSelectionMove?.(cell);
      }}
      onClick={hasEmbed ? (event) => {
        if (formulaEditingCellId) {
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
        onFocusFormulaBar?.();
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        if (!formulaEditingCellId && !inRange) onSelect(address);
        onContextMenu?.(event, eventCell());
      }}
      onFocus={() => {
        if (!formulaEditingCellId && !inRange) onSelect(address);
      }}
      onKeyDown={(event) => {
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
        <span className="cell-value">{shownValue || " "}</span>
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
