import type { CellView, SheetWindow, WorkspaceMeta, WorkspaceObject, WorkspaceSnapshot } from "./domain.ts";
import type { ObjectId, RevisionId } from "./ids.ts";
import type { WorkspaceCommand } from "./commands.ts";
import type { TransactionResult } from "./patches.ts";

export type EngineSelector<Value = unknown> = (snapshot: WorkspaceSnapshot) => Value;

export interface WorkspaceEngine {
  getWorkspaceMeta(): WorkspaceMeta;
  getObject(objectId: ObjectId): WorkspaceObject | undefined;
  getSheetWindow(objectId: ObjectId, window: SheetWindow): CellView[];
  subscribe(selector: EngineSelector<unknown>, listener: () => void): () => void;
  dispatch(command: WorkspaceCommand): Promise<TransactionResult>;
  undo(): Promise<TransactionResult | null>;
  redo(): Promise<TransactionResult | null>;
  getRevision(): RevisionId;
}

export interface EngineSnapshotReader {
  getSnapshot(): WorkspaceSnapshot;
  getRevision(): RevisionId;
}
