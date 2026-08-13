import { useEffect } from "react";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { createCellRecord } from "../../../model.js";
import { preloadObjectRenderer } from "../../objectRegistry.jsx";
import { formatFormulaResult } from "../../../sheet/formulas.js";
import { formatCellValue } from "../../../sheet/formatting.js";
import { conditionalToneForCell } from "../../../sheet/conditionalFormatting.js";
import { cellAddress, cellId, columnLabel } from "../../../sheet/coordinates.js";
import { rangeContains } from "../../../sheet/ranges.js";
import { SheetCell } from "../SheetCell.jsx";

export function SheetGridCanvas({
  object,
  workspaceObjects,
  selectedAddress,
  normalizedSelection,
  fillPreviewRange,
  formulaValues,
  rowGroups,
  columnGroups,
  rowGroupByStart,
  columnGroupByStart,
  visibleRows,
  visibleColumns,
  canvasSize,
  metrics,
  scrollRef,
  onScroll,
  rowOffsetForPosition,
  rowSizeForPosition,
  columnOffsetForPosition,
  columnSizeForPosition,
  showActiveRowContext,
  showActiveColumnContext,
  selectedCoordinates,
  editingCellId,
  onSelect,
  onSelectRange,
  onSelectionStart,
  onSelectionMove,
  onFillStart,
  onEdit,
  onCommit,
  onValueChange,
  onOpenObject,
  onContextMenu,
  onStartAxisDrag,
  onStartCornerSelection,
  onStartResize,
  onResizeAxisWithKeyboard,
  onRestoreSelectionScroll,
  onToggleRowGroup,
  onToggleColumnGroup,
}) {
  const { rowHeaderWidth, columnHeaderHeight } = metrics;

  useEffect(() => {
    const embedType = object.cells?.[cellId(selectedCoordinates.row, selectedCoordinates.column)]?.embed?.type;
    if (embedType) preloadObjectRenderer(embedType);
  }, [object.cells, selectedCoordinates.column, selectedCoordinates.row]);

  return (
    <div className="sheet-scroll" data-sheet-scroll ref={scrollRef} onScroll={onScroll}>
      <div
        className="virtual-sheet-canvas"
        role="grid"
        aria-label={`${object.title} Tiles`}
        aria-rowcount={object.rows}
        aria-colcount={object.columns}
        style={{ width: canvasSize.width, height: canvasSize.height }}
      >
        <div
          className="sheet-corner virtual-sheet-header"
          role="button"
          tabIndex={0}
          aria-label="Select entire sheet"
          onPointerDown={onStartCornerSelection}
          onClick={() => {
            onSelectRange?.("A1", cellAddress(object.rows - 1, object.columns - 1), selectedAddress);
            onRestoreSelectionScroll();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelectRange?.("A1", cellAddress(object.rows - 1, object.columns - 1), selectedAddress);
            }
          }}
          style={{
            left: 0,
            top: 0,
            width: rowHeaderWidth,
            height: columnHeaderHeight,
            transform: "translate3d(var(--sheet-scroll-x, 0px), var(--sheet-scroll-y, 0px), 0)",
          }}
        />

        <div
          className="sheet-column-header-rail"
          aria-hidden="false"
          style={{ width: canvasSize.width, height: columnHeaderHeight }}
        >
        {visibleColumns.map(({ column, position }) => {
          const columnGroup = columnGroupByStart.get(column);
          return (
            <div
              className={`column-header virtual-sheet-header ${columnGroup ? "has-group" : ""} ${showActiveColumnContext && selectedCoordinates.column === column ? "is-active" : ""}`}
              role="columnheader"
              tabIndex={0}
              aria-colindex={column + 1}
              aria-label={`Select column ${columnLabel(column)}`}
              data-axis-index={column}
              onPointerDown={(event) => onStartAxisDrag(event, "column", column)}
              onContextMenu={(event) => {
                event.preventDefault();
                onContextMenu(event, object.cells?.[cellId(0, column)] || createCellRecord(0, column));
              }}
              key={`column-${column}`}
              onClick={() => {
                onSelectRange?.(cellAddress(0, column), cellAddress(object.rows - 1, column), cellAddress(selectedCoordinates.row, column));
                onRestoreSelectionScroll();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectRange?.(cellAddress(0, column), cellAddress(object.rows - 1, column), cellAddress(selectedCoordinates.row, column));
                }
              }}
              style={{
                left: rowHeaderWidth + columnOffsetForPosition(position),
                top: 0,
                width: columnSizeForPosition(position),
                height: columnHeaderHeight,
                transform: "none",
              }}
            >
              <span>{columnLabel(column)}</span>
              <span className="column-resize-handle" role="separator" tabIndex={0} aria-label={`Resize column ${columnLabel(column)}`} onPointerDown={(event) => onStartResize(event, "column", column)} onKeyDown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  onResizeAxisWithKeyboard("column", column, event.key === "ArrowLeft" ? -8 : 8);
                }
              }} />
              {columnGroup ? (
                <button
                  className="column-group-toggle"
                  type="button"
                  aria-label={`${columnGroup.collapsed ? "Expand" : "Collapse"} columns ${columnLabel(columnGroup.start)} to ${columnLabel(columnGroup.end)}`}
                  aria-expanded={!columnGroup.collapsed}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleColumnGroup(columnGroup.id);
                  }}
                >
                  {columnGroup.collapsed
                    ? <IconChevronRight size={10} stroke={1.8} />
                    : <IconChevronDown size={10} stroke={1.8} />}
                </button>
              ) : null}
            </div>
          );
        })}
        </div>

        {visibleRows.map(({ row, position }) => {
          const rowGroup = rowGroupByStart.get(row);
          return (
            <div
              className={`row-header virtual-sheet-header ${rowGroup ? "has-group" : ""} ${showActiveRowContext && selectedCoordinates.row === row ? "is-active" : ""}`}
              role="rowheader"
              tabIndex={0}
              aria-rowindex={row + 1}
              aria-label={`Select row ${row + 1}`}
              data-axis-index={row}
              onPointerDown={(event) => onStartAxisDrag(event, "row", row)}
              onContextMenu={(event) => {
                event.preventDefault();
                onContextMenu(event, object.cells?.[cellId(row, 0)] || createCellRecord(row, 0));
              }}
              key={`row-${row}`}
              onClick={() => {
                onSelectRange?.(cellAddress(row, 0), cellAddress(row, object.columns - 1), cellAddress(row, selectedCoordinates.column));
                onRestoreSelectionScroll();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectRange?.(cellAddress(row, 0), cellAddress(row, object.columns - 1), cellAddress(row, selectedCoordinates.column));
                }
              }}
              style={{
                left: 0,
                top: columnHeaderHeight + rowOffsetForPosition(position),
                width: rowHeaderWidth,
                height: rowSizeForPosition(position),
                transform: "translate3d(var(--sheet-scroll-x, 0px), 0, 0)",
              }}
            >
              {rowGroup ? (
                <button
                  className="row-group-toggle"
                  type="button"
                  aria-label={`${rowGroup.collapsed ? "Expand" : "Collapse"} rows ${rowGroup.start + 1} to ${rowGroup.end + 1}`}
                  aria-expanded={!rowGroup.collapsed}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleRowGroup(rowGroup.id);
                  }}
                >
                  {rowGroup.collapsed
                    ? <IconChevronRight size={11} stroke={1.8} />
                    : <IconChevronDown size={11} stroke={1.8} />}
                </button>
              ) : null}
              <span>{row + 1}</span>
              <span className="row-resize-handle" role="separator" tabIndex={0} aria-label={`Resize row ${row + 1}`} onPointerDown={(event) => onStartResize(event, "row", row)} onKeyDown={(event) => {
                if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                  event.preventDefault();
                  onResizeAxisWithKeyboard("row", row, event.key === "ArrowUp" ? -4 : 4);
                }
              }} />
            </div>
          );
        })}

        {visibleRows.flatMap(({ row, position }) => visibleColumns.map(({ column, position: columnPosition }) => {
          const id = cellId(row, column);
          const cell = object.cells[id] || createCellRecord(row, column);
          const calculatedValue = cell.formula ? formatFormulaResult(formulaValues.get(cell.address)) : cell.value;
          const embeddedTitle = cell.embed ? workspaceObjects?.[cell.embed.objectId]?.title : "";
          const displayValue = cell.embed
            ? embeddedTitle || cell.value || "Embedded object"
            : formatCellValue(calculatedValue, cell.style);
          const isActiveCell = selectedAddress === cell.address;
          return (
            <div
              className={`virtual-cell-slot ${isActiveCell ? "is-active-cell-slot" : ""}`}
              key={id}
              data-row={row}
              data-column={column}
              style={{
                left: rowHeaderWidth + columnOffsetForPosition(columnPosition),
                top: columnHeaderHeight + rowOffsetForPosition(position),
                width: columnSizeForPosition(columnPosition),
                height: rowSizeForPosition(position),
              }}
            >
              <SheetCell
                objectId={object.id}
                cell={cell}
                embeddedObject={cell.embed ? workspaceObjects?.[cell.embed.objectId] : null}
                displayValue={displayValue}
                conditionalTone={conditionalToneForCell(object, cell, calculatedValue)}
                selected={isActiveCell}
                inRange={rangeContains(normalizedSelection, row, column)}
                fillPreview={rangeContains(fillPreviewRange, row, column)}
                inSelectedRow={showActiveRowContext && selectedCoordinates.row === row}
                inSelectedColumn={showActiveColumnContext && selectedCoordinates.column === column}
                editing={editingCellId === id}
                onSelect={onSelect}
                onSelectionStart={onSelectionStart}
                onSelectionMove={onSelectionMove}
                onFillStart={onFillStart}
                onEdit={onEdit}
                onCommit={onCommit}
                onValueChange={onValueChange}
                onOpenObject={onOpenObject}
                onContextMenu={onContextMenu}
              />
            </div>
          );
        }))}
      </div>
    </div>
  );
}
