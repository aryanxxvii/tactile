import type { CellAddress, CellId, EmbedLinkId, ObjectId } from "./ids.ts";
import type { CellRange, WorkspaceSnapshot } from "./domain.ts";

export interface DurableWorkspaceState {
  workspace: WorkspaceSnapshot;
}

export interface SelectionState {
  activeAddress: CellAddress;
  range: CellRange | null;
}

export interface LayerSourceState {
  linkId?: EmbedLinkId;
  parentObjectId: ObjectId;
  sourceCellId: CellId;
  sourceAddress: CellAddress;
}

export type InOutPhase = "origin" | "floating" | "full" | "closing" | "returned";

export interface ObjectLayerState {
  objectId: ObjectId;
  parentObjectId?: ObjectId;
  source?: LayerSourceState;
  mode: "floating" | "full";
  phase: InOutPhase;
}

export interface WorkspaceViewState {
  activeObjectId: ObjectId;
  selections: Record<string, SelectionState>;
  layers: ObjectLayerState[];
  editingCellId: CellId | null;
  focusedObjectId: ObjectId | null;
}

export interface TransientGestureState {
  kind: "selection" | "fill" | "resize" | "axis-reorder" | "in-out";
  objectId?: ObjectId;
  startedAt: number;
}

export interface TransientWorkspaceState {
  view: WorkspaceViewState;
  gesture: TransientGestureState | null;
  menu: { kind: string; x: number; y: number } | null;
  notice: string | null;
}

export interface WorkspaceRuntimeState {
  durable: DurableWorkspaceState;
  transient: TransientWorkspaceState;
}
