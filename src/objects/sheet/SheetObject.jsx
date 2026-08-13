import { useRef, useState } from "react";
import { IconBrackets, IconTable } from "@tabler/icons-react";
import { FormulaBar } from "../../components/FormulaBar.jsx";
import { ObjectHeader } from "../../components/ObjectHeader.jsx";
import { createId, materializeCell } from "../../model.js";
import { coordinatesFromAddress } from "../../sheet/coordinates.js";
import { cellIdsInRange, rangeLabel, rangeSize } from "../../sheet/ranges.js";
import { SheetGrid } from "./SheetGrid.jsx";

export function SheetObject({
  object,
  path,
  saveState,
  selectedAddress,
  selectionRange,
  workspaceObjects,
  onSelectAddress,
  onSelectRange,
  onUpdateObject,
  onUpdateCell,
  onUpdateCells,
  onOpenObject,
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
  const formulaEditorRef = useRef(null);
  const selectedCoordinates = coordinatesFromAddress(selectedAddress) || { row: 0, column: 0 };
  const selectedCell = materializeCell(object, selectedCoordinates.row, selectedCoordinates.column);
  const selectedRangeLabel = rangeLabel(selectionRange);
  const selectedRangeSize = rangeSize(selectionRange);
  const hasConditionalFormat = (object.conditionalFormats || []).some((rule) => rule.range === selectedRangeLabel);

  const handleFormulaChange = (value, nextFormulaMode = value.startsWith("=")) => {
    if (!selectedCell) return;
    setFormulaMode(nextFormulaMode);
    if (value.startsWith("=")) {
      onUpdateCell(selectedCell.id, { formula: value });
    } else {
      onUpdateCell(selectedCell.id, { value, formula: "" });
    }
  };

  const focusFormulaBar = (initialValue) => {
    if (initialValue != null) handleFormulaChange(initialValue);
    window.requestAnimationFrame(() => {
      const input = formulaEditorRef.current;
      if (!input) return;
      input.focus();
      const caret = input.value.length;
      input.setSelectionRange(caret, caret);
    });
  };

  const handleFormat = (patch) => {
    const changes = cellIdsInRange(selectionRange).map((targetCellId) => {
      const currentStyle = object.cells?.[targetCellId]?.style || {};
      return {
        cellId: targetCellId,
        patch: { style: patch ? { ...currentStyle, ...patch } : undefined },
      };
    });
    onUpdateCells?.(changes, "format");
  };

  const handleConditionalFormat = (kind) => {
    const withoutCurrent = (object.conditionalFormats || []).filter((rule) => rule.range !== selectedRangeLabel);
    onUpdateObject({
      conditionalFormats: kind
        ? [...withoutCurrent, { id: createId("rule"), range: selectedRangeLabel, kind }]
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
      />

      <section className="sheet-workspace">
        <FormulaBar
          address={selectedCell?.address || "A1"}
          rangeLabel={selectedRangeLabel}
          cell={selectedCell}
          inputRef={formulaEditorRef}
          onChange={handleFormulaChange}
          onFormulaModeChange={setFormulaMode}
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
          selectedAddress={selectedCell?.address || "A1"}
          selectionRange={selectionRange}
          formulaEditingCellId={formulaMode ? selectedCell?.id : null}
          onSelect={onSelectAddress}
          onSelectRange={onSelectRange}
          onFocusFormulaBar={focusFormulaBar}
          onCellChange={onUpdateCell}
          onCellsChange={onUpdateCells}
          onUpdateObject={onUpdateObject}
          onOpenObject={onOpenObject}
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
