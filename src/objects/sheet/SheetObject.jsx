import { useRef, useState } from "react";
import { IconBrackets, IconTable } from "@tabler/icons-react";
import { FormulaBar } from "../../components/FormulaBar.jsx";
import { ObjectHeader } from "../../components/ObjectHeader.jsx";
import { dispatchCellEditSeed } from "../../components/localEditSession.js";
import { createId, materializeCell } from "../../model.js";
import { cellAddress, cellId, coordinatesFromAddress, moveAddress } from "../../sheet/coordinates.js";
import { cellIdsInRange, rangeLabel, rangeSize } from "../../sheet/ranges.js";
import { SheetGrid } from "./SheetGrid.jsx";
import { canonicalSheetSelection } from "./grid/selectionGeometry.js";

export function SheetObject({
  object,
  path,
  saveState,
  selectedAddress,
  selectionRange,
  multiSelectedAddresses = [],
  workspaceObjects,
  onSelectAddress,
  onSelectRange,
  onToggleMultiSelect,
  onToggleAxisSelection,
  onDeleteSelectedText,
  onUpdateObject,
  onUpdateCell,
  onUpdateCells,
  onOpenObject,
  onReparentObject,
  onCreateEmbedded,
  onInsertAxis,
  onDeleteAxis,
  onMoveAxis,
  onBack,
  canGoBack,
  workspaceActions,
  sheetMetrics,
  onCreateFile,
}) {
  const [formulaMode, setFormulaMode] = useState(false);
  const [editingCellId, setEditingCellId] = useState(null);
  const formulaEditorRef = useRef(null);
  const canonicalSelection = canonicalSheetSelection({
    selectedAddress,
    selectionRange,
    rows: object.rows,
    columns: object.columns,
  });
  const {
    selectedAddress: canonicalSelectedAddress,
    selectedCoordinates,
    range: canonicalRange,
  } = canonicalSelection;
  const selectedCell = materializeCell(object, selectedCoordinates.row, selectedCoordinates.column);
  const selectedRangeLabel = rangeLabel(canonicalRange);
  const selectedRangeSize = rangeSize(canonicalRange);
  const hasConditionalFormat = (object.conditionalFormats || []).some((rule) => rule.range === selectedRangeLabel);
  const additiveSelectionAddresses = [...new Set(
    multiSelectedAddresses
      .map((address) => {
        const coordinates = coordinatesFromAddress(address);
        if (!coordinates || coordinates.row >= object.rows || coordinates.column >= object.columns) return null;
        return cellAddress(coordinates.row, coordinates.column);
      })
      .filter(Boolean),
  )];
  const formattingCellIds = additiveSelectionAddresses.length
    ? additiveSelectionAddresses.map((address) => {
      const coordinates = coordinatesFromAddress(address);
      return cellId(coordinates.row, coordinates.column);
    })
    : cellIdsInRange(canonicalRange);

  const handleFormulaCommit = (value) => {
    if (!selectedCell) return;
    if (value.startsWith("=")) {
      onUpdateCell(selectedCell.id, { formula: value });
    } else {
      onUpdateCell(selectedCell.id, { value, formula: "" });
    }
  };

  const focusFormulaBar = (initialValue, targetAddress = selectedCell?.address || "A1", options = {}) => {
    const targetCoordinates = coordinatesFromAddress(targetAddress);
    const targetCellId = targetCoordinates
      ? cellId(targetCoordinates.row, targetCoordinates.column)
      : selectedCell?.id || null;
    if (targetAddress !== selectedCell?.address) onSelectAddress(targetAddress);
    if (options.inline === false) {
      setEditingCellId(null);
      window.requestAnimationFrame(() => formulaEditorRef.current?.focus());
      return;
    }
    setEditingCellId(targetCellId);
    window.requestAnimationFrame(() => {
      if (initialValue != null) dispatchCellEditSeed(formulaEditorRef.current, initialValue, { focus: false });
      const input = document.querySelector(
        `[data-object-id="${object.id}"][data-cell-address="${targetAddress}"] .cell-inline-editor`,
      );
      if (!input) return;
      input.focus();
      const caret = input.value.length;
      input.setSelectionRange(caret, caret);
    });
  };

  const moveBelowAfterCommit = () => {
    if (selectedCoordinates.row >= object.rows - 1) return;
    onSelectAddress(moveAddress(
      cellAddress(selectedCoordinates.row, selectedCoordinates.column),
      1,
      0,
      object.rows,
      object.columns,
    ));
  };

  const handleFormat = (patch) => {
    const changes = formattingCellIds.map((targetCellId) => {
      const currentStyle = object.cells?.[targetCellId]?.style || {};
      return {
        cellId: targetCellId,
        patch: { style: patch ? { ...currentStyle, ...patch } : undefined },
      };
    });
    onUpdateCells?.(changes, "format");
  };

  const handleConditionalFormat = (kind) => {
    const targetRanges = additiveSelectionAddresses.length ? additiveSelectionAddresses : [selectedRangeLabel];
    const targetRangeSet = new Set(targetRanges);
    const withoutCurrent = (object.conditionalFormats || []).filter((rule) => !targetRangeSet.has(rule.range));
    onUpdateObject({
      conditionalFormats: kind
        ? [
          ...withoutCurrent,
          ...targetRanges.map((range) => ({ id: createId("rule"), range, kind })),
        ]
        : withoutCurrent,
    });
  };

  return (
    <article className="object-surface sheet-object" data-object-type="sheet">
      <ObjectHeader
        object={object}
        path={path}
        saveState={saveState}
        onChange={onUpdateObject}
        onBack={onBack}
        canGoBack={canGoBack}
        workspaceActions={workspaceActions}
        onReparentObject={onReparentObject}
      />

      <section className="sheet-workspace">
        <FormulaBar
          address={selectedCell?.address || "A1"}
          rangeLabel={selectedRangeLabel}
          cell={selectedCell}
          formulaSheet={object}
          inputRef={formulaEditorRef}
          onChange={handleFormulaCommit}
          onFormulaModeChange={setFormulaMode}
          onCommit={moveBelowAfterCommit}
          onEditEnd={() => setEditingCellId(null)}
          onAddressChange={onSelectAddress}
          onFormat={handleFormat}
          onConditionalFormat={handleConditionalFormat}
          hasConditionalFormat={hasConditionalFormat}
          filterCount={object.filters?.length || 0}
          onClearFilters={() => onUpdateObject({ filters: [] })}
        />
        <SheetGrid
          object={object}
          workspaceObjects={workspaceObjects}
          selectedAddress={canonicalSelectedAddress}
          selectionRange={canonicalRange}
          multiSelectedAddresses={multiSelectedAddresses}
          formulaEditingCellId={formulaMode ? selectedCell?.id : null}
          inlineEditingCellId={editingCellId}
          onSelect={onSelectAddress}
          onSelectRange={onSelectRange}
          onToggleMultiSelect={onToggleMultiSelect}
          onToggleAxisSelection={onToggleAxisSelection}
          onDeleteSelectedText={onDeleteSelectedText}
          onFocusFormulaBar={focusFormulaBar}
          onCellChange={onUpdateCell}
          onCellsChange={onUpdateCells}
          onUpdateObject={onUpdateObject}
          onOpenObject={onOpenObject}
          onReparentObject={onReparentObject}
          onCreateEmbedded={onCreateEmbedded}
          onInsertAxis={onInsertAxis}
          onDeleteAxis={onDeleteAxis}
          onMoveAxis={onMoveAxis}
          sheetMetrics={sheetMetrics}
          onCreateFile={onCreateFile}
        />
      </section>

      <footer className="object-statusbar">
        <span className="status-spacer" />
        <span className="status-item active-cell-status">
          <span className="status-caption">{selectedRangeSize > 1 ? "Range" : "Active"}</span>
          <code>{selectedRangeSize > 1 ? selectedRangeLabel : selectedCell?.address || "A1"}</code>
        </span>
        {selectedRangeSize > 1 ? <span className="status-item range-status">· {selectedRangeSize} cells</span> : null}
        {object.filters?.length ? <span className="status-item filter-status">{object.filters.length} filter{object.filters.length === 1 ? "" : "s"} active</span> : null}
        {object.rowGroups?.length ? <span className="status-item">{object.rowGroups.length} row group{object.rowGroups.length === 1 ? "" : "s"}</span> : null}
        {object.columnGroups?.length ? <span className="status-item">{object.columnGroups.length} column group{object.columnGroups.length === 1 ? "" : "s"}</span> : null}
        <span className="status-item"><IconTable size={14} stroke={1.6} /> {object.rows} × {object.columns}</span>
        <span className="status-divider">·</span>
        <span className="status-item keyboard-hint"><IconBrackets size={14} stroke={1.6} /> <kbd>]</kbd> in <kbd>[</kbd> out</span>
      </footer>
    </article>
  );
}
