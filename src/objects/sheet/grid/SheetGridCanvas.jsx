import { useEffect, useMemo } from "react";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { preloadObjectRenderer } from "../../objectRegistry.jsx";
import { formatFormulaResult } from "../../../sheet/formulas.js";
import { formatCellValue } from "../../../sheet/formatting.js";
import { cellAddress, cellId, columnLabel } from "../../../sheet/coordinates.js";
import { normalizeRange } from "../../../sheet/ranges.js";
import { conditionalToneForCoordinates, compileConditionalRules } from "./conditionalRuleProjection.js";
import { EmbeddedCellSlot, SheetCellSlot } from "./SheetCellSlot.jsx";
import { cellContextFor, numericRangeContains } from "./cellSlotProjection.js";

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
  formulaEditingCellId,
  formulaReferenceRange,
  onSelect,
  onSelectRange,
  onSelectionStart,
  onSelectionMove,
  onFormulaReferenceStart,
  onFormulaReferenceMove,
  onFillStart,
  onFocusFormulaBar,
  onOpenObject,
  dropTargetAddress,
  onObjectDragOver,
  onObjectDragLeave,
  onObjectDrop,
  onContextMenu,
  onStartAxisDrag,
  onStartCornerSelection,
  onStartResize,
  onResizeAxisWithKeyboard,
  onRestoreSelectionScroll,
  onToggleRowGroup,
  onToggleColumnGroup,
}) {
  const { rowHeaderWidth, columnHeaderHeight, bodyLeftInset, bodyTopInset } = metrics;
  const conditionalRules = useMemo(
    () => compileConditionalRules(object.conditionalFormats),
    [object.conditionalFormats],
  );
  const normalizedFormulaReferenceRange = useMemo(
    () => normalizeRange(formulaReferenceRange?.anchor, formulaReferenceRange?.focus),
    [formulaReferenceRange?.anchor, formulaReferenceRange?.focus],
  );

  const embeddedTypes = useMemo(
    () => [...new Set(
      Object.values(object.cells || {})
        .map((cell) => cell?.embed?.type)
        .filter(Boolean),
    )],
    [object.cells],
  );

  useEffect(() => {
    // An embedded cell is intentionally cheap to paint, but opening it can
    // cross the registry's lazy renderer boundary. Warm each type referenced
    // by this sheet ahead of the click so a tile never opens to a transient
    // empty Suspense surface while its renderer chunk is still loading.
    embeddedTypes.forEach((embedType) => preloadObjectRenderer(embedType));
  }, [embeddedTypes]);

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
          aria-selected={normalizedSelection?.rowStart === 0
            && normalizedSelection?.rowEnd === object.rows - 1
            && normalizedSelection?.columnStart === 0
            && normalizedSelection?.columnEnd === object.columns - 1}
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
              aria-selected={showActiveColumnContext && selectedCoordinates.column === column}
              aria-colindex={column + 1}
              aria-label={`Select column ${columnLabel(column)}`}
              data-axis-index={column}
              onPointerDown={(event) => onStartAxisDrag(event, "column", column)}
              onContextMenu={(event) => {
                event.preventDefault();
                onContextMenu(event, cellContextFor(object, 0, column));
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
                left: rowHeaderWidth + bodyLeftInset + columnOffsetForPosition(position),
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
              aria-selected={showActiveRowContext && selectedCoordinates.row === row}
              aria-rowindex={row + 1}
              aria-label={`Select row ${row + 1}`}
              data-axis-index={row}
              onPointerDown={(event) => onStartAxisDrag(event, "row", row)}
              onContextMenu={(event) => {
                event.preventDefault();
                onContextMenu(event, cellContextFor(object, row, 0));
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
                top: columnHeaderHeight + bodyTopInset + rowOffsetForPosition(position),
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
          const address = cellAddress(row, column);
          const cell = object.cells?.[id];
          const rawValue = cell?.value ?? "";
          const formula = cell?.formula ?? "";
          const embed = cell?.embed;
          const calculatedValue = formula ? formatFormulaResult(formulaValues.get(address)) : rawValue;
          const embeddedTitle = embed ? workspaceObjects?.[embed.objectId]?.title : "";
          const displayValue = embed
            ? embeddedTitle || rawValue || "Embedded object"
            : formatCellValue(calculatedValue, cell?.style);
          const fontSize = Number(cell?.style?.fontSize);
          const Slot = embed ? EmbeddedCellSlot : SheetCellSlot;
          return (
            <Slot
              key={id}
              objectId={object.id}
              row={row}
              column={column}
              cellId={id}
              address={address}
              left={rowHeaderWidth + bodyLeftInset + columnOffsetForPosition(columnPosition)}
              top={columnHeaderHeight + bodyTopInset + rowOffsetForPosition(position)}
              width={columnSizeForPosition(columnPosition)}
              height={rowSizeForPosition(position)}
              value={rawValue}
              formula={formula}
              displayValue={displayValue}
              embedObjectId={embed?.objectId || ""}
              embedObject={embed?.objectId ? workspaceObjects?.[embed.objectId] : null}
              embedType={embed?.type || ""}
              embedLinkId={embed?.linkId || ""}
              role={cell?.role || ""}
              styleBold={Boolean(cell?.style?.bold)}
              styleHighlight={cell?.style?.highlight || ""}
              styleTextColor={cell?.style?.textColor || ""}
              styleAlign={cell?.style?.align || ""}
              styleVerticalAlign={cell?.style?.verticalAlign || ""}
              styleFontSize={Number.isFinite(fontSize) ? fontSize : undefined}
              selected={selectedAddress === address}
              inRange={numericRangeContains(normalizedSelection, row, column)}
              inFormulaRange={numericRangeContains(normalizedFormulaReferenceRange, row, column)}
              fillPreview={numericRangeContains(fillPreviewRange, row, column)}
              conditionalTone={conditionalToneForCoordinates(conditionalRules, row, column, calculatedValue)}
              inSelectedRow={showActiveRowContext && selectedCoordinates.row === row}
              inSelectedColumn={showActiveColumnContext && selectedCoordinates.column === column}
              formulaEditingCellId={formulaEditingCellId}
              onOpenObject={onOpenObject}
              dropTarget={dropTargetAddress === address}
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
          );
        }))}
      </div>
    </div>
  );
}
