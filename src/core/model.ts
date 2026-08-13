import {
  DEFAULT_COLUMNS as runtimeDefaultColumns,
  DEFAULT_ROWS as runtimeDefaultRows,
  WORKSPACE_VERSION as runtimeWorkspaceVersion,
  createBlankWorkspace as createBlankWorkspaceRuntime,
  createCellRecord as createCellRecordRuntime,
  createEmbeddedObject as createEmbeddedObjectRuntime,
  createObjectForType as createObjectForTypeRuntime,
  createSheetObject as createSheetObjectRuntime,
  generatedObjectTitle as generatedObjectTitleRuntime,
  inferFileObjectType as inferFileObjectTypeRuntime,
  isCellUsed as isCellUsedRuntime,
  materializeCell as materializeCellRuntime,
  normalizeCell as normalizeCellRuntime,
  normalizeIconEmoji as normalizeIconEmojiRuntime,
  normalizeWorkspace as normalizeWorkspaceRuntime,
  usedSheetBounds as usedSheetBoundsRuntime,
} from "../model.js";
import type { CellPatch, CellRecord, SheetObject, WorkspaceObject, WorkspaceSnapshot } from "./domain.ts";
import { asCellId, asObjectId, asObjectTypeKey, asRowIndex, asColumnIndex } from "./ids.ts";
import type { CellId, ColumnIndex, ObjectTypeKey, RowIndex } from "./ids.ts";

export const WORKSPACE_VERSION: number = runtimeWorkspaceVersion;
export const DEFAULT_ROWS: number = runtimeDefaultRows;
export const DEFAULT_COLUMNS: number = runtimeDefaultColumns;

export interface CreateObjectOptions {
  id?: string;
  title?: string;
  description?: string;
  content?: string;
  assetId?: string | null;
  source?: string;
  parent?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface CreateSheetOptions extends CreateObjectOptions {
  rows?: number;
  columns?: number;
  cells?: Record<string, CellRecord>;
  rowHeight?: number;
  columnWidth?: number;
  rowHeights?: Record<string, number>;
  columnWidths?: Record<string, number>;
}

export function createBlankWorkspace(options: { id?: string; name?: string } = {}): WorkspaceSnapshot {
  return createBlankWorkspaceRuntime(options) as unknown as WorkspaceSnapshot;
}

export function createCellRecord(
  row: RowIndex | number,
  column: ColumnIndex | number,
  patch: CellPatch = {},
): CellRecord {
  return createCellRecordRuntime(Number(row), Number(column), patch) as CellRecord;
}

export function materializeCell(sheet: SheetObject | undefined, row: number, column: number): CellRecord {
  return materializeCellRuntime(sheet, row, column) as CellRecord;
}

export function isCellUsed(cell: CellRecord | null | undefined): boolean {
  return Boolean(isCellUsedRuntime(cell));
}

export function normalizeCell(cell: unknown, fallbackId: string): CellRecord | null {
  return normalizeCellRuntime(cell, fallbackId) as CellRecord | null;
}

export function normalizeIconEmoji(value: unknown): string {
  return normalizeIconEmojiRuntime(value);
}

export function createSheetObject(options: CreateSheetOptions = {}): SheetObject {
  return createSheetObjectRuntime(
    options as unknown as Parameters<typeof createSheetObjectRuntime>[0],
  ) as unknown as SheetObject;
}

export function createObjectForType(type: ObjectTypeKey, options: CreateObjectOptions = {}): WorkspaceObject {
  return createObjectForTypeRuntime(type, options) as WorkspaceObject;
}

export function generatedObjectTitle(type: ObjectTypeKey, address = ""): string {
  return generatedObjectTitleRuntime(type, address);
}

export function inferFileObjectType(file: unknown): ObjectTypeKey {
  return asObjectTypeKey(inferFileObjectTypeRuntime(file));
}

export function normalizeWorkspace(input: unknown): WorkspaceSnapshot {
  return normalizeWorkspaceRuntime(input) as WorkspaceSnapshot;
}

export function createEmbeddedObject(
  workspace: WorkspaceSnapshot,
  input: { parentObjectId: string; parentCellId: string; type: ObjectTypeKey },
): { workspace: WorkspaceSnapshot; object: WorkspaceObject | null } {
  const result = createEmbeddedObjectRuntime(workspace, input);
  return result as { workspace: WorkspaceSnapshot; object: WorkspaceObject | null };
}

export function usedSheetBounds(sheet: SheetObject): { rows: number; columns: number } {
  return usedSheetBoundsRuntime(sheet);
}

export function toCoreCellId(value: string): CellId {
  return asCellId(value);
}

export function toCoreObjectId(value: string) {
  return asObjectId(value);
}

export function toCoreRowIndex(value: number): RowIndex {
  return asRowIndex(value);
}

export function toCoreColumnIndex(value: number): ColumnIndex {
  return asColumnIndex(value);
}
