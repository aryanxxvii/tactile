import { memo } from "react";
import { SheetCell } from "../SheetCell.jsx";
import { useEmbeddedCellOpen } from "./embeddedCellOpen.js";

const CellSlot = memo(function CellSlot({
  objectId,
  row,
  column,
  cellId: id,
  address,
  left,
  top,
  width,
  height,
  value,
  formula,
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
  formulaEditingCellId,
  onEmbeddedClick,
  onEmbeddedDoubleClick,
  dropTarget,
  onObjectDragOver,
  onObjectDragLeave,
  onObjectDrop,
  onSelect,
  onSelectionStart,
  onSelectionMove,
  onFormulaReferenceStart,
  onFormulaReferenceMove,
  onFillStart,
  onFocusFormulaBar,
  onContextMenu,
}) {
  return (
    <div
      className={`virtual-cell-slot ${selected ? "is-active-cell-slot" : ""}`}
      data-row={row}
      data-column={column}
      style={{ left, top, width, height }}
    >
      <SheetCell
        objectId={objectId}
        cellId={id}
        address={address}
        row={row}
        column={column}
        value={value}
        formula={formula}
        displayValue={displayValue}
        embedObjectId={embedObjectId}
        embedObject={embedObject}
        embedType={embedType}
        embedLinkId={embedLinkId}
        role={role}
        styleBold={styleBold}
        styleHighlight={styleHighlight}
        styleTextColor={styleTextColor}
        styleAlign={styleAlign}
        styleVerticalAlign={styleVerticalAlign}
        styleFontSize={styleFontSize}
        selected={selected}
        multiSelected={multiSelected}
        inRange={inRange}
        inFormulaRange={inFormulaRange}
        fillPreview={fillPreview}
        conditionalTone={conditionalTone}
        inSelectedRow={inSelectedRow}
        inSelectedColumn={inSelectedColumn}
        formulaEditingCellId={formulaEditingCellId}
        onEmbeddedClick={onEmbeddedClick}
        onEmbeddedDoubleClick={onEmbeddedDoubleClick}
        dropTarget={dropTarget}
        onObjectDragOver={onObjectDragOver}
        onObjectDragLeave={onObjectDragLeave}
        onObjectDrop={onObjectDrop}
        onSelect={onSelect}
        onSelectionStart={onSelectionStart}
        onSelectionMove={onSelectionMove}
        onFormulaReferenceStart={onFormulaReferenceStart}
        onFormulaReferenceMove={onFormulaReferenceMove}
        onFillStart={onFillStart}
        onFocusFormulaBar={onFocusFormulaBar}
        onContextMenu={onContextMenu}
      />
    </div>
  );
});

export const SheetCellSlot = memo(function SheetCellSlot(props) {
  return <CellSlot {...props} />;
});

export const EmbeddedCellSlot = memo(function EmbeddedCellSlot(props) {
  const embedded = useEmbeddedCellOpen({
    objectId: props.objectId,
    cellId: props.cellId,
    address: props.address,
    embedObjectId: props.embedObjectId,
    embedType: props.embedType,
    embedLinkId: props.embedLinkId,
    sourceLabel: props.displayValue,
    onOpenObject: props.onOpenObject,
  });
  return (
    <CellSlot
      {...props}
      onEmbeddedClick={embedded.onClick}
      onEmbeddedDoubleClick={embedded.onDoubleClick}
    />
  );
});
