import type { EngineSelector, WorkspaceEngine } from "../engine.ts";
import type { CellView, SheetWindow, WorkspaceMeta, WorkspaceObject, WorkspaceSnapshot } from "../domain.ts";
import type { CellId, ObjectId, RevisionId } from "../ids.ts";
import { asRevisionId } from "../ids.ts";
import type { DirtyRecord, DirtyReason, TransactionResult, WorkspacePatchOperation } from "../patches.ts";
import {
  commandHistoryKey,
  type CommandDispatchOptions,
  type DispatchableWorkspaceCommand,
} from "../commands/types.ts";
import {
  dirtyRecordsForOperations,
  effectsFromOperations,
  executeWorkspaceCommand,
  TransactionMutationBuilder,
} from "../commands/execute.ts";
import { invertPatch, makePatch, mergePatchOperations } from "../history/patches.ts";
import { PatchHistory } from "../history/patchHistory.ts";
import { createCellRecord } from "../model.ts";
import { cellId } from "../coordinates.ts";
import { NormalizedRecordStore } from "./normalizedStore.ts";

export interface TransactionEngineOptions {
  historyLimit?: number;
  initialRevision?: RevisionId | string;
}

export interface TextEditSession {
  id: string;
  objectId: ObjectId;
  cellId: CellId;
}

interface SelectorSubscription<Value> {
  selector: EngineSelector<Value>;
  listener: () => void;
  value: Value;
}

export interface TransactionEngine extends WorkspaceEngine {
  getSnapshot(): WorkspaceSnapshot;
  getDirtyRecords(): DirtyRecord[];
  consumeDirtyRecords(): DirtyRecord[];
  markRecordsClean(recordIds?: readonly string[]): void;
  getStoreCounts(): ReturnType<NormalizedRecordStore["getRecordCounts"]>;
  dispatchBatch(
    commands: readonly DispatchableWorkspaceCommand[],
    options?: CommandDispatchOptions,
  ): Promise<TransactionResult>;
  beginTextEditSession(objectId: ObjectId | string, cellId: CellId | string, id?: string): TextEditSession;
  endTextEditSession(session: TextEditSession | string): void;
  getUndoDepth(): number;
  getRedoDepth(): number;
}

let sessionSequence = 0;

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function reasonForCommand(command: DispatchableWorkspaceCommand): DirtyReason {
  if (command.source === "import") return "import";
  if (command.source === "system") return "migration";
  return "command";
}

function nextRevisionValue(current: RevisionId): { id: RevisionId; number: number } {
  const match = /(?:^|-)\d+$/.exec(String(current));
  const number = match ? Number(match[0].replace(/^-/, "")) + 1 : 1;
  return { id: asRevisionId(String(number)), number };
}

function emptyTransaction(revision: RevisionId): TransactionResult {
  const forwardPatch = makePatch([], revision, revision);
  return {
    revision,
    changedObjectIds: [],
    changedCellIds: [],
    invalidatedFormulaIds: [],
    forwardPatch,
    inversePatch: invertPatch(forwardPatch),
    dirtyRecords: [],
  };
}

/**
 * External normalized workspace engine.  Store mutation, patch creation,
 * history, dirty bookkeeping, and selector notification all happen inside one
 * queued transaction, so a user action produces one visible update.
 */
export class NormalizedWorkspaceEngine implements TransactionEngine {
  readonly store: NormalizedRecordStore;

  private readonly history: PatchHistory;

  private readonly subscribers = new Set<SelectorSubscription<unknown>>();

  private readonly dirtyRecords = new Map<string, DirtyRecord>();

  private readonly textSessions = new Map<string, TextEditSession>();

  private queue: Promise<unknown> = Promise.resolve();

  private revision: RevisionId;

  private revisionNumber: number;

  constructor(snapshot: WorkspaceSnapshot, options: TransactionEngineOptions = {}) {
    this.store = new NormalizedRecordStore(snapshot);
    this.history = new PatchHistory(options.historyLimit);
    const initial = asRevisionId(String(options.initialRevision ?? "0"));
    this.revision = initial;
    this.revisionNumber = Number(initial) || 0;
  }

  getSnapshot(): WorkspaceSnapshot {
    return this.store.getSnapshot();
  }

  getWorkspaceMeta(): WorkspaceMeta {
    return this.store.getWorkspaceMeta();
  }

  getObject(objectId: ObjectId): WorkspaceObject | undefined {
    return this.store.getObject(objectId);
  }

  getSheetWindow(objectId: ObjectId, window: SheetWindow): CellView[] {
    const sheet = this.store.getSheet(objectId);
    if (!sheet) return [];
    const overscan = Math.max(0, Math.trunc(window.overscan || 0));
    const rowStart = Math.max(0, Math.trunc(window.rowStart) - overscan);
    const rowEnd = Math.min(Number(sheet.rows) - 1, Math.trunc(window.rowEnd) + overscan);
    const columnStart = Math.max(0, Math.trunc(window.columnStart) - overscan);
    const columnEnd = Math.min(Number(sheet.columns) - 1, Math.trunc(window.columnEnd) + overscan);
    const cells: CellView[] = [];
    for (let row = rowStart; row <= rowEnd; row += 1) {
      for (let column = columnStart; column <= columnEnd; column += 1) {
        const id = cellId(row, column);
        const cell = sheet.cells.get(id) || createCellRecord(row, column);
        cells.push({
          ...cell,
          displayValue: cell.formula || cell.value,
        });
      }
    }
    return cells;
  }

  subscribe<Value>(selector: EngineSelector<Value>, listener: () => void): () => void {
    const subscription: SelectorSubscription<Value> = {
      selector,
      listener,
      value: selector(this.getSnapshot()),
    };
    const record = subscription as unknown as SelectorSubscription<unknown>;
    this.subscribers.add(record);
    return () => this.subscribers.delete(record);
  }

  dispatch(command: DispatchableWorkspaceCommand, options: CommandDispatchOptions = {}): Promise<TransactionResult> {
    return this.enqueue(() => this.dispatchNow(command, options));
  }

  dispatchBatch(
    commands: readonly DispatchableWorkspaceCommand[],
    options: CommandDispatchOptions = {},
  ): Promise<TransactionResult> {
    return this.enqueue(() => {
      if (!commands.length) return emptyTransaction(this.revision);
      const builder = new TransactionMutationBuilder(this.store);
      commands.forEach((command) => {
        executeWorkspaceCommand(this.store, command, { builder, touchMeta: false });
      });
      const lastCommand = commands.at(-1);
      if (builder.hasChanges()) builder.touchMeta(String(lastCommand?.issuedAt || new Date().toISOString()));
      const key = commandHistoryKey(lastCommand || commands[0], options);
      return this.finalize(builder, key, lastCommand ? reasonForCommand(lastCommand) : "command");
    });
  }

  undo(): Promise<TransactionResult | null> {
    return this.enqueue(() => {
      const entry = this.history.takeUndo();
      if (!entry) return null;
      const builder = new TransactionMutationBuilder(this.store);
      entry.inversePatch.operations.forEach((operation) => this.applyPatchOperation(builder, operation));
      const result = this.finalize(builder, undefined, "undo");
      this.history.pushRedo(entry);
      return result;
    });
  }

  redo(): Promise<TransactionResult | null> {
    return this.enqueue(() => {
      const entry = this.history.takeRedo();
      if (!entry) return null;
      const builder = new TransactionMutationBuilder(this.store);
      entry.forwardPatch.operations.forEach((operation) => this.applyPatchOperation(builder, operation));
      const result = this.finalize(builder, undefined, "redo");
      this.history.pushPast(entry);
      return result;
    });
  }

  getRevision(): RevisionId {
    return this.revision;
  }

  getDirtyRecords(): DirtyRecord[] {
    return [...this.dirtyRecords.values()];
  }

  consumeDirtyRecords(): DirtyRecord[] {
    const dirty = this.getDirtyRecords();
    this.dirtyRecords.clear();
    return dirty;
  }

  markRecordsClean(recordIds?: readonly string[]): void {
    if (!recordIds) {
      this.dirtyRecords.clear();
      return;
    }
    recordIds.forEach((recordId) => {
      const requested = String(recordId);
      this.dirtyRecords.delete(requested);
      for (const [key, record] of this.dirtyRecords) {
        if (record.recordId === requested || key === requested) this.dirtyRecords.delete(key);
      }
    });
  }

  getStoreCounts(): ReturnType<NormalizedRecordStore["getRecordCounts"]> {
    return this.store.getRecordCounts();
  }

  beginTextEditSession(objectId: ObjectId | string, cellId: CellId | string, id?: string): TextEditSession {
    sessionSequence += 1;
    const session: TextEditSession = {
      id: id || `edit-${sessionSequence.toString(36)}`,
      objectId: String(objectId) as ObjectId,
      cellId: String(cellId) as CellId,
    };
    this.textSessions.set(`${session.objectId}:${session.cellId}`, session);
    return session;
  }

  endTextEditSession(session: TextEditSession | string): void {
    const id = typeof session === "string" ? session : session.id;
    for (const [key, value] of this.textSessions) {
      if (value.id === id) this.textSessions.delete(key);
    }
  }

  getUndoDepth(): number {
    return this.history.getUndoDepth();
  }

  getRedoDepth(): number {
    return this.history.getRedoDepth();
  }

  private dispatchNow(command: DispatchableWorkspaceCommand, options: CommandDispatchOptions): TransactionResult {
    const builder = executeWorkspaceCommand(this.store, command, { timestamp: String(command.issuedAt || "") });
    if (!builder.hasChanges()) return emptyTransaction(this.revision);
    return this.finalize(builder, this.coalescingKey(command, options), reasonForCommand(command));
  }

  private coalescingKey(command: DispatchableWorkspaceCommand, options: CommandDispatchOptions): string | undefined {
    const explicit = commandHistoryKey(command, options);
    if (explicit) return explicit;
    if (options.coalesce && command.type === "set-cell") {
      return `text-edit:${String(command.objectId)}:${String(command.cellId)}`;
    }
    if (command.type === "set-cell") {
      const session = this.textSessions.get(`${String(command.objectId)}:${String(command.cellId)}`);
      if (session) return `text-edit:${session.id}`;
    }
    return undefined;
  }

  private finalize(
    builder: TransactionMutationBuilder,
    coalescingKey: string | undefined,
    reason: DirtyReason,
  ): TransactionResult {
    const operations = mergePatchOperations(builder.getOperations());
    if (!operations.length) return emptyTransaction(this.revision);
    const baseRevision = this.revision;
    const next = nextRevisionValue(this.revision);
    this.revision = next.id;
    this.revisionNumber = next.number;
    const forwardPatch = makePatch(operations, baseRevision, this.revision);
    const inversePatch = invertPatch(forwardPatch, this.revision, baseRevision);
    const effects = effectsFromOperations(this.store, forwardPatch.operations);
    const dirtyRecords = dirtyRecordsForOperations(forwardPatch.operations, reason);
    dirtyRecords.forEach((record) => {
      this.dirtyRecords.set(`${record.recordType}:${record.objectId || ""}:${record.recordId}`, record);
    });
    const transaction: TransactionResult = {
      revision: this.revision,
      changedObjectIds: unique(effects.changedObjectIds),
      changedCellIds: unique(effects.changedCellIds),
      invalidatedFormulaIds: unique(effects.invalidatedFormulaIds),
      forwardPatch,
      inversePatch,
      dirtyRecords,
    };
    if (reason === "command" || reason === "import" || reason === "migration") {
      this.history.push(transaction, { coalescingKey });
    }
    this.notifySelectors();
    return transaction;
  }

  private applyPatchOperation(builder: TransactionMutationBuilder, operation: WorkspacePatchOperation): void {
    switch (operation.kind) {
      case "replace-workspace-meta":
        builder.replaceWorkspaceMeta(operation.after);
        break;
      case "replace-object":
        builder.replaceObject(operation.objectId, operation.after);
        break;
      case "replace-cell":
        builder.replaceCell(operation.objectId, operation.cellId, operation.after);
        break;
      case "replace-asset":
        builder.replaceAsset(operation.assetId, operation.after);
        break;
      case "replace-theme":
        builder.replaceTheme(operation.themeId, operation.after);
        break;
      default:
        throw new Error(`Unsupported patch operation ${(operation as { kind: string }).kind}.`);
    }
  }

  private notifySelectors(): void {
    if (!this.subscribers.size) return;
    const snapshot = this.getSnapshot();
    this.subscribers.forEach((subscription) => {
      const next = subscription.selector(snapshot);
      if (Object.is(next, subscription.value)) return;
      subscription.value = next;
      subscription.listener();
    });
  }

  private enqueue<Value>(work: () => Value | Promise<Value>): Promise<Value> {
    const next = this.queue.then(work, work);
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}

export function createWorkspaceEngine(
  snapshot: WorkspaceSnapshot,
  options: TransactionEngineOptions = {},
): TransactionEngine {
  return new NormalizedWorkspaceEngine(snapshot, options);
}

export const createTransactionEngine = createWorkspaceEngine;
