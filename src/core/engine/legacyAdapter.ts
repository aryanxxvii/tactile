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
} from "../commands.ts";
import type { CellRecord, SheetObject, WorkspaceObject, WorkspaceSnapshot } from "../domain.ts";
import type { CellId } from "../ids.ts";
import { asCellId, asEmbedLinkId, asObjectId } from "../ids.ts";
import { cellAddress, cellId, coordinatesFromCellId } from "../coordinates.ts";
import { cellIdsInRange } from "../ranges.ts";
import { createCellRecord, createObjectForType, isCellUsed, normalizeIconEmoji, normalizeWorkspace } from "../model.ts";
import {
  adjustAxisGroups,
  adjustColumnFilters,
  adjustConditionalFormats,
  adjustFormulaForAxis,
  reorderFormulaForAxis,
} from "../structure.ts";
import { repairWorkspaceTopology } from "../topology.js";
import { cloneValue, deepEqual } from "./clone.ts";
import type { DispatchableWorkspaceCommand } from "../commands/types.ts";
import type { TransactionEngine } from "./transactionEngine.ts";

export interface LegacyWorkspaceAdapter {
  getSnapshot(): WorkspaceSnapshot;
  dispatch(command: DispatchableWorkspaceCommand): void | Promise<void>;
}

export interface LegacyHookAdapterOptions {
  getSnapshot: () => WorkspaceSnapshot;
  dispatch: (command: DispatchableWorkspaceCommand) => void | Promise<void>;
}

export function createLegacyHookAdapter(options: LegacyHookAdapterOptions): LegacyWorkspaceAdapter {
  return {
    getSnapshot: options.getSnapshot,
    dispatch: options.dispatch,
  };
}

function touch(
  workspace: WorkspaceSnapshot,
  objects: Record<string, WorkspaceObject>,
  command: DispatchableWorkspaceCommand,
  repair = false,
): WorkspaceSnapshot {
  const next = {
    ...workspace,
    updatedAt: String(command.issuedAt || workspace.updatedAt),
    objects,
  } as WorkspaceSnapshot;
  return repair ? repairWorkspaceTopology(next) : next;
}

function setCell(workspace: WorkspaceSnapshot, command: SetCellCommand): WorkspaceSnapshot {
  const object = workspace.objects[String(command.objectId)];
  const coordinates = coordinatesFromCellId(command.cellId);
  if (object?.type !== "sheet" || !coordinates) return workspace;
  const current = object.cells[String(command.cellId)];
  const cell = createCellRecord(coordinates.row, coordinates.column, {
    ...(current || {}),
    ...command.patch,
  });
  const nextCell = isCellUsed(cell) ? cell : null;
  if (deepEqual(current || null, nextCell)) return workspace;
  const cells = { ...object.cells };
  if (nextCell) cells[String(command.cellId)] = nextCell;
  else delete cells[String(command.cellId)];
  return touch(
    workspace,
    {
      ...workspace.objects,
      [object.id]: { ...object, cells },
    },
    command,
    Object.prototype.hasOwnProperty.call(command.patch, "embed"),
  );
}

function setRange(workspace: WorkspaceSnapshot, command: SetRangeCommand): WorkspaceSnapshot {
  let current = workspace;
  command.changes.forEach((change) => {
    current = setCell(current, { ...command, type: "set-cell", cellId: change.cellId, patch: change.patch });
  });
  return current;
}

function updateObject(workspace: WorkspaceSnapshot, command: UpdateObjectCommand): WorkspaceSnapshot {
  const object = workspace.objects[String(command.objectId)];
  if (!object) return workspace;
  const patch = Object.prototype.hasOwnProperty.call(command.patch, "iconEmoji")
    ? { ...command.patch, iconEmoji: normalizeIconEmoji(command.patch.iconEmoji) }
    : command.patch;
  const nextObject = { ...object, ...patch } as WorkspaceObject;
  if (deepEqual(object, nextObject)) return workspace;
  return touch(
    workspace,
    {
      ...workspace.objects,
      [object.id]: nextObject,
    },
    command,
  );
}

function resizeAxis(workspace: WorkspaceSnapshot, command: ResizeAxisCommand): WorkspaceSnapshot {
  const object = workspace.objects[String(command.objectId)];
  if (object?.type !== "sheet") return workspace;
  const sizes = command.axis === "row" ? { ...(object.rowHeights || {}) } : { ...(object.columnWidths || {}) };
  const targets = command.targets.length ? command.targets : Object.keys(command.sizes).map(Number);
  targets.forEach((target) => {
    const value = command.sizes[String(target)];
    if (Number.isFinite(Number(value))) sizes[String(target)] = Number(value);
  });
  const nextObject = command.axis === "row" ? { ...object, rowHeights: sizes } : { ...object, columnWidths: sizes };
  if (deepEqual(object, nextObject)) return workspace;
  return touch(
    workspace,
    {
      ...workspace.objects,
      [object.id]: nextObject,
    },
    command,
  );
}

function reorderAxisSizes(
  sizes: Record<string, number>,
  indexMap: ReadonlyMap<number, number>,
): Record<string, number> {
  const next: Record<string, number> = {};
  Object.entries(sizes || {}).forEach(([key, value]) => {
    const index = indexMap.get(Number(key));
    if (Number.isInteger(index)) next[String(index)] = value;
  });
  return next;
}

function reorderSheet(object: SheetObject, axis: "row" | "column", from: number, to: number): SheetObject {
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
    const next = {
      ...cell,
      id: cellId(row, column),
      address: cellAddress(row, column),
      row,
      column,
      formula: reorderFormulaForAxis(cell.formula, axis, indexMap),
    } as CellRecord;
    cells[next.id] = next;
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

function shiftSizes(
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
  axis: "row" | "column",
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
    const next = {
      ...cell,
      id: cellId(row, column),
      address: cellAddress(row, column),
      row,
      column,
      formula: adjustFormulaForAxis(cell.formula, axis, index, operation),
    } as CellRecord;
    cells[next.id] = next;
  });
  return cells;
}

function axisInsert(workspace: WorkspaceSnapshot, command: InsertAxisCommand): WorkspaceSnapshot {
  const object = workspace.objects[String(command.objectId)];
  if (object?.type !== "sheet") return workspace;
  const index = Math.max(0, Math.trunc(command.index));
  const next = {
    ...object,
    rows: command.axis === "row" ? Math.max(256, object.rows + 1) : object.rows,
    columns: command.axis === "column" ? Math.max(64, object.columns + 1) : object.columns,
    cells: remapCells(object, command.axis, index, "insert"),
    rowHeights: command.axis === "row" ? shiftSizes(object.rowHeights, index, "insert") : object.rowHeights,
    columnWidths: command.axis === "column" ? shiftSizes(object.columnWidths, index, "insert") : object.columnWidths,
    rowGroups: command.axis === "row" ? adjustAxisGroups(object.rowGroups, index, "insert") : object.rowGroups,
    columnGroups:
      command.axis === "column" ? adjustAxisGroups(object.columnGroups, index, "insert") : object.columnGroups,
    filters: command.axis === "column" ? adjustColumnFilters(object.filters, index, "insert") : object.filters,
    conditionalFormats: adjustConditionalFormats(object.conditionalFormats, command.axis, index, "insert"),
  };
  if (deepEqual(object, next)) return workspace;
  return touch(workspace, { ...workspace.objects, [object.id]: next }, command);
}

function axisDelete(workspace: WorkspaceSnapshot, command: DeleteAxisCommand): WorkspaceSnapshot {
  const object = workspace.objects[String(command.objectId)];
  if (object?.type !== "sheet") return workspace;
  const index = Math.max(0, Math.trunc(command.index));
  const next = {
    ...object,
    rows: command.axis === "row" ? Math.max(256, object.rows - 1) : object.rows,
    columns: command.axis === "column" ? Math.max(64, object.columns - 1) : object.columns,
    cells: remapCells(object, command.axis, index, "delete"),
    rowHeights: command.axis === "row" ? shiftSizes(object.rowHeights, index, "delete") : object.rowHeights,
    columnWidths: command.axis === "column" ? shiftSizes(object.columnWidths, index, "delete") : object.columnWidths,
    rowGroups: command.axis === "row" ? adjustAxisGroups(object.rowGroups, index, "delete") : object.rowGroups,
    columnGroups:
      command.axis === "column" ? adjustAxisGroups(object.columnGroups, index, "delete") : object.columnGroups,
    filters: command.axis === "column" ? adjustColumnFilters(object.filters, index, "delete") : object.filters,
    conditionalFormats: adjustConditionalFormats(object.conditionalFormats, command.axis, index, "delete"),
  };
  if (deepEqual(object, next)) return workspace;
  return touch(workspace, { ...workspace.objects, [object.id]: next }, command);
}

function axisMove(workspace: WorkspaceSnapshot, command: MoveAxisCommand): WorkspaceSnapshot {
  const object = workspace.objects[String(command.objectId)];
  if (object?.type !== "sheet") return workspace;
  const nextObject = reorderSheet(object, command.axis, command.from, command.to);
  if (deepEqual(object, nextObject)) return workspace;
  return touch(
    workspace,
    {
      ...workspace.objects,
      [object.id]: nextObject,
    },
    command,
  );
}

function createEmbedded(
  workspace: WorkspaceSnapshot,
  command: CreateEmbeddedObjectCommand & { linkId?: string },
): WorkspaceSnapshot {
  const parent = workspace.objects[String(command.parentObjectId)];
  const coordinates = coordinatesFromCellId(command.parentCellId);
  if (parent?.type !== "sheet" || !coordinates) return workspace;
  if (command.objectId && workspace.objects[String(command.objectId)]) return workspace;
  const created = createObjectForType(command.objectType, {
    id: command.objectId,
    title: command.title,
  });
  const objectId = asObjectId(String(created.id));
  const linkId = asEmbedLinkId(command.linkId || `link-${String(objectId)}`);
  const sourceCellId = asCellId(String(command.parentCellId));
  const sourceAddress = cellAddress(coordinates.row, coordinates.column);
  const child = {
    ...created,
    parent: { linkId, parentObjectId: parent.id, parentCellId: sourceCellId, sourceAddress },
  } as WorkspaceObject;
  const cell = createCellRecord(coordinates.row, coordinates.column, {
    ...(parent.cells[String(sourceCellId)] || {}),
    value: child.title,
    formula: "",
    embed: { objectId, type: child.type, linkId, relation: "containment" },
  });
  return touch(
    workspace,
    {
      ...workspace.objects,
      [parent.id]: { ...parent, cells: { ...parent.cells, [sourceCellId]: cell } },
      [objectId]: child,
    },
    command,
    true,
  );
}

function replaceAsset(workspace: WorkspaceSnapshot, command: ReplaceAssetCommand): WorkspaceSnapshot {
  const asset = {
    ...command.asset,
    id: command.assetId,
    ...(command.data ? { data: cloneValue(command.data) } : {}),
  };
  const object = workspace.objects[String(command.objectId)];
  const existingAsset = workspace.assets[String(command.assetId)] || null;
  const objects =
    object && object.type !== "sheet" && "assetId" in object
      ? { ...workspace.objects, [object.id]: { ...object, assetId: command.assetId } as WorkspaceObject }
      : workspace.objects;
  const nextObject = object && object.type !== "sheet" && "assetId" in object ? objects[object.id] : object;
  if (deepEqual(existingAsset, asset) && deepEqual(object || null, nextObject || null)) return workspace;
  return touch({ ...workspace, assets: { ...workspace.assets, [String(command.assetId)]: asset } }, objects, command);
}

function applyFormatting(workspace: WorkspaceSnapshot, command: ApplyFormattingCommand): WorkspaceSnapshot {
  const object = workspace.objects[String(command.objectId)];
  if (object?.type !== "sheet") return workspace;
  const ids = "cellIds" in command ? command.cellIds : command.range ? cellIdsInRange(command.range) : [];
  const cells = { ...object.cells };
  let changed = false;
  ids.forEach((cellIdValue) => {
    const target = asCellId(String(cellIdValue));
    const coordinates = coordinatesFromCellId(target);
    if (!coordinates) return;
    const current = cells[String(target)];
    const nextCell = createCellRecord(coordinates.row, coordinates.column, {
      ...(current || {}),
      style: { ...(current?.style || {}), ...command.patch },
    });
    if (deepEqual(current || null, nextCell)) return;
    cells[String(target)] = nextCell;
    changed = true;
  });
  if (!changed) return workspace;
  return touch(workspace, { ...workspace.objects, [object.id]: { ...object, cells } }, command);
}

function updateTheme(workspace: WorkspaceSnapshot, command: UpdateThemeCommand): WorkspaceSnapshot {
  const theme = workspace.themes[String(command.themeId)];
  if (!theme) return workspace;
  const next = {
    ...theme,
    ...command.patch,
    tokens: command.patch.tokens ? { ...theme.tokens, ...command.patch.tokens } : theme.tokens,
  };
  if (deepEqual(theme, next)) return workspace;
  return touch(
    { ...workspace, themes: { ...workspace.themes, [String(command.themeId)]: next } },
    workspace.objects,
    command,
  );
}

/** A deliberately simple immutable reference implementation used for shadow tests. */
export function applyLegacyCommand(
  snapshot: WorkspaceSnapshot,
  command: DispatchableWorkspaceCommand,
): WorkspaceSnapshot {
  const workspace = normalizeWorkspace(snapshot);
  switch (command.type) {
    case "set-cell":
      return setCell(workspace, command);
    case "set-range":
      return setRange(workspace, command);
    case "update-object":
      return updateObject(workspace, command);
    case "resize-axis":
      return resizeAxis(workspace, command);
    case "move-axis":
      return axisMove(workspace, command);
    case "insert-axis":
      return axisInsert(workspace, command);
    case "delete-axis":
      return axisDelete(workspace, command);
    case "create-embedded-object":
      return createEmbedded(workspace, command);
    case "replace-asset":
      return replaceAsset(workspace, command);
    case "apply-formatting":
      return applyFormatting(workspace, command);
    case "update-theme":
      return updateTheme(workspace, command);
    default:
      throw new Error(`Unsupported legacy workspace command ${(command as { type: string }).type}.`);
  }
}

export function createLegacySnapshotAdapter(initial: WorkspaceSnapshot): LegacyWorkspaceAdapter {
  let snapshot = normalizeWorkspace(initial);
  return {
    getSnapshot: () => snapshot,
    dispatch: (command) => {
      snapshot = applyLegacyCommand(snapshot, command);
    },
  };
}

export interface DifferentialComparison {
  equal: boolean;
  expected: WorkspaceSnapshot;
  actual: WorkspaceSnapshot;
  firstDifference?: string;
}

function firstDifference(left: unknown, right: unknown, path = "workspace"): string | undefined {
  if (deepEqual(left, right)) return undefined;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return path;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return path;
    for (let index = 0; index < left.length; index += 1) {
      const difference = firstDifference(left[index], right[index], `${path}[${index}]`);
      if (difference) return difference;
    }
    return path;
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const keys = new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)]);
  for (const key of keys) {
    if (!(key in leftRecord) || !(key in rightRecord)) return `${path}.${key}`;
    const difference = firstDifference(leftRecord[key], rightRecord[key], `${path}.${key}`);
    if (difference) return difference;
  }
  return path;
}

export function compareEngineSnapshots(expected: WorkspaceSnapshot, actual: WorkspaceSnapshot): DifferentialComparison {
  const normalizedExpected = normalizeWorkspace(expected);
  const normalizedActual = normalizeWorkspace(actual);
  const difference = firstDifference(normalizedExpected, normalizedActual);
  return {
    equal: !difference,
    expected: normalizedExpected,
    actual: normalizedActual,
    ...(difference ? { firstDifference: difference } : {}),
  };
}

export interface DifferentialStep extends DifferentialComparison {
  index: number;
  command: DispatchableWorkspaceCommand;
}

export interface DifferentialRun {
  equal: boolean;
  steps: DifferentialStep[];
  final: DifferentialComparison;
}

export async function runDifferentialSequence(
  engine: TransactionEngine,
  legacy: LegacyWorkspaceAdapter,
  commands: readonly DispatchableWorkspaceCommand[],
): Promise<DifferentialRun> {
  const steps: DifferentialStep[] = [];
  for (const [index, command] of commands.entries()) {
    await engine.dispatch(command);
    await legacy.dispatch(command);
    const comparison = compareEngineSnapshots(legacy.getSnapshot(), engine.getSnapshot());
    steps.push({ index, command, ...comparison });
  }
  const final = compareEngineSnapshots(legacy.getSnapshot(), engine.getSnapshot());
  return { equal: steps.every((step) => step.equal) && final.equal, steps, final };
}

export function createDifferentialTestAdapter(engine: TransactionEngine, legacy: LegacyWorkspaceAdapter) {
  return {
    async dispatch(command: DispatchableWorkspaceCommand): Promise<DifferentialComparison> {
      await engine.dispatch(command);
      await legacy.dispatch(command);
      return compareEngineSnapshots(legacy.getSnapshot(), engine.getSnapshot());
    },
    compare(): DifferentialComparison {
      return compareEngineSnapshots(legacy.getSnapshot(), engine.getSnapshot());
    },
  };
}
