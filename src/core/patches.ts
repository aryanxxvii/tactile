import type { AssetRecord, CellRecord, ThemeRecord, WorkspaceMeta, WorkspaceObject } from "./domain.ts";
import type { AssetId, CellId, ObjectId, PatchId, RevisionId, ThemeId } from "./ids.ts";

export type DirtyRecordType = "workspace" | "object" | "cell" | "asset" | "theme";
export type DirtyReason = "command" | "undo" | "redo" | "import" | "migration" | "recovery";

export interface DirtyRecord {
  recordType: DirtyRecordType;
  recordId: string;
  objectId?: ObjectId;
  reason: DirtyReason;
}

export interface ReplaceWorkspaceMetaOperation {
  kind: "replace-workspace-meta";
  before: WorkspaceMeta;
  after: WorkspaceMeta;
}

export interface ReplaceObjectOperation {
  kind: "replace-object";
  objectId: ObjectId;
  before: WorkspaceObject | null;
  after: WorkspaceObject | null;
}

export interface ReplaceCellOperation {
  kind: "replace-cell";
  objectId: ObjectId;
  cellId: CellId;
  before: CellRecord | null;
  after: CellRecord | null;
}

export interface ReplaceAssetOperation {
  kind: "replace-asset";
  assetId: AssetId;
  before: AssetRecord | null;
  after: AssetRecord | null;
}

export interface ReplaceThemeOperation {
  kind: "replace-theme";
  themeId: ThemeId;
  before: ThemeRecord | null;
  after: ThemeRecord | null;
}

export type WorkspacePatchOperation =
  | ReplaceWorkspaceMetaOperation
  | ReplaceObjectOperation
  | ReplaceCellOperation
  | ReplaceAssetOperation
  | ReplaceThemeOperation;

export interface WorkspacePatch {
  id: PatchId;
  baseRevision: RevisionId;
  targetRevision: RevisionId;
  operations: readonly WorkspacePatchOperation[];
}

export interface TransactionResult {
  revision: RevisionId;
  changedObjectIds: ObjectId[];
  changedCellIds: CellId[];
  invalidatedFormulaIds: CellId[];
  forwardPatch: WorkspacePatch;
  inversePatch: WorkspacePatch;
  dirtyRecords: DirtyRecord[];
}
