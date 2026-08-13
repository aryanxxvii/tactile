import type {
  ApplyFormattingCommand,
  CreateEmbeddedObjectCommand,
  DeleteAxisCommand,
  InsertAxisCommand,
  MoveAxisCommand,
  ReplaceAssetCommand,
  ResizeAxisCommand,
  SetCellCommand,
  SetRangeCommand,
  UpdateObjectCommand,
  UpdateThemeCommand,
  WorkspaceCommand,
} from "../commands.ts";
import type { AssetRecord, CellRecord, SheetObject, ThemeRecord, WorkspaceMeta, WorkspaceObject } from "../domain.ts";
import type { DirtyReason, DirtyRecord, WorkspacePatchOperation } from "../patches.ts";
import type { AxisName, CellPatch } from "../domain.ts";
import type { CellId, ObjectId } from "../ids.ts";
import { asAssetId, asCellId, asEmbedLinkId, asObjectId, asThemeId, asTimestamp } from "../ids.ts";
import { cellAddress, cellId, coordinatesFromCellId } from "../coordinates.ts";
import { cellIdsInRange } from "../ranges.ts";
import { createCellRecord, createObjectForType, isCellUsed, normalizeIconEmoji } from "../model.ts";
import {
  adjustAxisGroups,
  adjustColumnFilters,
  adjustConditionalFormats,
  adjustFormulaForAxis,
  reorderFormulaForAxis,
} from "../structure.ts";
import { cloneValue, deepEqual } from "../engine/clone.ts";
import { NormalizedRecordStore } from "../engine/normalizedStore.ts";
import type { DispatchableWorkspaceCommand } from "./types.ts";

export interface ExecuteCommandOptions {
  builder?: TransactionMutationBuilder;
  touchMeta?: boolean;
  timestamp?: string;
}

export interface CommandEffects {
  operations: WorkspacePatchOperation[];
  changedObjectIds: ObjectId[];
  changedCellIds: CellId[];
  invalidatedFormulaIds: CellId[];
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function timestampFor(command: WorkspaceCommand, timestamp?: string): string {
  return timestamp || String(command.issuedAt || new Date().toISOString());
}

function objectBefore(store: NormalizedRecordStore, objectId: ObjectId): WorkspaceObject | null {
  return cloneValue(store.getObject(objectId) || null);
}

function cellBefore(store: NormalizedRecordStore, objectId: ObjectId, cellId: CellId): CellRecord | null {
  return cloneValue(store.getCell(objectId, cellId) || null);
}

function assetBefore(store: NormalizedRecordStore, assetId: string): AssetRecord | null {
  return cloneValue(store.getAsset(assetId) || null);
}

function cloneCellOrNull(cell: CellRecord | null | undefined): CellRecord | null {
  return cell ? cloneValue(cell) : null;
}

export class TransactionMutationBuilder {
  private readonly operations: WorkspacePatchOperation[] = [];

  private readonly store: NormalizedRecordStore;

  constructor(store: NormalizedRecordStore) {
    this.store = store;
  }

  hasChanges(): boolean {
    return this.operations.length > 0;
  }

  getOperations(): WorkspacePatchOperation[] {
    return this.operations.slice();
  }

  replaceWorkspaceMeta(after: WorkspaceMeta): void {
    const before = cloneValue(this.store.getWorkspaceMeta());
    const next = cloneValue(after);
    if (deepEqual(before, next)) return;
    this.store.replaceWorkspaceMeta(next);
    this.operations.push({ kind: "replace-workspace-meta", before, after: next });
  }

  replaceObject(objectId: ObjectId | string, after: WorkspaceObject | null): void {
    const id = asObjectId(String(objectId));
    const before = objectBefore(this.store, id);
    const next = cloneValue(after);
    if (deepEqual(before, next)) return;
    this.store.replaceObject(id, next);
    this.operations.push({ kind: "replace-object", objectId: id, before, after: next });
  }

  replaceCell(objectId: ObjectId | string, cellId: CellId | string, after: CellRecord | null): void {
    const object = asObjectId(String(objectId));
    const cell = asCellId(String(cellId));
    const before = cellBefore(this.store, object, cell);
    const next = cloneCellOrNull(after);
    if (deepEqual(before, next)) return;
    this.store.replaceCell(object, cell, next);
    this.operations.push({ kind: "replace-cell", objectId: object, cellId: cell, before, after: next });
  }

  replaceAsset(assetId: string, after: AssetRecord | null): void {
    const id = asAssetId(String(assetId));
    const before = assetBefore(this.store, id);
    const next = cloneValue(after);
    if (deepEqual(before, next)) return;
    this.store.replaceAsset(id, next);
    this.operations.push({ kind: "replace-asset", assetId: id, before, after: next });
  }

  replaceTheme(themeId: string, after: ThemeRecord | null): void {
    const id = asThemeId(String(themeId));
    const before = cloneValue(this.store.getTheme(id) || null);
    const next = cloneValue(after);
    if (deepEqual(before, next)) return;
    this.store.replaceTheme(id, next);
    this.operations.push({ kind: "replace-theme", themeId: id, before, after: next });
  }

  touchMeta(timestamp: string): void {
    const current = this.store.getWorkspaceMeta();
    if (current.updatedAt === timestamp) return;
    this.replaceWorkspaceMeta({ ...current, updatedAt: asTimestamp(timestamp) });
  }
}

function applyCellPatch(
  store: NormalizedRecordStore,
  builder: TransactionMutationBuilder,
  objectId: ObjectId,
  targetCellId: CellId,
  patch: CellPatch,
): void {
  const coordinates = coordinatesFromCellId(targetCellId);
  if (!coordinates || store.getObject(objectId)?.type !== "sheet") return;
  const current = store.getCell(objectId, targetCellId);
  const next = createCellRecord(coordinates.row, coordinates.column, {
    ...(current || {}),
    ...patch,
  });
  builder.replaceCell(objectId, targetCellId, isCellUsed(next) ? next : null);
}

function applySetCell(
  store: NormalizedRecordStore,
  builder: TransactionMutationBuilder,
  command: SetCellCommand,
): void {
  applyCellPatch(store, builder, asObjectId(String(command.objectId)), asCellId(String(command.cellId)), command.patch);
}

function applySetRange(
  store: NormalizedRecordStore,
  builder: TransactionMutationBuilder,
  command: SetRangeCommand,
): void {
  command.changes.forEach((change) => {
    applyCellPatch(store, builder, asObjectId(String(command.objectId)), asCellId(String(change.cellId)), change.patch);
  });
}

function applyUpdateObject(
  store: NormalizedRecordStore,
  builder: TransactionMutationBuilder,
  command: UpdateObjectCommand,
): void {
  const objectId = asObjectId(String(command.objectId));
  const object = store.getObject(objectId);
  if (!object) return;
  const patch = Object.prototype.hasOwnProperty.call(command.patch, "iconEmoji")
    ? { ...command.patch, iconEmoji: normalizeIconEmoji(command.patch.iconEmoji) }
    : command.patch;
  builder.replaceObject(objectId, { ...object, ...patch } as WorkspaceObject);
}

function numericTargets(command: ResizeAxisCommand): number[] {
  const targets = command.targets.length ? command.targets : Object.keys(command.sizes).map(Number);
  return unique(targets.filter((target) => Number.isInteger(target) && target >= 0));
}

function applyResizeAxis(
  store: NormalizedRecordStore,
  builder: TransactionMutationBuilder,
  command: ResizeAxisCommand,
): void {
  const objectId = asObjectId(String(command.objectId));
  const object = store.getObject(objectId);
  if (object?.type !== "sheet") return;
  const sizes = command.axis === "row" ? { ...(object.rowHeights || {}) } : { ...(object.columnWidths || {}) };
  numericTargets(command).forEach((target) => {
    const value = command.sizes[String(target)];
    if (Number.isFinite(Number(value))) sizes[String(target)] = Number(value);
  });
  const next = command.axis === "row" ? { ...object, rowHeights: sizes } : { ...object, columnWidths: sizes };
  builder.replaceObject(objectId, next);
}

function reorderAxisSizes(
  sizes: Record<string, number>,
  indexMap: ReadonlyMap<number, number>,
): Record<string, number> {
  const next: Record<string, number> = {};
  Object.entries(sizes || {}).forEach(([key, value]) => {
    const reordered = indexMap.get(Number(key));
    if (Number.isInteger(reordered)) next[String(reordered)] = value;
  });
  return next;
}

function reorderSheetAxis(object: SheetObject, axis: AxisName, from: number, to: number): SheetObject {
  const length = axis === "row" ? object.rows : object.columns;
  if (from === to || from < 0 || to < 0 || from >= length || to >= length) return object;
  const order = Array.from({ length }, (_, index) => index);
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved);
  const indexMap = new Map(order.map((original, next) => [original, next]));
  const cells: Record<string, CellRecord> = {};
  Object.values(object.cells || {}).forEach((cell) => {
    const rowValue = axis === "row" ? indexMap.get(cell.row) : cell.row;
    const columnValue = axis === "column" ? indexMap.get(cell.column) : cell.column;
    if (!Number.isInteger(rowValue) || !Number.isInteger(columnValue)) return;
    const row = rowValue as number;
    const column = columnValue as number;
    const movedCell = {
      ...cell,
      id: cellId(row, column),
      address: cellAddress(row, column),
      row,
      column,
      formula: reorderFormulaForAxis(cell.formula, axis, indexMap),
    } as CellRecord;
    cells[movedCell.id] = movedCell;
  });
  return {
    ...object,
    cells,
    rowHeights: axis === "row" ? reorderAxisSizes(object.rowHeights, indexMap) : object.rowHeights,
    columnWidths: axis === "column" ? reorderAxisSizes(object.columnWidths, indexMap) : object.columnWidths,
    filters:
      axis === "column"
        ? (object.filters || []).map((filter) => ({ ...filter, column: indexMap.get(filter.column) ?? filter.column }))
        : object.filters,
    conditionalFormats: (object.conditionalFormats || []).map((rule) => ({
      ...rule,
      range: reorderFormulaForAxis(`=${rule.range}`, axis, indexMap).slice(1),
    })),
  };
}

function shiftAxisSizes(
  sizes: Record<string, number>,
  index: number,
  operation: "insert" | "delete",
): Record<string, number> {
  const next: Record<string, number> = {};
  Object.entries(sizes || {}).forEach(([key, value]) => {
    const current = Number(key);
    if (!Number.isInteger(current) || (operation === "delete" && current === index)) return;
    const shifted =
      operation === "insert" && current >= index
        ? current + 1
        : operation === "delete" && current > index
          ? current - 1
          : current;
    next[String(shifted)] = value;
  });
  return next;
}

function remapCells(
  object: SheetObject,
  axis: AxisName,
  index: number,
  operation: "insert" | "delete",
): Record<string, CellRecord> {
  const cells: Record<string, CellRecord> = {};
  Object.values(object.cells || {}).forEach((cell) => {
    if (
      operation === "delete" &&
      ((axis === "row" && cell.row === index) || (axis === "column" && cell.column === index))
    )
      return;
    const row =
      axis === "row"
        ? operation === "insert" && cell.row >= index
          ? cell.row + 1
          : operation === "delete" && cell.row > index
            ? cell.row - 1
            : cell.row
        : cell.row;
    const column =
      axis === "column"
        ? operation === "insert" && cell.column >= index
          ? cell.column + 1
          : operation === "delete" && cell.column > index
            ? cell.column - 1
            : cell.column
        : cell.column;
    const movedCell = {
      ...cell,
      id: cellId(row, column),
      address: cellAddress(row, column),
      row,
      column,
      formula: adjustFormulaForAxis(cell.formula, axis, index, operation),
    } as CellRecord;
    cells[movedCell.id] = movedCell;
  });
  return cells;
}

function applyAxisInsert(
  store: NormalizedRecordStore,
  builder: TransactionMutationBuilder,
  command: InsertAxisCommand,
): void {
  const objectId = asObjectId(String(command.objectId));
  const object = store.getObject(objectId);
  if (object?.type !== "sheet") return;
  const index = Math.max(0, Math.trunc(command.index));
  const next = {
    ...object,
    rows: command.axis === "row" ? Math.max(256, object.rows + 1) : object.rows,
    columns: command.axis === "column" ? Math.max(64, object.columns + 1) : object.columns,
    cells: remapCells(object, command.axis, index, "insert"),
    rowHeights: command.axis === "row" ? shiftAxisSizes(object.rowHeights, index, "insert") : object.rowHeights,
    columnWidths:
      command.axis === "column" ? shiftAxisSizes(object.columnWidths, index, "insert") : object.columnWidths,
    rowGroups: command.axis === "row" ? adjustAxisGroups(object.rowGroups, index, "insert") : object.rowGroups,
    columnGroups:
      command.axis === "column" ? adjustAxisGroups(object.columnGroups, index, "insert") : object.columnGroups,
    filters: command.axis === "column" ? adjustColumnFilters(object.filters, index, "insert") : object.filters,
    conditionalFormats: adjustConditionalFormats(object.conditionalFormats, command.axis, index, "insert"),
  };
  builder.replaceObject(objectId, next);
}

function applyAxisDelete(
  store: NormalizedRecordStore,
  builder: TransactionMutationBuilder,
  command: DeleteAxisCommand,
): void {
  const objectId = asObjectId(String(command.objectId));
  const object = store.getObject(objectId);
  if (object?.type !== "sheet") return;
  const index = Math.max(0, Math.trunc(command.index));
  const next = {
    ...object,
    rows: command.axis === "row" ? Math.max(256, object.rows - 1) : object.rows,
    columns: command.axis === "column" ? Math.max(64, object.columns - 1) : object.columns,
    cells: remapCells(object, command.axis, index, "delete"),
    rowHeights: command.axis === "row" ? shiftAxisSizes(object.rowHeights, index, "delete") : object.rowHeights,
    columnWidths:
      command.axis === "column" ? shiftAxisSizes(object.columnWidths, index, "delete") : object.columnWidths,
    rowGroups: command.axis === "row" ? adjustAxisGroups(object.rowGroups, index, "delete") : object.rowGroups,
    columnGroups:
      command.axis === "column" ? adjustAxisGroups(object.columnGroups, index, "delete") : object.columnGroups,
    filters: command.axis === "column" ? adjustColumnFilters(object.filters, index, "delete") : object.filters,
    conditionalFormats: adjustConditionalFormats(object.conditionalFormats, command.axis, index, "delete"),
  };
  builder.replaceObject(objectId, next);
}

function applyAxisMove(
  store: NormalizedRecordStore,
  builder: TransactionMutationBuilder,
  command: MoveAxisCommand,
): void {
  const objectId = asObjectId(String(command.objectId));
  const object = store.getObject(objectId);
  if (object?.type !== "sheet") return;
  builder.replaceObject(objectId, reorderSheetAxis(object, command.axis, command.from, command.to));
}

function applyEmbeddedObject(
  store: NormalizedRecordStore,
  builder: TransactionMutationBuilder,
  command: CreateEmbeddedObjectCommand & { linkId?: string },
): void {
  const parentObjectId = asObjectId(String(command.parentObjectId));
  const parent = store.getObject(parentObjectId);
  const coordinates = coordinatesFromCellId(command.parentCellId);
  if (parent?.type !== "sheet" || !coordinates) return;
  const requestedObjectId = command.objectId ? String(command.objectId) : undefined;
  if (requestedObjectId && store.getObject(asObjectId(requestedObjectId))) return;
  const created = createObjectForType(command.objectType, {
    id: requestedObjectId,
    title: command.title,
  });
  const objectId = asObjectId(String(created.id));
  const linkId = asEmbedLinkId(command.linkId || `link-${String(objectId)}`);
  const sourceCellId = asCellId(String(command.parentCellId));
  const sourceAddress = cellAddress(coordinates.row, coordinates.column);
  const child = {
    ...created,
    parent: {
      linkId,
      parentObjectId,
      parentCellId: sourceCellId,
      sourceAddress,
    },
  } as WorkspaceObject;
  const current = store.getCell(parentObjectId, sourceCellId);
  const cell = createCellRecord(coordinates.row, coordinates.column, {
    ...(current || {}),
    value: child.title,
    formula: "",
    embed: {
      objectId,
      type: child.type,
      linkId,
      relation: "containment",
    },
  });
  builder.replaceCell(parentObjectId, sourceCellId, cell);
  builder.replaceObject(objectId, child);
}

function applyAsset(
  store: NormalizedRecordStore,
  builder: TransactionMutationBuilder,
  command: ReplaceAssetCommand,
): void {
  const asset = {
    ...command.asset,
    id: command.assetId,
    ...(command.data ? { data: cloneValue(command.data) } : {}),
  } as AssetRecord;
  builder.replaceAsset(String(command.assetId), asset);
  const object = store.getObject(command.objectId);
  if (object && object.type !== "sheet" && "assetId" in object && object.assetId !== command.assetId) {
    builder.replaceObject(command.objectId, { ...object, assetId: command.assetId });
  }
}

function applyFormatting(
  store: NormalizedRecordStore,
  builder: TransactionMutationBuilder,
  command: ApplyFormattingCommand,
): void {
  const objectId = asObjectId(String(command.objectId));
  const object = store.getObject(objectId);
  if (object?.type !== "sheet") return;
  const ids = "cellIds" in command ? command.cellIds : command.range ? cellIdsInRange(command.range) : [];
  ids.forEach((cellIdValue) => {
    const cellId = asCellId(String(cellIdValue));
    const cell = store.getCell(objectId, cellId);
    const coordinates = coordinatesFromCellId(cellId);
    if (!coordinates) return;
    const style = { ...(cell?.style || {}), ...command.patch };
    const next = createCellRecord(coordinates.row, coordinates.column, {
      ...(cell || {}),
      style,
    });
    builder.replaceCell(objectId, cellId, next);
  });
}

function applyTheme(
  store: NormalizedRecordStore,
  builder: TransactionMutationBuilder,
  command: UpdateThemeCommand,
): void {
  const theme = store.getTheme(command.themeId);
  if (!theme) return;
  const next = {
    ...theme,
    ...command.patch,
    tokens: command.patch.tokens ? { ...theme.tokens, ...command.patch.tokens } : theme.tokens,
  };
  builder.replaceTheme(String(command.themeId), next);
}

export function executeWorkspaceCommand(
  store: NormalizedRecordStore,
  command: DispatchableWorkspaceCommand,
  options: ExecuteCommandOptions = {},
): TransactionMutationBuilder {
  const builder = options.builder || new TransactionMutationBuilder(store);
  switch (command.type) {
    case "set-cell":
      applySetCell(store, builder, command);
      break;
    case "set-range":
      applySetRange(store, builder, command);
      break;
    case "update-object":
      applyUpdateObject(store, builder, command);
      break;
    case "resize-axis":
      applyResizeAxis(store, builder, command);
      break;
    case "move-axis":
      applyAxisMove(store, builder, command);
      break;
    case "insert-axis":
      applyAxisInsert(store, builder, command);
      break;
    case "delete-axis":
      applyAxisDelete(store, builder, command);
      break;
    case "create-embedded-object":
      applyEmbeddedObject(store, builder, command);
      break;
    case "replace-asset":
      applyAsset(store, builder, command);
      break;
    case "apply-formatting":
      applyFormatting(store, builder, command);
      break;
    case "update-theme":
      applyTheme(store, builder, command);
      break;
    default:
      throw new Error(`Unsupported workspace command ${(command as { type: string }).type}.`);
  }
  if (options.touchMeta !== false && builder.hasChanges()) builder.touchMeta(timestampFor(command, options.timestamp));
  return builder;
}

function formulaReferences(formula: string, address: string): boolean {
  if (!formula) return false;
  const escaped = address.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\$/g, "\\$&");
  return new RegExp(`(?:^|[^A-Z0-9_])\\$?${escaped}\\b`, "i").test(formula);
}

export function effectsFromOperations(
  store: NormalizedRecordStore,
  operations: readonly WorkspacePatchOperation[],
): CommandEffects {
  const changedObjectIds: ObjectId[] = [];
  const changedCellIds: CellId[] = [];
  const invalidatedFormulaIds: CellId[] = [];
  operations.forEach((operation) => {
    if (operation.kind === "replace-object") changedObjectIds.push(operation.objectId);
    if (operation.kind !== "replace-cell") return;
    changedObjectIds.push(operation.objectId);
    changedCellIds.push(operation.cellId);
    const address = operation.after?.address || operation.before?.address;
    const sheet = store.getSheet(operation.objectId);
    if (!sheet) return;
    sheet.cells.forEach((cell) => {
      if (cell.id === operation.cellId || formulaReferences(cell.formula, String(address))) {
        invalidatedFormulaIds.push(cell.id);
      }
    });
  });
  return {
    operations: operations.slice(),
    changedObjectIds: unique(changedObjectIds),
    changedCellIds: unique(changedCellIds),
    invalidatedFormulaIds: unique(invalidatedFormulaIds),
  };
}

export function dirtyRecordsForOperations(
  operations: readonly WorkspacePatchOperation[],
  reason: DirtyReason,
): DirtyRecord[] {
  const records = new Map<string, DirtyRecord>();
  operations.forEach((operation) => {
    let record: DirtyRecord | null = null;
    switch (operation.kind) {
      case "replace-workspace-meta":
        record = { recordType: "workspace", recordId: String(operation.after.id || operation.before.id), reason };
        break;
      case "replace-object":
        record = { recordType: "object", recordId: String(operation.objectId), reason };
        break;
      case "replace-cell":
        record = {
          recordType: "cell",
          recordId: String(operation.cellId),
          objectId: operation.objectId,
          reason,
        };
        break;
      case "replace-asset":
        record = { recordType: "asset", recordId: String(operation.assetId), reason };
        break;
      case "replace-theme":
        record = { recordType: "theme", recordId: String(operation.themeId), reason };
        break;
      default:
        return;
    }
    if (!record) return;
    records.set(`${record.recordType}:${record.objectId || ""}:${record.recordId}`, record);
  });
  return [...records.values()];
}
