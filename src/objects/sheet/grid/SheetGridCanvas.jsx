import { useCallback, useEffect, useMemo } from "react";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { preloadObjectRenderer } from "../../objectRegistry.jsx";
import { formatFormulaResult } from "../../../sheet/formulas.js";
import { formatCellValue } from "../../../sheet/formatting.js";
import { cellAddress, cellId, columnLabel, coordinatesFromAddress } from "../../../sheet/coordinates.js";
import { isBareUrlValue } from "../../../model.js";
import { normalizeRange } from "../../../sheet/ranges.js";
import { conditionalToneForCoordinates, compileConditionalRules } from "./conditionalRuleProjection.js";
import { EmbeddedCellSlot, SheetCellSlot } from "./SheetCellSlot.jsx";
import { cellContextFor, numericRangeContains } from "./cellSlotProjection.js";

export function SheetGridCanvas({
  object,
  workspaceObjects,
  selectedAddress,
  normalizedSelection,
  multiSelectedAddresses,
  fillPreviewRange,
  formulaValues,
  rowGroups,
  columnGroups,
  rowGroupByStart,
  columnGroupByStart,
  visibleRows,
  visibleColumns,
  viewport,
  canvasSize,
  metrics,
  scrollRef,
  scrollFallbackRef,
  rowOffsetForPosition,
  rowSizeForPosition,
  columnOffsetForPosition,
  columnSizeForPosition,
  showActiveRowContext,
  showActiveColumnContext,
  selectedCoordinates,
  formulaEditingCellId,
  inlineEditingCellId,
  formulaReferenceRange,
  onSelect,
  onSelectRange,
  onToggleAxisSelection,
  onDeleteSelectedText,
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
  onResetAxisSize,
  onAutoFitAxisSize,
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

  const selectAxis = useCallback((event, axis, index) => {
    const anchorCoordinates = coordinatesFromAddress(normalizedSelection?.anchor) || selectedCoordinates;
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey) {
      event.preventDefault();
      onToggleAxisSelection?.(axis, index);
      onRestoreSelectionScroll?.();
      return;
    }

    const anchorIndex = axis === "row" ? anchorCoordinates.row : anchorCoordinates.column;
    const startIndex = event.shiftKey ? anchorIndex : index;
    const startAddress = axis === "row"
      ? cellAddress(startIndex, 0)
      : cellAddress(0, startIndex);
    const endAddress = axis === "row"
      ? cellAddress(index, object.columns - 1)
      : cellAddress(object.rows - 1, index);
    const activeAddress = axis === "row"
      ? cellAddress(index, selectedCoordinates.column)
      : cellAddress(selectedCoordinates.row, index);
    onSelectRange?.(startAddress, endAddress, activeAddress);
    onRestoreSelectionScroll?.();
  }, [normalizedSelection?.anchor, object.columns, object.rows, onRestoreSelectionScroll, onSelectRange, onToggleAxisSelection, selectedCoordinates]);

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
    <div className="sheet-scroll" data-sheet-scroll ref={scrollRef}>
      <div
        className="virtual-sheet-canvas"
        role="grid"
        aria-label={`${object.title} Tiles`}
        aria-rowcount={object.rows}
        aria-colcount={object.columns}
        style={{
          width: canvasSize.width,
          height: canvasSize.height,
        }}
      >
        <div
          className="sheet-scroll-fallback-layer"
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
          }}
        >
          <div
            ref={scrollFallbackRef}
            className="sheet-scroll-fallback"
            style={{
              position: "sticky",
              boxSizing: "border-box",
              contain: "strict",
              pointerEvents: "none",
              width: Math.max(1, viewport.width - rowHeaderWidth - bodyLeftInset),
              height: Math.max(1, viewport.height - columnHeaderHeight - bodyTopInset),
              marginLeft: rowHeaderWidth + bodyLeftInset,
              marginTop: columnHeaderHeight + bodyTopInset,
              left: rowHeaderWidth + bodyLeftInset,
              top: columnHeaderHeight + bodyTopInset,
              "--sheet-fallback-column-width": `${metrics.columnWidth}px`,
              "--sheet-fallback-row-height": `${metrics.rowHeight}px`,
              backgroundImage: "repeating-linear-gradient(to right, transparent 0 calc(var(--sheet-fallback-column-width) - 1px), var(--tray) calc(var(--sheet-fallback-column-width) - 1px) var(--sheet-fallback-column-width)), repeating-linear-gradient(to bottom, var(--cell) 0 calc(var(--sheet-fallback-row-height) - 1px), var(--tray) calc(var(--sheet-fallback-row-height) - 1px) var(--sheet-fallback-row-height))",
              backgroundPosition: "var(--sheet-fallback-x, 0) 0, 0 var(--sheet-fallback-y, 0)",
            }}
          />
        </div>

        <div
          className="sheet-column-header-rail"
          aria-hidden="false"
          style={{
            width: canvasSize.width,
            height: columnHeaderHeight,
            // The column lane owns the top stacking context. Its rail-level
            // rule also closes the deliberate 3px inset before the first
            // data column, so the corner and header seam stay continuous.
            zIndex: 25,
            borderBottom: "1px solid var(--line-strong)",
            boxSizing: "border-box",
          }}
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
            }}
          />
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
              onClick={(event) => selectAxis(event, "column", column)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  selectAxis(event, "column", column);
                }
              }}
              style={{
                left: rowHeaderWidth + bodyLeftInset + columnOffsetForPosition(position),
                top: 0,
                width: columnSizeForPosition(position),
                height: columnHeaderHeight,
                // Keep the resize hit area above the following header at the seam.
                // Headers are absolutely positioned and the handle intentionally
                // straddles that seam by a few pixels.
                zIndex: object.columns - column + 25,
                transform: "none",
              }}
            >
              <span>{columnLabel(column)}</span>
              <span className="column-resize-handle" role="separator" tabIndex={0} aria-label={`Resize column ${columnLabel(column)}`} onPointerDown={(event) => onStartResize(event, "column", column)} onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onAutoFitAxisSize?.("column", column);
              }} onKeyDown={(event) => {
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

        <div
          className="sheet-row-header-rail"
          style={{
            width: rowHeaderWidth,
            height: Math.max(0, canvasSize.height - columnHeaderHeight),
            // Row identifiers must stay above data tiles, but their nested
            // per-row z-indices must never cover the corner/column lane while
            // the canvas is scrolled. Keep this stacking context below the
            // column rail and close the vertical seam at the rail level.
            zIndex: 15,
            borderRight: "1px solid var(--line-strong)",
            boxSizing: "border-box",
          }}
        >
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
              onClick={(event) => selectAxis(event, "row", row)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  selectAxis(event, "row", row);
                }
              }}
              style={{
                left: 0,
                top: bodyTopInset + rowOffsetForPosition(position),
                width: rowHeaderWidth,
                height: rowSizeForPosition(position),
                // The bottom resize handle straddles the next row header. Paint
                // earlier rows above later rows so the active seam remains a
                // real pointer target instead of being covered by its neighbor.
                zIndex: object.rows - row + 60,
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
              <span className="row-resize-handle" role="separator" tabIndex={0} aria-label={`Resize row ${row + 1}`} onPointerDown={(event) => onStartResize(event, "row", row)} onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onAutoFitAxisSize?.("row", row);
              }} onKeyDown={(event) => {
                if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                  event.preventDefault();
                  onResizeAxisWithKeyboard("row", row, event.key === "ArrowUp" ? -4 : 4);
                }
              }} />
            </div>
          );
        })}
        </div>

        {visibleRows.flatMap(({ row, position }) => visibleColumns.map(({ column, position: columnPosition }) => {
          const id = cellId(row, column);
          const address = cellAddress(row, column);
          const cell = object.cells?.[id];
          const rawValue = cell?.value ?? "";
          const formula = cell?.formula ?? "";
          const embed = cell?.embed;
          const calculatedValue = formula ? formatFormulaResult(formulaValues.get(address)) : rawValue;
          const embeddedTitle = embed ? workspaceObjects?.[embed.objectId]?.title : "";
          const linkUrl = !embed && !formula && isBareUrlValue(rawValue) ? rawValue : "";
          const displayValue = embed
            ? embeddedTitle || rawValue || "Embedded object"
            : linkUrl
              ? rawValue
              : formatCellValue(calculatedValue, cell?.style);
          const fontSize = Number(cell?.style?.fontSize);
          const Slot = embed || linkUrl ? EmbeddedCellSlot : SheetCellSlot;
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
              linkUrl={linkUrl}
              role={cell?.role || ""}
              styleBold={Boolean(cell?.style?.bold)}
              styleHighlight={cell?.style?.highlight || ""}
              styleTextColor={cell?.style?.textColor || ""}
              styleAlign={cell?.style?.align || ""}
              styleVerticalAlign={cell?.style?.verticalAlign || ""}
              styleFontSize={Number.isFinite(fontSize) ? fontSize : undefined}
              selected={selectedAddress === address}
              multiSelected={multiSelectedAddresses?.has(address)}
              inRange={numericRangeContains(normalizedSelection, row, column)}
              inFormulaRange={numericRangeContains(normalizedFormulaReferenceRange, row, column)}
              fillPreview={numericRangeContains(fillPreviewRange, row, column)}
              conditionalTone={conditionalToneForCoordinates(conditionalRules, row, column, calculatedValue)}
              inSelectedRow={showActiveRowContext && selectedCoordinates.row === row}
              inSelectedColumn={showActiveColumnContext && selectedCoordinates.column === column}
              formulaEditingCellId={formulaEditingCellId}
              inlineEditingCellId={inlineEditingCellId}
              onOpenObject={onOpenObject}
              dropTarget={dropTargetAddress === address}
              onObjectDragOver={onObjectDragOver}
              onObjectDragLeave={onObjectDragLeave}
              onObjectDrop={onObjectDrop}
              onSelect={onSelect}
              onDeleteSelectedText={onDeleteSelectedText}
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
