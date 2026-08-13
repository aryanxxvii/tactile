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
  onEdit,
  onCommit,
  onValueChange,
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
        inRange={inRange}
        inFormulaRange={inFormulaRange}
        fillPreview={fillPreview}
        conditionalTone={conditionalTone}
        inSelectedRow={inSelectedRow}
        inSelectedColumn={inSelectedColumn}
        editing={editing}
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
        onEdit={onEdit}
        onCommit={onCommit}
        onValueChange={onValueChange}
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
