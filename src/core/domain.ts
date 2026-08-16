import type {
  AssetId,
  CellAddress,
  CellId,
  ColumnIndex,
  EmbedLinkId,
  ObjectId,
  ObjectTypeKey,
  RowIndex,
  ThemeId,
  Timestamp,
  WorkspaceId,
} from "./ids.ts";

export const KNOWN_OBJECT_TYPES = ["sheet", "markdown", "document", "code", "pdf", "image", "video", "html", "svg"] as const;

export type KnownObjectType = (typeof KNOWN_OBJECT_TYPES)[number];
export type FileObjectType = Exclude<KnownObjectType, "sheet" | "markdown" | "document" | "code">;
export type AxisName = "row" | "column";
export type CellScalar = string | number | boolean | null;
export type CellValue = string;
export type Formula = string;

export interface CellStyle {
  [key: string]: unknown;
  align?: "left" | "center" | "right";
  bold?: boolean;
  fontSize?: number;
  highlight?: string;
  numberFormat?: "general" | "number" | "percent" | string;
  textColor?: string;
  verticalAlign?: "top" | "middle" | "bottom";
}

export interface CellValidation {
  [key: string]: unknown;
}

export interface EmbeddedObjectReference {
  [key: string]: unknown;
  linkId: EmbedLinkId;
  objectId: ObjectId;
  relation: "containment" | "alias";
  type: ObjectTypeKey;
}

export interface ObjectParentLink {
  [key: string]: unknown;
  linkId: EmbedLinkId;
  parentObjectId: ObjectId;
  parentCellId: CellId;
  sourceAddress: CellAddress;
}

export interface CellRecord {
  id: CellId;
  address: CellAddress;
  row: RowIndex;
  column: ColumnIndex;
  value: CellValue;
  formula: Formula;
  embed: EmbeddedObjectReference | null;
  note?: string;
  style?: CellStyle;
  validation?: CellValidation;
  role?: "heading" | "label" | string;
}

export type CellPatch = Partial<Pick<CellRecord, "value" | "formula" | "note" | "style" | "validation" | "role">> & {
  embed?: EmbeddedObjectReference | null;
};

export interface CellChange {
  cellId: CellId;
  patch: CellPatch;
}

export interface AxisGroup {
  id: string;
  start: number;
  end: number;
  collapsed: boolean;
}

export interface FilterRule {
  column: number;
  operator?: string;
  value?: unknown;
  [key: string]: unknown;
}

export interface ConditionalFormatRule {
  id?: string;
  range: string;
  kind: string;
  [key: string]: unknown;
}

export interface ObjectRecordBase<Type extends ObjectTypeKey = ObjectTypeKey> {
  [key: string]: unknown;
  id: ObjectId;
  parent: ObjectParentLink | null;
  type: Type;
  title: string;
  description: string;
}

export interface SheetObject extends ObjectRecordBase<"sheet"> {
  rows: number;
  columns: number;
  cells: Record<string, CellRecord>;
  rowHeight?: number;
  columnWidth?: number;
  rowHeights: Record<string, number>;
  columnWidths: Record<string, number>;
  rowGroups: AxisGroup[];
  columnGroups: AxisGroup[];
  conditionalFormats: ConditionalFormatRule[];
  filters: FilterRule[];
  frozenRows: number;
  frozenColumns: number;
}

export interface MarkdownObject extends ObjectRecordBase<"markdown"> {
  content: string;
}

export interface DocumentObject extends ObjectRecordBase<"document"> {
  content: string;
}

export interface CodeObject extends ObjectRecordBase<"code"> {
  content: string;
  language: string;
  extension?: string | null;
}

export interface FileObject extends ObjectRecordBase<FileObjectType> {
  assetId: AssetId | null;
  source: string;
}

export type WorkspaceObject = SheetObject | MarkdownObject | DocumentObject | CodeObject | FileObject;

export interface AssetRecord {
  id: AssetId;
  fileName?: string;
  extension?: string;
  mime?: string;
  size?: number;
  checksum?: string;
  [key: string]: unknown;
}

export interface ThemeRecord {
  id: ThemeId;
  name: string;
  description: string;
  version: number;
  builtIn?: boolean;
  tokens: Record<string, unknown>;
  [key: string]: unknown;
}

export interface WorkspaceSettings {
  reduceMotion: boolean;
  openSingleClick: "floating" | "full";
  openDoubleClick: "floating" | "full";
  filesPinned?: boolean;
  filesWidth?: number;
  [key: string]: unknown;
}

export interface HomePathEntry {
  linkId?: EmbedLinkId;
  objectId: ObjectId;
  sourceCellId?: CellId;
  sourceObjectId: ObjectId;
  sourceAddress: CellAddress;
}

export interface NavigationRouteSegment extends HomePathEntry {
  childObjectId?: ObjectId;
  mode: "floating" | "full";
}

export interface NavigationRoute {
  format: "tactile-route";
  version: number;
  workspaceId: WorkspaceId;
  rootObjectId: ObjectId;
  segments: NavigationRouteSegment[];
}

export interface WorkspaceMeta {
  format: "tactile";
  version: number;
  id: WorkspaceId;
  name: string;
  homeObjectId: ObjectId;
  homePath: HomePathEntry[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  activeThemeId: ThemeId;
  settings: WorkspaceSettings;
}

export interface WorkspaceSnapshot extends WorkspaceMeta {
  objects: Record<string, WorkspaceObject>;
  assets: Record<string, AssetRecord>;
  themes: Record<string, ThemeRecord>;
}

export interface CellRange {
  anchor: CellAddress;
  focus: CellAddress;
}

export interface NormalizedCellRange extends CellRange {
  rowStart: RowIndex;
  rowEnd: RowIndex;
  columnStart: ColumnIndex;
  columnEnd: ColumnIndex;
}

export interface SheetWindow {
  rowStart: RowIndex;
  rowEnd: RowIndex;
  columnStart: ColumnIndex;
  columnEnd: ColumnIndex;
  overscan?: number;
}

export interface CellView extends CellRecord {
  displayValue: string;
  calculatedValue?: CellScalar;
}

export interface WorkspaceObjectPatch {
  title?: string;
  description?: string;
  iconEmoji?: string;
  iconColor?: string;
}

export interface SheetObjectPatch extends WorkspaceObjectPatch {
  rows?: number;
  columns?: number;
  rowHeight?: number;
  columnWidth?: number;
  rowHeights?: Record<string, number>;
  columnWidths?: Record<string, number>;
  rowGroups?: AxisGroup[];
  columnGroups?: AxisGroup[];
  conditionalFormats?: ConditionalFormatRule[];
  filters?: FilterRule[];
  frozenRows?: number;
  frozenColumns?: number;
}

export interface MarkdownObjectPatch extends WorkspaceObjectPatch {
  content?: string;
}

export interface FileObjectPatch extends WorkspaceObjectPatch {
  assetId?: AssetId | null;
  source?: string;
}

export type TypedWorkspaceObjectPatch = SheetObjectPatch | MarkdownObjectPatch | FileObjectPatch;
