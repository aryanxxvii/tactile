export type Brand<Value, Tag extends string> = Value & {
  readonly __brand: Tag;
};

export type WorkspaceId = Brand<string, "WorkspaceId">;
export type ObjectId = Brand<string, "ObjectId">;
export type CellId = Brand<string, "CellId">;
export type EmbedLinkId = Brand<string, "EmbedLinkId">;
export type AssetId = Brand<string, "AssetId">;
export type ThemeId = Brand<string, "ThemeId">;
export type CommandId = Brand<string, "CommandId">;
export type PatchId = Brand<string, "PatchId">;
export type RevisionId = Brand<string, "RevisionId">;
export type Timestamp = Brand<string, "Timestamp">;
export type CellAddress = Brand<string, "CellAddress">;
export type ColumnLabel = Brand<string, "ColumnLabel">;
export type ObjectTypeKey = string;
export type RowIndex = Brand<number, "RowIndex">;
export type ColumnIndex = Brand<number, "ColumnIndex">;

export function asWorkspaceId(value: string): WorkspaceId {
  return value as WorkspaceId;
}

export function asObjectId(value: string): ObjectId {
  return value as ObjectId;
}

export function asCellId(value: string): CellId {
  return value as CellId;
}

export function asEmbedLinkId(value: string): EmbedLinkId {
  return value as EmbedLinkId;
}

export function asAssetId(value: string): AssetId {
  return value as AssetId;
}

export function asThemeId(value: string): ThemeId {
  return value as ThemeId;
}

export function asCommandId(value: string): CommandId {
  return value as CommandId;
}

export function asPatchId(value: string): PatchId {
  return value as PatchId;
}

export function asRevisionId(value: string): RevisionId {
  return value as RevisionId;
}

export function asTimestamp(value: string): Timestamp {
  return value as Timestamp;
}

export function asCellAddress(value: string): CellAddress {
  return value as CellAddress;
}

export function asColumnLabel(value: string): ColumnLabel {
  return value as ColumnLabel;
}

export function asObjectTypeKey(value: string): ObjectTypeKey {
  return value as ObjectTypeKey;
}

export function asRowIndex(value: number): RowIndex {
  if (!Number.isInteger(value) || value < 0) throw new RangeError("Row indexes must be non-negative integers.");
  return value as RowIndex;
}

export function asColumnIndex(value: number): ColumnIndex {
  if (!Number.isInteger(value) || value < 0) throw new RangeError("Column indexes must be non-negative integers.");
  return value as ColumnIndex;
}

export function toRowIndex(value: number): RowIndex | null {
  return Number.isInteger(value) && value >= 0 ? (value as RowIndex) : null;
}

export function toColumnIndex(value: number): ColumnIndex | null {
  return Number.isInteger(value) && value >= 0 ? (value as ColumnIndex) : null;
}
