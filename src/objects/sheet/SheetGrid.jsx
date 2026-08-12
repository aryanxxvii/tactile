import { useState } from "react";
import { SheetGridCanvas } from "./grid/SheetGridCanvas.jsx";
import { SheetGridContextMenu } from "./grid/SheetGridContextMenu.jsx";
import { useSheetGridContextMenu } from "./grid/useSheetGridContextMenu.js";
import { useSheetGridGestures } from "./grid/useSheetGridGestures.js";
import { useSheetGridProjection } from "./grid/useSheetGridProjection.js";

export function SheetGrid({
  object,
  workspaceObjects,
  selectedAddress,
  selectionRange,
  onSelect,
  onSelectRange,
  onCellChange,
  onCellsChange,
  onUpdateObject,
  onOpenObject,
  onCreateEmbedded,
  onInsertAxis,
  onDeleteAxis,
  onMoveAxis,
  sheetMetrics,
  onCreateFile,
}) {
  const [fillTarget, setFillTarget] = useState(null);
  const projection = useSheetGridProjection({
    object,
    selectedAddress,
    selectionRange,
    fillTarget,
    sheetMetrics,
  });
  const gestures = useSheetGridGestures({
    object,
    selectedAddress,
    selectionRange,
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
        selectedAddress={selectedAddress}
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
        showActiveAxisContext={projection.showActiveAxisContext}
        selectedCoordinates={projection.selectedCoordinates}
        editingCellId={gestures.editingCellId}
        onSelect={onSelect}
        onSelectRange={onSelectRange}
        onSelectionStart={gestures.startSelection}
        onSelectionMove={gestures.moveSelectionGesture}
        onFillStart={gestures.startFill}
        onEdit={gestures.startCellEditing}
        onCommit={() => gestures.setEditingCellId(null)}
        onValueChange={(cellId, value) => onCellChange(
          cellId,
          value.startsWith("=")
            ? { formula: value, value: "", embed: null }
            : { value, formula: "", embed: null },
        )}
        onOpenObject={onOpenObject}
        onContextMenu={contextMenu.openContextMenu}
        onStartAxisDrag={gestures.startAxisDrag}
        onStartCornerSelection={gestures.startCornerSelection}
        onStartResize={gestures.startResize}
        onResizeAxisWithKeyboard={gestures.resizeAxisWithKeyboard}
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
      />
    </div>
  );
}
