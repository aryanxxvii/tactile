import { useState } from "react";
import { SheetGridCanvas } from "./grid/SheetGridCanvas.jsx";
import { SheetGridContextMenu } from "./grid/SheetGridContextMenu.jsx";
import { useSheetGridContextMenu } from "./grid/useSheetGridContextMenu.js";
import { useSheetGridGestures } from "./grid/useSheetGridGestures.js";
import { useSheetGridProjection } from "./grid/useSheetGridProjection.js";
import {
  isObjectDragEvent,
  readObjectDragData,
} from "../../shell/objectDrag.js";

export function SheetGrid({
  object,
  workspaceObjects,
  selectedAddress,
  selectionRange,
  formulaEditingCellId,
  onSelect,
  onSelectRange,
  onFocusFormulaBar,
  onCellChange,
  onCellsChange,
  onUpdateObject,
  onOpenObject,
  onReparentObject,
  onCreateEmbedded,
  onInsertAxis,
  onDeleteAxis,
  onMoveAxis,
  sheetMetrics,
  onCreateFile,
}) {
  const [fillTarget, setFillTarget] = useState(null);
  const [dropTargetAddress, setDropTargetAddress] = useState("");
  const [resizePreview, setResizePreview] = useState(null);
  const handleObjectDragOver = (event, address) => {
    if (!isObjectDragEvent(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setDropTargetAddress(address);
  };
  const handleObjectDragLeave = (event) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setDropTargetAddress("");
  };
  const handleObjectDrop = (event, address) => {
    event.preventDefault();
    event.stopPropagation();
    const payload = readObjectDragData(event);
    setDropTargetAddress("");
    if (payload) onReparentObject?.(payload, { parentObjectId: object.id, address });
  };
  const projection = useSheetGridProjection({
    object,
    selectedAddress,
    selectionRange,
    formulaEditingCellId,
    fillTarget,
    sheetMetrics,
    resizePreview,
  });
  const gestures = useSheetGridGestures({
    object,
    selectedAddress: projection.selectedAddress,
    selectionRange: projection.normalizedSelection,
    formulaEditingCellId,
    selectedCoordinates: projection.selectedCoordinates,
    normalizedSelection: projection.normalizedSelection,
    scrollRef: projection.scrollRef,
    metrics: projection.metrics,
    rowIndexMap: projection.rowIndexMap,
    columnIndexMap: projection.columnIndexMap,
    columnPositionForIndex: projection.columnPositionForIndex,
    columnOffsetForPosition: projection.columnOffsetForPosition,
    columnSizeForPosition: projection.columnSizeForPosition,
    columnSizeForIndex: projection.columnSizeForIndex,
    rowPositionForIndex: projection.rowPositionForIndex,
    rowOffsetForPosition: projection.rowOffsetForPosition,
    rowSizeForPosition: projection.rowSizeForPosition,
    rowSizeForIndex: projection.rowSizeForIndex,
    onSelect,
    onSelectRange,
    onCellChange,
    onCellsChange,
    onUpdateObject,
    onMoveAxis,
    fillTarget,
    setFillTarget,
    onResizePreview: setResizePreview,
  });
  const contextMenu = useSheetGridContextMenu({
    object,
    normalizedSelection: projection.normalizedSelection,
    onCellsChange,
    onSelectRange,
    onCreateFile,
  });

  return (
    <div className="sheet-grid-shell">
      <input
        ref={contextMenu.fileInputRef}
        className="native-file-input"
        type="file"
        accept=".pdf,.md,.markdown,.html,.htm,.svg,image/*,video/*,application/pdf,text/html,text/markdown"
        tabIndex={-1}
        aria-hidden="true"
        onChange={contextMenu.handleFileChange}
      />
      <SheetGridCanvas
        object={object}
        workspaceObjects={workspaceObjects}
        selectedAddress={projection.selectedAddress}
        normalizedSelection={projection.normalizedSelection}
        fillPreviewRange={projection.fillPreviewRange}
        formulaValues={projection.formulaValues}
        rowGroups={projection.rowGroups}
        columnGroups={projection.columnGroups}
        rowGroupByStart={projection.rowGroupByStart}
        columnGroupByStart={projection.columnGroupByStart}
        visibleRows={projection.visibleRows}
        visibleColumns={projection.visibleColumns}
        canvasSize={projection.canvasSize}
        metrics={projection.metrics}
        scrollRef={projection.scrollRef}
        onScroll={projection.onScroll}
        rowOffsetForPosition={projection.rowOffsetForPosition}
        rowSizeForPosition={projection.rowSizeForPosition}
        columnOffsetForPosition={projection.columnOffsetForPosition}
        columnSizeForPosition={projection.columnSizeForPosition}
        showActiveRowContext={projection.showActiveRowContext}
        showActiveColumnContext={projection.showActiveColumnContext}
        selectedCoordinates={projection.selectedCoordinates}
        formulaEditingCellId={formulaEditingCellId}
        formulaReferenceRange={gestures.formulaReferenceRange}
        onSelect={onSelect}
        onSelectRange={onSelectRange}
        onSelectionStart={gestures.startSelection}
        onSelectionMove={gestures.moveSelectionGesture}
        onFormulaReferenceStart={gestures.startFormulaReference}
        onFormulaReferenceMove={gestures.moveFormulaReference}
        onFillStart={gestures.startFill}
        onFocusFormulaBar={onFocusFormulaBar}
        onOpenObject={onOpenObject}
        dropTargetAddress={dropTargetAddress}
        onObjectDragOver={handleObjectDragOver}
        onObjectDragLeave={handleObjectDragLeave}
        onObjectDrop={handleObjectDrop}
        onContextMenu={contextMenu.openContextMenu}
        onStartAxisDrag={gestures.startAxisDrag}
        onStartCornerSelection={gestures.startCornerSelection}
        onStartResize={gestures.startResize}
        onResizeAxisWithKeyboard={gestures.resizeAxisWithKeyboard}
        onResetAxisSize={gestures.resetAxisSize}
        onRestoreSelectionScroll={gestures.restoreSelectionScroll}
        onToggleRowGroup={(groupId) => gestures.toggleRowGroup(groupId, projection.rowGroups)}
        onToggleColumnGroup={(groupId) => gestures.toggleColumnGroup(groupId, projection.columnGroups)}
      />
      <SheetGridContextMenu
        menu={contextMenu.menu}
        setMenu={contextMenu.setMenu}
        normalizedSelection={projection.normalizedSelection}
        object={object}
        workspaceObjects={workspaceObjects}
        formulaValues={projection.formulaValues}
        rowGroups={projection.rowGroups}
        columnGroups={projection.columnGroups}
        filters={projection.filters}
        onCreateEmbedded={onCreateEmbedded}
        onCellsChange={onCellsChange}
        onSelect={onSelect}
        onSelectRange={onSelectRange}
        onUpdateObject={onUpdateObject}
        onInsertAxis={onInsertAxis}
        onDeleteAxis={onDeleteAxis}
        onOpenObject={onOpenObject}
        onAttachFile={contextMenu.attachFile}
        onCopy={contextMenu.copyCell}
        onPaste={contextMenu.pasteCell}
        canCopy={contextMenu.canCopy}
        canPaste={contextMenu.canPaste}
      />
    </div>
  );
}
