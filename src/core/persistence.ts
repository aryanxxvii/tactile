import type { AssetRecord, WorkspaceSnapshot } from "./domain.ts";
import type { AssetId, ObjectId, RevisionId, WorkspaceId } from "./ids.ts";
import type { TransactionResult } from "./patches.ts";

export interface OpenWorkspaceRequest {
  workspaceId?: WorkspaceId;
  location?: string;
}

export interface PersistedTransaction {
  revision: RevisionId;
  transaction: TransactionResult;
}

export interface PersistenceAck {
  revision: RevisionId;
  persistedAt: string;
  dirtyRecordIds: string[];
}

export type ImportSource =
  | { kind: "json"; name?: string; data: string }
  | { kind: "zip"; name?: string; data: Uint8Array };

export interface ExportRequest {
  workspaceId?: WorkspaceId;
  objectIds?: readonly ObjectId[];
  format: "json" | "zip";
}

export interface ExportResult {
  format: ExportRequest["format"];
  fileName: string;
  mime: string;
  data: string | Uint8Array;
}

export interface AssetReadRequest {
  assetId: AssetId;
}

export interface AssetHandle {
  assetId: AssetId;
  mime?: string;
  data: Uint8Array;
}

export interface AssetWriteRequest {
  record: AssetRecord;
  data: Uint8Array;
}

export interface PersistencePort {
  open(request: OpenWorkspaceRequest): Promise<WorkspaceSnapshot>;
  commit(transaction: PersistedTransaction): Promise<PersistenceAck>;
  checkpoint(revision: RevisionId): Promise<void>;
  importPortable(source: ImportSource): Promise<WorkspaceSnapshot>;
  exportPortable(request: ExportRequest): Promise<ExportResult>;
  readAsset(request: AssetReadRequest): Promise<AssetHandle>;
  writeAsset(request: AssetWriteRequest): Promise<AssetRecord>;
  close(): Promise<void>;
}
