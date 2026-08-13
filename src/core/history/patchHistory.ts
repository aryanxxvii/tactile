import type { TransactionResult, WorkspacePatch } from "../patches.ts";
import type { CellId, ObjectId } from "../ids.ts";
import { invertPatch, makePatch, mergePatchOperations } from "./patches.ts";

export type HistoryCoalescingKey = string;

export interface HistoryEntry {
  forwardPatch: WorkspacePatch;
  inversePatch: WorkspacePatch;
  changedObjectIds: ObjectId[];
  changedCellIds: CellId[];
  invalidatedFormulaIds: CellId[];
  coalescingKey?: HistoryCoalescingKey;
}

export interface HistoryPushOptions {
  coalescingKey?: HistoryCoalescingKey;
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function entryFromTransaction(transaction: TransactionResult, coalescingKey?: string): HistoryEntry {
  return {
    forwardPatch: transaction.forwardPatch,
    inversePatch: transaction.inversePatch,
    changedObjectIds: unique(transaction.changedObjectIds),
    changedCellIds: unique(transaction.changedCellIds),
    invalidatedFormulaIds: unique(transaction.invalidatedFormulaIds),
    coalescingKey,
  };
}

function mergeEntries(previous: HistoryEntry, current: HistoryEntry): HistoryEntry {
  const forwardOperations = mergePatchOperations([
    ...previous.forwardPatch.operations,
    ...current.forwardPatch.operations,
  ]);
  const forwardPatch = makePatch(
    forwardOperations,
    previous.forwardPatch.baseRevision,
    current.forwardPatch.targetRevision,
  );
  return {
    forwardPatch,
    inversePatch: invertPatch(forwardPatch),
    changedObjectIds: unique([...previous.changedObjectIds, ...current.changedObjectIds]),
    changedCellIds: unique([...previous.changedCellIds, ...current.changedCellIds]),
    invalidatedFormulaIds: unique([...previous.invalidatedFormulaIds, ...current.invalidatedFormulaIds]),
    coalescingKey: previous.coalescingKey,
  };
}

/**
 * Patch history has no dependency on React or the persistence layer.  The
 * engine owns when entries are pushed; this class only handles bounded undo,
 * redo invalidation, and explicit edit-session coalescing.
 */
export class PatchHistory {
  private readonly past: HistoryEntry[] = [];

  private readonly future: HistoryEntry[] = [];

  private readonly limit: number;

  constructor(limit = 120) {
    this.limit = limit;
  }

  push(transaction: TransactionResult, options: HistoryPushOptions = {}): HistoryEntry {
    const entry = entryFromTransaction(transaction, options.coalescingKey);
    const previous = this.past.at(-1);
    if (entry.coalescingKey && previous?.coalescingKey === entry.coalescingKey) {
      this.past[this.past.length - 1] = mergeEntries(previous, entry);
    } else {
      this.past.push(entry);
      if (this.past.length > this.limit) this.past.shift();
    }
    this.future.length = 0;
    return this.past.at(-1) || entry;
  }

  takeUndo(): HistoryEntry | null {
    return this.past.pop() || null;
  }

  pushRedo(entry: HistoryEntry): void {
    this.future.push(entry);
  }

  takeRedo(): HistoryEntry | null {
    return this.future.pop() || null;
  }

  pushPast(entry: HistoryEntry): void {
    this.past.push(entry);
    if (this.past.length > this.limit) this.past.shift();
  }

  clear(): void {
    this.past.length = 0;
    this.future.length = 0;
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }

  getUndoDepth(): number {
    return this.past.length;
  }

  getRedoDepth(): number {
    return this.future.length;
  }

  peekUndo(): HistoryEntry | null {
    return this.past.at(-1) || null;
  }

  peekRedo(): HistoryEntry | null {
    return this.future.at(-1) || null;
  }
}
