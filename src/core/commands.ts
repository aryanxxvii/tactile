import type {
  AssetRecord,
  CellChange,
  CellPatch,
  CellRange,
  FileObjectType,
  AxisName,
  ThemeRecord,
  TypedWorkspaceObjectPatch,
} from "./domain.ts";
import type { AssetId, CellId, CommandId, ObjectId, ObjectTypeKey, Timestamp, ThemeId } from "./ids.ts";

export type CommandSource = "keyboard" | "pointer" | "menu" | "import" | "system";

export interface CommandEnvelope {
  commandId: CommandId;
  issuedAt: Timestamp;
  source: CommandSource;
}

export interface SetCellCommand extends CommandEnvelope {
  type: "set-cell";
  objectId: ObjectId;
  cellId: CellId;
  patch: CellPatch;
}

export interface SetRangeCommand extends CommandEnvelope {
  type: "set-range";
  objectId: ObjectId;
  changes: readonly CellChange[];
  range?: CellRange;
}

export interface UpdateObjectCommand extends CommandEnvelope {
  type: "update-object";
  objectId: ObjectId;
  patch: TypedWorkspaceObjectPatch;
}

export interface ResizeAxisCommand extends CommandEnvelope {
  type: "resize-axis";
  objectId: ObjectId;
  axis: AxisName;
  targets: readonly number[];
  sizes: Readonly<Record<string, number>>;
}

export interface MoveAxisCommand extends CommandEnvelope {
  type: "move-axis";
  objectId: ObjectId;
  axis: AxisName;
  from: number;
  to: number;
}

export interface InsertAxisCommand extends CommandEnvelope {
  type: "insert-axis";
  objectId: ObjectId;
  axis: AxisName;
  index: number;
}

export interface DeleteAxisCommand extends CommandEnvelope {
  type: "delete-axis";
  objectId: ObjectId;
  axis: AxisName;
  index: number;
}

export interface CreateEmbeddedObjectCommand extends CommandEnvelope {
  type: "create-embedded-object";
  parentObjectId: ObjectId;
  parentCellId: CellId;
  objectType: ObjectTypeKey;
  objectId?: ObjectId;
  title?: string;
}

export interface ReplaceAssetCommand extends CommandEnvelope {
  type: "replace-asset";
  objectId: ObjectId;
  assetId: AssetId;
  asset: AssetRecord;
  data?: Uint8Array;
}

export type FormattingTarget = { cellIds: readonly CellId[] } | { range: CellRange };

export type ApplyFormattingCommand = CommandEnvelope &
  FormattingTarget & {
    type: "apply-formatting";
    objectId: ObjectId;
    patch: Record<string, unknown>;
  };

export interface UpdateThemeCommand extends CommandEnvelope {
  type: "update-theme";
  themeId: ThemeId;
  patch: Partial<Pick<ThemeRecord, "name" | "description" | "version" | "builtIn">> & {
    tokens?: Record<string, unknown>;
  };
}

export type WorkspaceCommand =
  | SetCellCommand
  | SetRangeCommand
  | UpdateObjectCommand
  | ResizeAxisCommand
  | MoveAxisCommand
  | InsertAxisCommand
  | DeleteAxisCommand
  | CreateEmbeddedObjectCommand
  | ReplaceAssetCommand
  | ApplyFormattingCommand
  | UpdateThemeCommand;

export type WorkspaceCommandType = WorkspaceCommand["type"];

export function isFileObjectType(type: ObjectTypeKey): type is FileObjectType {
  return ["pdf", "image", "video", "html", "svg"].includes(type as FileObjectType);
}
