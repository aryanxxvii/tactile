import type { AssetRecord, WorkspaceSnapshot } from "../../core/domain.ts";
import type {
  AssetHandle,
  AssetReadRequest,
  AssetWriteRequest,
  ExportRequest,
  ExportResult,
  ImportSource,
  OpenWorkspaceRequest,
  PersistedTransaction,
  PersistenceAck,
  PersistencePort,
} from "../../core/persistence.ts";
import {
  asAssetId,
  asRevisionId,
  asWorkspaceId,
  type AssetId,
  type RevisionId,
  type WorkspaceId,
} from "../../core/ids.ts";
import type { WorkspacePatchOperation } from "../../core/patches.ts";
import {
  TAURI_COMMANDS,
  type TauriAssetHandle,
  type TauriCommitPayload,
  type TauriDeltaOperation,
  type TauriExportPayload,
  type TauriImportPayload,
  type TauriOpenWorkspacePayload,
  type TauriReadAssetPayload,
  type TauriRevisionAcknowledgement,
  type TauriWriteAssetPayload,
} from "./contracts.ts";
import { assetHandlePayload, normalizeAssetHandle, stripAssetBinary, toIpcBytes, toUint8Array } from "./assets.ts";
import { requireTauriInvoke, type TauriInvoke } from "./runtime.ts";

export class TauriPersistenceError extends Error {
  readonly code: string;
  readonly command?: string;

  constructor(message: string, options: { code?: string; command?: string; cause?: unknown } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "TauriPersistenceError";
    this.code = options.code || "persistence-error";
    this.command = options.command;
  }
}

export class TauriProtocolError extends TauriPersistenceError {
  constructor(message: string, command?: string) {
    super(message, { code: "protocol-error", command });
    this.name = "TauriProtocolError";
  }
}

export class StaleAcknowledgementError extends TauriPersistenceError {
  readonly revision: RevisionId;
  readonly latestRevision: RevisionId | null;

  constructor(revision: RevisionId, latestRevision: RevisionId | null) {
    super(
      latestRevision
        ? `Acknowledgement for revision ${String(revision)} arrived after ${String(latestRevision)} was accepted.`
        : `Acknowledgement for revision ${String(revision)} arrived after its workspace session was replaced.`,
      {
        code: "stale-acknowledgement",
      },
    );
    this.name = "StaleAcknowledgementError";
    this.revision = revision;
    this.latestRevision = latestRevision;
  }
}

export interface TauriPersistenceOptions {
  invoke?: TauriInvoke;
  runtime?: unknown;
  commands?: Partial<typeof TAURI_COMMANDS>;
  now?: () => string;
  onAcknowledged?: (acknowledgement: PersistenceAck) => void;
}

export interface TauriAssetHandleResult extends TauriAssetHandle {
  release(): Promise<void>;
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function revisionValue(value: unknown): string | undefined {
  if (typeof value === "string") return value.length > 0 ? value : undefined;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return String(value);
  return undefined;
}

function compact<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

function uniqueStrings(values: readonly unknown[]): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string").map(String))];
}

function assetMetadata(value: AssetRecord | null): Record<string, unknown> | null {
  return value ? stripAssetBinary(value as unknown as Record<string, unknown>) : null;
}

function deltaOperation(operation: WorkspacePatchOperation): TauriDeltaOperation {
  switch (operation.kind) {
    case "replace-workspace-meta":
      return { kind: operation.kind, after: operation.after };
    case "replace-object":
      return { kind: operation.kind, objectId: operation.objectId, after: operation.after };
    case "replace-cell":
      return { kind: operation.kind, objectId: operation.objectId, cellId: operation.cellId, after: operation.after };
    case "replace-asset":
      return {
        kind: operation.kind,
        assetId: operation.assetId,
        after: assetMetadata(operation.after),
      };
    case "replace-theme":
      return { kind: operation.kind, themeId: operation.themeId, after: operation.after };
    default:
      return assertNever(operation);
  }
}

function assertNever(value: never): never {
  throw new TauriProtocolError(`Unsupported persistence operation ${String(value)}.`);
}

/** Converts the engine result into the intentionally forward-only IPC delta. */
export function toTauriDeltaPayload(workspaceId: WorkspaceId, persisted: PersistedTransaction): TauriCommitPayload {
  const transaction = persisted.transaction;
  const revision = asRevisionId(String(persisted.revision || transaction.revision));
  const patch = transaction.forwardPatch;
  return {
    workspaceId,
    revision,
    delta: {
      patchId: patch.id,
      baseRevision: patch.baseRevision,
      targetRevision: patch.targetRevision,
      operations: patch.operations.map(deltaOperation),
    },
    dirtyRecordIds: uniqueStrings(transaction.dirtyRecords.map((record) => record.recordId)),
  };
}

function workspaceFromResponse(value: unknown, command: string): WorkspaceSnapshot {
  const source = recordOf(value);
  const candidate = source?.workspace ?? source?.snapshot ?? value;
  const workspace = recordOf(candidate);
  if (
    !workspace
    || typeof workspace.id !== "string"
    || !workspace.objects
    || typeof workspace.objects !== "object"
    || Array.isArray(workspace.objects)
  ) {
    throw new TauriProtocolError(`The ${command} command did not return a workspace snapshot.`, command);
  }
  return candidate as WorkspaceSnapshot;
}

function acknowledgementSource(value: unknown): Record<string, unknown> | null {
  const source = recordOf(value);
  const nested = recordOf(source?.acknowledgement ?? source?.ack ?? source?.acknowledgment);
  return nested || source;
}

function normalizeAcknowledgement(
  value: unknown,
  requestedRevision: RevisionId,
  fallbackDirtyRecordIds: readonly string[],
  now: () => string,
  command: string,
): TauriRevisionAcknowledgement {
  const source = acknowledgementSource(value);
  const revision = revisionValue(source?.revision ?? source?.acknowledgedRevision);
  if (!revision) throw new TauriProtocolError(`The ${command} command did not acknowledge a revision.`, command);
  if (source?.accepted === false || source?.stale === true) {
    throw new TauriProtocolError(`The ${command} command rejected revision ${String(requestedRevision)}.`, command);
  }
  if (revision !== String(requestedRevision)) {
    throw new TauriProtocolError(
      `The ${command} command acknowledged ${revision} instead of ${String(requestedRevision)}.`,
      command,
    );
  }
  return {
    revision: asRevisionId(revision),
    persistedAt: stringValue(source?.persistedAt) || now(),
    dirtyRecordIds: uniqueStrings(
      Array.isArray(source?.dirtyRecordIds) ? source.dirtyRecordIds : fallbackDirtyRecordIds,
    ),
  };
}

function normalizeExport(value: unknown, requestedFormat: ExportRequest["format"], command: string): ExportResult {
  const envelope = recordOf(value);
  const source = recordOf(envelope?.result ?? value);
  if (!source || (source.format !== "json" && source.format !== "zip")) {
    throw new TauriProtocolError(`The ${command} command returned an invalid export format.`, command);
  }
  const format = source.format as ExportRequest["format"];
  if (format !== requestedFormat) {
    throw new TauriProtocolError(
      `The ${command} command returned ${format} for a ${requestedFormat} request.`,
      command,
    );
  }
  const fileName = stringValue(source.fileName);
  const mime = stringValue(source.mime);
  if (!fileName || !mime || source.data === undefined) {
    throw new TauriProtocolError(`The ${command} command returned an incomplete export.`, command);
  }
  if (format === "json" && typeof source.data !== "string") {
    throw new TauriProtocolError(`The ${command} command returned non-text JSON data.`, command);
  }
  const data: string | Uint8Array = format === "zip"
    ? toUint8Array(source.data, "portable export bytes")
    : source.data as string;
  return { format, fileName, mime, data };
}

function normalizeAssetRead(
  value: unknown,
  requestedAssetId: AssetId,
  command: string,
): AssetHandle & { nativeHandle?: string } {
  const envelope = recordOf(value);
  const source = recordOf(envelope?.asset ?? value);
  if (!source) throw new TauriProtocolError(`The ${command} command returned no asset.`, command);
  if (source.dataUrl !== undefined) {
    throw new TauriProtocolError("Native asset reads may not return data URLs.", command);
  }
  const bytes = source.bytes ?? source.data;
  if (bytes === undefined) throw new TauriProtocolError(`The ${command} command returned no asset bytes.`, command);
  const returnedAssetId = stringValue(source.assetId);
  if (returnedAssetId && returnedAssetId !== String(requestedAssetId)) {
    throw new TauriProtocolError(
      `The ${command} command returned asset ${returnedAssetId} instead of ${String(requestedAssetId)}.`,
      command,
    );
  }
  const data = toUint8Array(bytes, "asset bytes");
  return {
    assetId: asAssetId(String(source.assetId || requestedAssetId)),
    ...(stringValue(source.mime) ? { mime: stringValue(source.mime) } : {}),
    ...(stringValue(source.handle) ? { nativeHandle: stringValue(source.handle) } : {}),
    data,
  };
}

export class TauriPersistencePort implements PersistencePort {
  private readonly invoke: TauriInvoke;
  private readonly commands: typeof TAURI_COMMANDS;
  private readonly now: () => string;
  private readonly onAcknowledged?: (acknowledgement: PersistenceAck) => void;
  private workspaceId: WorkspaceId | null = null;
  private nextSequence = 0;
  private latestAcknowledgedSequence = 0;
  private latestAcknowledgement: PersistenceAck | null = null;
  private workspaceSession = 0;

  constructor(options: TauriPersistenceOptions = {}) {
    this.invoke = requireTauriInvoke(options.runtime, options.invoke);
    this.commands = { ...TAURI_COMMANDS, ...(options.commands || {}) };
    this.now = options.now || (() => new Date().toISOString());
    this.onAcknowledged = options.onAcknowledged;
  }

  get activeWorkspaceId(): WorkspaceId | null {
    return this.workspaceId;
  }

  get acknowledgedRevision(): RevisionId | null {
    return this.latestAcknowledgement?.revision || null;
  }

  async open(request: OpenWorkspaceRequest = {}): Promise<WorkspaceSnapshot> {
    const payload = compact({
      workspaceId: request.workspaceId,
      location: request.location,
    }) as TauriOpenWorkspacePayload;
    const response = await this.invoke(this.commands.openWorkspace, payload);
    const workspace = workspaceFromResponse(response, this.commands.openWorkspace);
    this.resetWorkspace(asWorkspaceId(String(workspace.id)));
    this.applyResponseAcknowledgement(response);
    return workspace;
  }

  async commit(persisted: PersistedTransaction): Promise<PersistenceAck> {
    const workspaceId = this.requireWorkspaceId();
    const payload = toTauriDeltaPayload(workspaceId, persisted);
    const sequence = ++this.nextSequence;
    const session = this.workspaceSession;
    const response = await this.invoke(this.commands.applyDelta, payload);
    const acknowledgement = normalizeAcknowledgement(
      response,
      payload.revision,
      payload.dirtyRecordIds,
      this.now,
      this.commands.applyDelta,
    );
    return this.acceptAcknowledgement(acknowledgement, sequence, session);
  }

  async checkpoint(revision: RevisionId): Promise<void> {
    const workspaceId = this.requireWorkspaceId();
    const targetRevision = asRevisionId(String(revision));
    const current = this.latestAcknowledgement?.revision;
    if (current && current !== targetRevision && this.latestAcknowledgedSequence > 0) {
      throw new StaleAcknowledgementError(targetRevision, current);
    }
    const sequence = ++this.nextSequence;
    const session = this.workspaceSession;
    const payload = { workspaceId, revision: targetRevision };
    const response = await this.invoke(this.commands.checkpoint, payload);
    if (response === undefined || response === null) {
      this.acceptAcknowledgement(
        { revision: targetRevision, persistedAt: this.now(), dirtyRecordIds: [] },
        sequence,
        session,
      );
      return;
    }
    const acknowledgement = normalizeAcknowledgement(response, targetRevision, [], this.now, this.commands.checkpoint);
    this.acceptAcknowledgement(acknowledgement, sequence, session);
  }

  async importPortable(source: ImportSource): Promise<WorkspaceSnapshot> {
    const payload: TauriImportPayload = {
      kind: source.kind,
      ...(source.name ? { name: source.name } : {}),
      data: source.kind === "zip" ? toIpcBytes(source.data, "portable import bytes") : source.data,
    };
    const response = await this.invoke(this.commands.importPortable, payload);
    const workspace = workspaceFromResponse(response, this.commands.importPortable);
    this.resetWorkspace(asWorkspaceId(String(workspace.id)));
    this.applyResponseAcknowledgement(response);
    return workspace;
  }

  async exportPortable(request: ExportRequest): Promise<ExportResult> {
    const workspaceId = asWorkspaceId(String(request.workspaceId || this.requireWorkspaceId()));
    const payload: TauriExportPayload = compact({
      workspaceId,
      objectIds: request.objectIds,
      format: request.format,
    }) as TauriExportPayload;
    const response = await this.invoke(this.commands.exportPortable, payload);
    return normalizeExport(response, request.format, this.commands.exportPortable);
  }

  async readAsset(request: AssetReadRequest): Promise<AssetHandle> {
    const workspaceId = this.requireWorkspaceId();
    const payload: TauriReadAssetPayload = {
      workspaceId,
      assetId: request.assetId,
    };
    const response = await this.invoke(this.commands.readAsset, payload);
    return normalizeAssetRead(response, request.assetId, this.commands.readAsset);
  }

  async writeAsset(request: AssetWriteRequest): Promise<AssetRecord> {
    const workspaceId = this.requireWorkspaceId();
    const record = stripAssetBinary(request.record as unknown as Record<string, unknown>);
    const payload: TauriWriteAssetPayload = {
      workspaceId,
      record,
      bytes: toIpcBytes(request.data, "asset bytes"),
    };
    const response = await this.invoke(this.commands.writeAsset, payload);
    const envelope = recordOf(response);
    const source = recordOf(envelope?.asset ?? envelope?.record ?? response);
    if (!source || typeof source.id !== "string") {
      throw new TauriProtocolError(
        `The ${this.commands.writeAsset} command returned no asset record.`,
        this.commands.writeAsset,
      );
    }
    if (source.dataUrl !== undefined || source.data !== undefined || source.bytes !== undefined) {
      throw new TauriProtocolError("Native asset writes may not return inline binary data.", this.commands.writeAsset);
    }
    return source as AssetRecord;
  }

  async acquireAssetHandle(assetId: AssetId): Promise<TauriAssetHandleResult> {
    const workspaceId = this.requireWorkspaceId();
    const response = await this.invoke(this.commands.acquireAssetHandle, assetHandlePayload(workspaceId, assetId));
    const handle = normalizeAssetHandle(response, assetId);
    return {
      ...handle,
      release: () => this.releaseAssetHandle(handle),
    };
  }

  async releaseAssetHandle(handle: TauriAssetHandle): Promise<void> {
    const workspaceId = this.requireWorkspaceId();
    await this.invoke(this.commands.releaseAssetHandle, assetHandlePayload(workspaceId, handle.assetId, handle.handle));
  }

  async close(): Promise<void> {
    if (!this.workspaceId) return;
    const workspaceId = this.workspaceId;
    await this.invoke(this.commands.closeWorkspace, { workspaceId });
    this.workspaceId = null;
    this.workspaceSession += 1;
    this.latestAcknowledgement = null;
    this.latestAcknowledgedSequence = 0;
    this.nextSequence = 0;
  }

  private requireWorkspaceId(): WorkspaceId {
    if (!this.workspaceId)
      throw new TauriPersistenceError("Open a workspace before using native persistence.", {
        code: "workspace-closed",
      });
    return this.workspaceId;
  }

  private resetWorkspace(workspaceId: WorkspaceId): void {
    this.workspaceId = workspaceId;
    this.workspaceSession += 1;
    this.nextSequence = 0;
    this.latestAcknowledgedSequence = 0;
    this.latestAcknowledgement = null;
  }

  private applyResponseAcknowledgement(response: unknown): void {
    const source = acknowledgementSource(response);
    const acknowledgedRevision = revisionValue(source?.acknowledgedRevision ?? source?.revision);
    if (!acknowledgedRevision) return;
    this.latestAcknowledgement = {
      revision: asRevisionId(acknowledgedRevision),
      persistedAt: stringValue(source?.persistedAt) || this.now(),
      dirtyRecordIds: uniqueStrings(Array.isArray(source?.dirtyRecordIds) ? source.dirtyRecordIds : []),
    };
  }

  private acceptAcknowledgement(
    acknowledgement: TauriRevisionAcknowledgement,
    sequence: number,
    session: number,
  ): PersistenceAck {
    if (session !== this.workspaceSession) {
      throw new StaleAcknowledgementError(acknowledgement.revision, this.latestAcknowledgement?.revision || null);
    }
    if (this.latestAcknowledgement && sequence < this.latestAcknowledgedSequence) {
      throw new StaleAcknowledgementError(acknowledgement.revision, this.latestAcknowledgement.revision);
    }
    const ack: PersistenceAck = {
      revision: acknowledgement.revision,
      persistedAt: acknowledgement.persistedAt,
      dirtyRecordIds: [...acknowledgement.dirtyRecordIds],
    };
    this.latestAcknowledgedSequence = sequence;
    this.latestAcknowledgement = ack;
    this.onAcknowledged?.(ack);
    return ack;
  }
}

export const TauriPersistenceAdapter = TauriPersistencePort;
