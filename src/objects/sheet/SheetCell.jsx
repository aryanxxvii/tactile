import { useEffect, useLayoutEffect, useRef } from "react";
import { objectTypeFor } from "../objectTypes.js";

export function SheetCell({
  objectId,
  cell,
  displayValue,
  selected,
  inRange,
  fillPreview,
  conditionalTone,
  inSelectedRow,
  inSelectedColumn,
  editing,
  onSelect,
  onSelectionStart,
  onSelectionMove,
  onFillStart,
  onEdit,
  onCommit,
  onValueChange,
  onOpenObject,
  onContextMenu,
}) {
  const inputRef = useRef(null);
  const openTimerRef = useRef(null);
  const EmbedIcon = cell.embed ? objectTypeFor(cell.embed.type).icon : null;
  const shownValue = displayValue ?? cell.value ?? "";
  const numeric = shownValue !== "" && !Number.isNaN(Number(String(shownValue).replace(/,/g, "")));
  const formulaError = cell.formula && String(shownValue).startsWith("#");
  const alignment = cell.style?.align;

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
      sourceAddress: cell.address,
      sourceLabel: cell.value,
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
        sourceAddress: cell.address,
        sourceLabel: cell.value,
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

  return (
    <div
      className={`sheet-cell ${selected ? "is-selected" : ""} ${inRange && !selected ? "is-in-range" : ""} ${fillPreview ? "is-fill-preview" : ""} ${inSelectedRow ? "is-selected-row" : ""} ${inSelectedColumn ? "is-selected-column" : ""} ${editing ? "is-editing" : ""} ${cell.embed ? "is-embedded" : ""} ${cell.role === "heading" ? "is-table-heading" : ""} ${cell.role === "label" ? "is-row-label" : ""} ${numeric ? "is-numeric" : ""} ${cell.style?.bold ? "is-bold" : ""} ${cell.style?.highlight ? `highlight-${cell.style.highlight}` : ""} ${cell.style?.textColor ? `text-${cell.style.textColor}` : ""} ${alignment ? `align-${alignment}` : ""} ${conditionalTone ? `conditional-${conditionalTone}` : ""} ${formulaError ? "has-formula-error" : ""}`}
      role="gridcell"
      aria-selected={selected}
      aria-label={`${cell.address}${shownValue ? `, ${shownValue}` : ""}${cell.embed ? ", embedded object" : ""}`}
      tabIndex={selected ? 0 : -1}
      data-object-id={objectId}
      data-cell-address={cell.address}
      onPointerDown={(event) => onSelectionStart?.(event, cell)}
      onPointerEnter={() => onSelectionMove?.(cell)}
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
        }
      }}
    >
      {editing ? (
        <input
          ref={inputRef}
          className="cell-editor"
          value={cell.formula || cell.value}
          onChange={(event) => onValueChange(cell.id, event.target.value)}
          onFocus={(event) => {
            const input = event.currentTarget;
            const caret = input.value.length;
            input.setSelectionRange(caret, caret);
          }}
          onBlur={onCommit}
          onKeyDown={(event) => {
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
          {EmbedIcon ? <EmbedIcon className="embed-icon" size={14} stroke={1.55} aria-hidden="true" /> : null}
          <span className="cell-value">{shownValue || " "}</span>
        </span>
      )}
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
