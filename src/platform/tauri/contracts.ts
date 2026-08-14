import type { AssetRecord, CellRecord, WorkspaceMeta, WorkspaceObject, WorkspaceSnapshot } from "../../core/domain.ts";
import type { AssetId, CellId, ObjectId, PatchId, RevisionId, ThemeId, WorkspaceId } from "../../core/ids.ts";

/**
 * The command names are the only strings shared by the webview and the Rust
 * command layer.  Keeping them here makes the IPC surface reviewable without
 * pulling native implementation details into the object renderers.
 */
export const TAURI_COMMANDS = Object.freeze({
  openWorkspace: "workspace_open",
  applyDelta: "workspace_apply_delta",
  checkpoint: "workspace_checkpoint",
  importPortable: "workspace_import",
  exportPortable: "workspace_export",
  readAsset: "asset_read",
  writeAsset: "asset_write",
  closeWorkspace: "workspace_close",
  acquireAssetHandle: "asset_handle_acquire",
  releaseAssetHandle: "asset_handle_release",
  openFileDialog: "dialog_open_file",
  saveFileDialog: "dialog_save_file",
});

export type TauriCommandName = (typeof TAURI_COMMANDS)[keyof typeof TAURI_COMMANDS];

/**
 * Native storage revisions are u64 values in the Rust service and therefore
 * may arrive through JSON as numbers. The frontend keeps them as strings so
 * revision identity never depends on JavaScript number precision.
 */
export type TauriRevisionValue = RevisionId | number;

export interface TauriOpenWorkspacePayload {
  workspaceId?: WorkspaceId;
  location?: string;
}

export interface TauriOpenWorkspaceResponse {
  workspace: WorkspaceSnapshot;
  acknowledgedRevision?: TauriRevisionValue | null;
}

export interface TauriReplaceWorkspaceMetaDelta {
  kind: "replace-workspace-meta";
  after: WorkspaceMeta;
}

export interface TauriReplaceObjectDelta {
  kind: "replace-object";
  objectId: ObjectId;
  after: WorkspaceObject | null;
}

export interface TauriReplaceCellDelta {
  kind: "replace-cell";
  objectId: ObjectId;
  cellId: CellId;
  after: CellRecord | null;
}

export type TauriAssetMetadata = Omit<AssetRecord, "data" | "dataUrl" | "bytes"> & {
  [key: string]: unknown;
};

export interface TauriReplaceAssetDelta {
  kind: "replace-asset";
  assetId: AssetId;
  after: TauriAssetMetadata | null;
}

export interface TauriReplaceThemeDelta {
  kind: "replace-theme";
  themeId: ThemeId;
  after: Record<string, unknown> | null;
}

/** A forward-only patch. Inverse and before snapshots never cross IPC. */
export type TauriDeltaOperation =
  | TauriReplaceWorkspaceMetaDelta
  | TauriReplaceObjectDelta
  | TauriReplaceCellDelta
  | TauriReplaceAssetDelta
  | TauriReplaceThemeDelta;

export interface TauriDelta {
  patchId: PatchId;
  baseRevision: RevisionId;
  targetRevision: RevisionId;
  operations: readonly TauriDeltaOperation[];
}

export interface TauriCommitPayload {
  workspaceId: WorkspaceId;
  revision: RevisionId;
  delta: TauriDelta;
  dirtyRecordIds: readonly string[];
}

export interface TauriCheckpointPayload {
  workspaceId: WorkspaceId;
  revision: RevisionId;
}

export interface TauriRevisionAcknowledgement {
  revision: RevisionId;
  persistedAt: string;
  dirtyRecordIds: readonly string[];
}

export interface TauriAcknowledgementResponse {
  acknowledgement?: Omit<TauriRevisionAcknowledgement, "revision"> & { revision: TauriRevisionValue };
  acknowledgedRevision?: TauriRevisionValue;
  revision?: TauriRevisionValue;
  persistedAt?: string;
  dirtyRecordIds?: readonly string[];
  accepted?: boolean;
  stale?: boolean;
}

export interface TauriImportPayload {
  kind: "json" | "zip";
  name?: string;
  data: string | readonly number[];
}

export interface TauriExportPayload {
  workspaceId: WorkspaceId;
  objectIds?: readonly ObjectId[];
  format: "json" | "zip";
}

export interface TauriExportResponse {
  format: "json" | "zip";
  fileName: string;
  mime: string;
  data: string | readonly number[];
}

export interface TauriReadAssetPayload {
  workspaceId: WorkspaceId;
  assetId: AssetId;
}

export interface TauriWriteAssetPayload {
  workspaceId: WorkspaceId;
  record: TauriAssetMetadata;
  bytes: readonly number[];
}

export interface TauriReadAssetResponse {
  assetId?: AssetId;
  mime?: string;
  bytes: readonly number[];
  handle?: string;
}

export interface TauriAssetHandle {
  assetId: AssetId;
  handle: string;
  mime?: string;
  size?: number;
}

export interface TauriAssetHandlePayload {
  workspaceId: WorkspaceId;
  assetId: AssetId;
  handle?: string;
}

export interface TauriFileFilter {
  name: string;
  extensions: readonly string[];
}

export interface TauriOpenFileDialogPayload {
  title?: string;
  multiple?: boolean;
  directory?: boolean;
  defaultPath?: string;
  filters?: readonly TauriFileFilter[];
}

export interface TauriSaveFileDialogPayload {
  title?: string;
  defaultPath?: string;
  suggestedFileName?: string;
  filters?: readonly TauriFileFilter[];
}

export interface TauriFileDialogSelection {
  cancelled: boolean;
  paths: readonly string[];
}
