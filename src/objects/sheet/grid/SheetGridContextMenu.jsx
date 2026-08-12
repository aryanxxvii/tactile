import { createId } from "../../../model.js";
import { sortRangeChanges } from "../../../sheet/sort.js";
import { cellIdsInRange, rangeContains } from "../../../sheet/ranges.js";
import { CellContextMenu } from "../CellContextMenu.jsx";

export function SheetGridContextMenu({
  menu,
  setMenu,
  normalizedSelection,
  object,
  workspaceObjects,
  formulaValues,
  rowGroups,
  columnGroups,
  filters,
  onCreateEmbedded,
  onCellsChange,
  onSelect,
  onSelectRange,
  onUpdateObject,
  onInsertAxis,
  onDeleteAxis,
  onOpenObject,
  onAttachFile,
  onCopy,
  onPaste,
}) {
  return (
    <CellContextMenu
      menu={menu}
      onClose={() => setMenu(null)}
      onCreate={(type) => onCreateEmbedded?.(menu.cell, type, menu.sourceElement)}
      onCopy={onCopy}
      onPaste={onPaste}
      onClear={() => {
        const activeRange = rangeContains(normalizedSelection, menu.cell.row, menu.cell.column)
          ? normalizedSelection
          : { anchor: menu.cell.address, focus: menu.cell.address };
        const changes = cellIdsInRange(activeRange).map((targetCellId) => ({
          cellId: targetCellId,
          patch: {
            value: "",
            formula: "",
            embed: null,
            note: undefined,
            style: undefined,
            validation: undefined,
          },
        }));
        onCellsChange?.(changes, "clear-range");
      }}
      onInsertRow={() => onInsertAxis?.("row", menu.cell.row)}
      onInsertColumn={() => onInsertAxis?.("column", menu.cell.column)}
      onDeleteRow={() => onDeleteAxis?.("row", menu.cell.row)}
      onDeleteColumn={() => onDeleteAxis?.("column", menu.cell.column)}
      onAttachFile={onAttachFile}
      onOpenFloating={() => {
        if (!menu.cell.embed) return;
        onOpenObject?.({
          objectId: menu.cell.embed.objectId,
          linkId: menu.cell.embed.linkId,
          sourceObjectId: object.id,
          sourceCellId: menu.cell.id,
          sourceAddress: menu.cell.address,
          sourceLabel: workspaceObjects?.[menu.cell.embed.objectId]?.title || menu.cell.value || "Embedded object",
          sourceType: menu.cell.embed.type,
          sourceElement: menu.sourceElement,
          mode: "floating",
        });
      }}
      onOpenFull={() => {
        if (!menu.cell.embed) return;
        onOpenObject?.({
          objectId: menu.cell.embed.objectId,
          linkId: menu.cell.embed.linkId,
          sourceObjectId: object.id,
          sourceCellId: menu.cell.id,
          sourceAddress: menu.cell.address,
          sourceLabel: workspaceObjects?.[menu.cell.embed.objectId]?.title || menu.cell.value || "Embedded object",
          sourceType: menu.cell.embed.type,
          sourceElement: menu.sourceElement,
          mode: "full",
        });
      }}
      canClear={cellIdsInRange(
        rangeContains(normalizedSelection, menu?.cell?.row, menu?.cell?.column)
          ? normalizedSelection
          : { anchor: menu?.cell?.address, focus: menu?.cell?.address },
      ).some((targetCellId) => Boolean(object.cells?.[targetCellId]))}
      canSort={Boolean(normalizedSelection && normalizedSelection.rowEnd > normalizedSelection.rowStart)}
      onSort={(direction) => {
        const changes = sortRangeChanges(object, normalizedSelection, menu.cell.column, direction);
        onCellsChange?.(changes, `sort-${direction}`);
      }}
      canGroupRows={Boolean(
        normalizedSelection
        && normalizedSelection.rowEnd > normalizedSelection.rowStart
        && !rowGroups.some((group) => normalizedSelection.rowStart <= group.end && normalizedSelection.rowEnd >= group.start)
      )}
      canUngroupRows={rowGroups.some((group) => menu && menu.cell.row >= group.start && menu.cell.row <= group.end)}
      onGroupRows={() => {
        if (!normalizedSelection || normalizedSelection.rowEnd <= normalizedSelection.rowStart) return;
        onUpdateObject?.({
          rowGroups: [
            ...rowGroups,
            {
              id: createId("row-group"),
              start: normalizedSelection.rowStart,
              end: normalizedSelection.rowEnd,
              collapsed: false,
            },
          ],
        });
      }}
      onUngroupRows={() => {
        if (!menu) return;
        onUpdateObject?.({
          rowGroups: rowGroups.filter((group) => !(menu.cell.row >= group.start && menu.cell.row <= group.end)),
        });
      }}
      canGroupColumns={Boolean(
        normalizedSelection
        && normalizedSelection.columnEnd > normalizedSelection.columnStart
        && !columnGroups.some((group) => normalizedSelection.columnStart <= group.end && normalizedSelection.columnEnd >= group.start)
      )}
      canUngroupColumns={columnGroups.some((group) => menu && menu.cell.column >= group.start && menu.cell.column <= group.end)}
      onGroupColumns={() => {
        if (!normalizedSelection || normalizedSelection.columnEnd <= normalizedSelection.columnStart) return;
        onUpdateObject?.({
          columnGroups: [
            ...columnGroups,
            {
              id: createId("column-group"),
              start: normalizedSelection.columnStart,
              end: normalizedSelection.columnEnd,
              collapsed: false,
            },
          ],
        });
      }}
      onUngroupColumns={() => {
        if (!menu) return;
        onUpdateObject?.({
          columnGroups: columnGroups.filter((group) => !(menu.cell.column >= group.start && menu.cell.column <= group.end)),
        });
      }}
      canFilter={Boolean(menu?.cell && (menu.cell.formula || menu.cell.value))}
      hasFilters={filters.length > 0}
      onFilterValue={() => {
        if (!menu) return;
        const value = menu.cell.formula
          ? formulaValues.get(menu.cell.address)
          : menu.cell.value;
        onSelect(menu.cell.address);
        onUpdateObject?.({
          filters: [
            ...filters.filter((filter) => filter.column !== menu.cell.column),
            { id: createId("filter"), column: menu.cell.column, value: String(value ?? "") },
          ],
        });
      }}
      onClearFilters={() => onUpdateObject?.({ filters: [] })}
    />
  );
}
