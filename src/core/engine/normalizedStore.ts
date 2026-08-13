import type {
  AssetRecord,
  CellRecord,
  SheetObject,
  ThemeRecord,
  WorkspaceMeta,
  WorkspaceObject,
  WorkspaceSnapshot,
} from "../domain.ts";
import type { AssetId, CellId, ObjectId, ThemeId } from "../ids.ts";
import type { WorkspacePatchOperation } from "../patches.ts";
import { normalizeWorkspace } from "../model.ts";

type NonSheetObject = Exclude<WorkspaceObject, SheetObject>;

export interface NormalizedSheetRecord extends Omit<SheetObject, "cells"> {
  cells: Map<CellId, CellRecord>;
}

export type NormalizedObjectRecord = NormalizedSheetRecord | NonSheetObject;

export interface NormalizedRecordCounts {
  objects: number;
  cells: number;
  assets: number;
  themes: number;
}

const META_KEYS = new Set([
  "format",
  "version",
  "id",
  "name",
  "homeObjectId",
  "homePath",
  "createdAt",
  "updatedAt",
  "activeThemeId",
  "settings",
]);

function normalizeObjectRecord(object: WorkspaceObject): NormalizedObjectRecord {
  if (object.type !== "sheet") return { ...object } as NonSheetObject;
  return {
    ...object,
    cells: new Map(Object.entries(object.cells || {}) as [CellId, CellRecord][]),
  } as NormalizedSheetRecord;
}

function materializeObject(object: NormalizedObjectRecord): WorkspaceObject {
  if (object.type !== "sheet") return object as WorkspaceObject;
  return {
    ...object,
    cells: Object.fromEntries(object.cells.entries()),
  } as WorkspaceObject;
}

/**
 * The normalized store owns independent record tables.  A cell update mutates
 * one cell table entry and invalidates only that sheet's materialized view;
 * it never spreads the workspace or the sheet's sparse cell dictionary.
 */
export class NormalizedRecordStore {
  private meta: WorkspaceMeta & Record<string, unknown>;

  private readonly objects = new Map<ObjectId, NormalizedObjectRecord>();

  private readonly assets = new Map<AssetId, AssetRecord>();

  private readonly themes = new Map<ThemeId, ThemeRecord>();

  private readonly objectCache = new Map<ObjectId, WorkspaceObject>();

  private snapshotCache: WorkspaceSnapshot | null = null;

  private version = 0;

  constructor(input: WorkspaceSnapshot) {
    const normalized = normalizeWorkspace(input);
    const source = normalized as WorkspaceSnapshot & Record<string, unknown>;
    const meta: Record<string, unknown> = {};
    Object.entries(source).forEach(([key, value]) => {
      if (!META_KEYS.has(key) && key !== "objects" && key !== "assets" && key !== "themes") meta[key] = value;
    });
    this.meta = {
      ...meta,
      format: source.format,
      version: source.version,
      id: source.id,
      name: source.name,
      homeObjectId: source.homeObjectId,
      homePath: source.homePath,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
      activeThemeId: source.activeThemeId,
      settings: source.settings,
    };

    Object.entries(source.objects || {}).forEach(([objectId, object]) => {
      this.objects.set(objectId as ObjectId, normalizeObjectRecord(object));
    });
    Object.entries(source.assets || {}).forEach(([assetId, asset]) => {
      this.assets.set(assetId as AssetId, asset);
    });
    Object.entries(source.themes || {}).forEach(([themeId, theme]) => {
      this.themes.set(themeId as ThemeId, theme);
    });
  }

  getWorkspaceMeta(): WorkspaceMeta {
    return this.meta;
  }

  getObject(objectId: ObjectId | string): WorkspaceObject | undefined {
    const normalized = this.objects.get(String(objectId) as ObjectId);
    if (!normalized) return undefined;
    const cached = this.objectCache.get(String(objectId) as ObjectId);
    if (cached) return cached;
    const materialized = materializeObject(normalized);
    this.objectCache.set(String(objectId) as ObjectId, materialized);
    return materialized;
  }

  getNormalizedObject(objectId: ObjectId | string): NormalizedObjectRecord | undefined {
    return this.objects.get(String(objectId) as ObjectId);
  }

  getSheet(objectId: ObjectId | string): NormalizedSheetRecord | undefined {
    const object = this.getNormalizedObject(objectId);
    return object?.type === "sheet" ? object : undefined;
  }

  getCell(objectId: ObjectId | string, cellId: CellId | string): CellRecord | undefined {
    return this.getSheet(objectId)?.cells.get(String(cellId) as CellId);
  }

  getAsset(assetId: AssetId | string): AssetRecord | undefined {
    return this.assets.get(String(assetId) as AssetId);
  }

  getTheme(themeId: ThemeId | string): ThemeRecord | undefined {
    return this.themes.get(String(themeId) as ThemeId);
  }

  getRevisionVersion(): number {
    return this.version;
  }

  getRecordCounts(): NormalizedRecordCounts {
    let cells = 0;
    this.objects.forEach((object) => {
      if (object.type === "sheet") cells += object.cells.size;
    });
    return {
      objects: this.objects.size,
      cells,
      assets: this.assets.size,
      themes: this.themes.size,
    };
  }

  replaceWorkspaceMeta(after: WorkspaceMeta): void {
    this.meta = { ...after } as WorkspaceMeta & Record<string, unknown>;
    this.markChanged();
  }

  replaceObject(objectId: ObjectId | string, after: WorkspaceObject | null): void {
    const key = String(objectId) as ObjectId;
    if (after === null) this.objects.delete(key);
    else this.objects.set(key, normalizeObjectRecord(after));
    this.objectCache.delete(key);
    this.markChanged();
  }

  replaceCell(objectId: ObjectId | string, cellId: CellId | string, after: CellRecord | null): void {
    const sheet = this.getSheet(objectId);
    if (!sheet) throw new Error(`Object ${String(objectId)} is not a sheet.`);
    const key = String(cellId) as CellId;
    if (after === null) sheet.cells.delete(key);
    else sheet.cells.set(key, after);
    this.objectCache.delete(String(objectId) as ObjectId);
    this.markChanged();
  }

  replaceAsset(assetId: AssetId | string, after: AssetRecord | null): void {
    const key = String(assetId) as AssetId;
    if (after === null) this.assets.delete(key);
    else this.assets.set(key, after);
    this.markChanged();
  }

  replaceTheme(themeId: ThemeId | string, after: ThemeRecord | null): void {
    const key = String(themeId) as ThemeId;
    if (after === null) this.themes.delete(key);
    else this.themes.set(key, after);
    this.markChanged();
  }

  applyOperation(operation: WorkspacePatchOperation): void {
    switch (operation.kind) {
      case "replace-workspace-meta":
        this.replaceWorkspaceMeta(operation.after);
        break;
      case "replace-object":
        this.replaceObject(operation.objectId, operation.after);
        break;
      case "replace-cell":
        this.replaceCell(operation.objectId, operation.cellId, operation.after);
        break;
      case "replace-asset":
        this.replaceAsset(operation.assetId, operation.after);
        break;
      case "replace-theme":
        this.replaceTheme(operation.themeId, operation.after);
        break;
      default:
        throw new Error(`Unsupported patch operation ${(operation as { kind: string }).kind}.`);
    }
  }

  getSnapshot(): WorkspaceSnapshot {
    if (this.snapshotCache) return this.snapshotCache;
    const objects: Record<string, WorkspaceObject> = {};
    this.objects.forEach((_, objectId) => {
      const object = this.getObject(objectId);
      if (object) objects[objectId] = object;
    });
    this.snapshotCache = {
      ...this.meta,
      objects,
      assets: Object.fromEntries(this.assets.entries()),
      themes: Object.fromEntries(this.themes.entries()),
    } as WorkspaceSnapshot;
    return this.snapshotCache;
  }

  invalidateSnapshot(): void {
    this.markChanged();
  }

  private markChanged(): void {
    this.version += 1;
    this.snapshotCache = null;
  }
}
