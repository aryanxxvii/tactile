import { useCallback, useRef, useState } from "react";
import { SheetGridCanvas } from "./grid/SheetGridCanvas.jsx";
import { SheetGridContextMenu } from "./grid/SheetGridContextMenu.jsx";
import { useSheetGridContextMenu } from "./grid/useSheetGridContextMenu.js";
import { useSheetGridGestures } from "./grid/useSheetGridGestures.js";
import { useSheetGridProjection } from "./grid/useSheetGridProjection.js";
import {
  isObjectDragEvent,
  readObjectDragData,
} from "../../shell/objectDrag.js";

function useLatestCallback(callback) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  return useCallback((...args) => callbackRef.current?.(...args), []);
}

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
  const stableOnSelect = useLatestCallback(onSelect);
  const stableOnSelectRange = useLatestCallback(onSelectRange);
  const stableOnFocusFormulaBar = useLatestCallback(onFocusFormulaBar);
  const stableOnCellChange = useLatestCallback(onCellChange);
  const stableOnCellsChange = useLatestCallback(onCellsChange);
  const stableOnUpdateObject = useLatestCallback(onUpdateObject);
  const stableOnOpenObject = useLatestCallback(onOpenObject);
  const stableOnReparentObject = useLatestCallback(onReparentObject);
  const stableOnCreateFile = useLatestCallback(onCreateFile);
  const stableOnMoveAxis = useLatestCallback(onMoveAxis);
  const handleObjectDragOver = useCallback((event, address) => {
    if (!isObjectDragEvent(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setDropTargetAddress(address);
  }, []);
  const handleObjectDragLeave = useCallback((event) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setDropTargetAddress("");
  }, []);
  const handleObjectDrop = useCallback((event, address) => {
    event.preventDefault();
    event.stopPropagation();
    const payload = readObjectDragData(event);
    setDropTargetAddress("");
    if (payload) stableOnReparentObject?.(payload, { parentObjectId: object.id, address });
  }, [object.id, stableOnReparentObject]);
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
    onSelect: stableOnSelect,
    onSelectRange: stableOnSelectRange,
    onCellChange: stableOnCellChange,
    onCellsChange: stableOnCellsChange,
    onUpdateObject: stableOnUpdateObject,
    onMoveAxis: stableOnMoveAxis,
    fillTarget,
    setFillTarget,
    onResizePreview: setResizePreview,
  });
  const contextMenu = useSheetGridContextMenu({
    object,
    normalizedSelection: projection.normalizedSelection,
    onCellsChange: stableOnCellsChange,
    onSelectRange: stableOnSelectRange,
    onCreateFile: stableOnCreateFile,
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
        viewport={projection.viewport}
        canvasSize={projection.canvasSize}
        metrics={projection.metrics}
        scrollRef={projection.scrollRef}
        scrollFallbackRef={projection.scrollFallbackRef}
        rowOffsetForPosition={projection.rowOffsetForPosition}
        rowSizeForPosition={projection.rowSizeForPosition}
        columnOffsetForPosition={projection.columnOffsetForPosition}
        columnSizeForPosition={projection.columnSizeForPosition}
        showActiveRowContext={projection.showActiveRowContext}
        showActiveColumnContext={projection.showActiveColumnContext}
        selectedCoordinates={projection.selectedCoordinates}
        formulaEditingCellId={formulaEditingCellId}
        formulaReferenceRange={gestures.formulaReferenceRange}
        onSelect={stableOnSelect}
        onSelectRange={stableOnSelectRange}
        onSelectionStart={gestures.startSelection}
        onSelectionMove={gestures.moveSelectionGesture}
        onFormulaReferenceStart={gestures.startFormulaReference}
        onFormulaReferenceMove={gestures.moveFormulaReference}
        onFillStart={gestures.startFill}
        onFocusFormulaBar={stableOnFocusFormulaBar}
        onOpenObject={stableOnOpenObject}
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
