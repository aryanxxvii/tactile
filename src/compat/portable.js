import { buildPortablePackage, workspaceFromZip } from "../export.js";
import { materializeCell } from "../model.js";
import {
  cellAddress,
  cellId,
} from "../sheet/coordinates.js";
import {
  sheetCellFileValue,
  stringifyCsv,
} from "../format/csv.js";
import { PortableCompatibilityError } from "./errors.js";
import { migratePortableWorkspace } from "./migrations.js";
import {
  assertSupportedPortableVersion,
  clonePortableValue,
  CURRENT_PORTABLE_VERSION,
  isPlainRecord,
  PORTABLE_FORMAT,
  PORTABLE_LINK_SYNTAX,
  validatePortableWorkspace,
} from "./schema.js";

const CORE_WORKSPACE_INDEX_FIELDS = new Set([
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
  "objects",
  "themes",
]);

const CORE_OBJECT_FIELDS = new Set([
  "id",
  "type",
  "title",
  "description",
  "iconEmoji",
  "iconColor",
  "parent",
  "content",
  "blocks",
  "rows",
  "columns",
  "cells",
  "rowHeight",
  "columnWidth",
  "rowHeights",
  "columnWidths",
  "rowGroups",
  "columnGroups",
  "conditionalFormats",
  "filters",
  "frozenRows",
  "frozenColumns",
  "assetId",
  "source",
]);

const CORE_CELL_FIELDS = new Set(["id", "address", "row", "column", "value", "formula", "embed"]);

const CORE_MANIFEST_FIELDS = new Set([
  "format",
  "formatVersion",
  "entry",
  "workspaceId",
  "generatedAt",
  "linkSyntax",
  "note",
]);

function unknownFields(source, knownFields) {
  if (!isPlainRecord(source)) return {};
  return Object.fromEntries(Object.entries(source).filter(([key]) => !knownFields.has(key)));
}

function compatibilityCellUsed(cell) {
  if (!cell) return false;
  if (cell.value || cell.formula || cell.embed) return true;
  return Object.entries(cell).some(([key, value]) => (
    !CORE_CELL_FIELDS.has(key)
    && value !== undefined
    && value !== null
    && value !== ""
  ));
}

function compatibilityBounds(sheet) {
  let maxRow = -1;
  let maxColumn = -1;
  Object.values(sheet?.cells || {}).forEach((cell) => {
    if (!compatibilityCellUsed(cell)) return;
    maxRow = Math.max(maxRow, Number(cell.row));
    maxColumn = Math.max(maxColumn, Number(cell.column));
  });
  return { rows: maxRow + 1, columns: maxColumn + 1 };
}

function serializeCompatibilitySheetCsv(sheet, workspace) {
  const bounds = compatibilityBounds(sheet);
  if (!bounds.rows || !bounds.columns) return "";
  const rows = Array.from({ length: bounds.rows }, (_, row) => (
    Array.from({ length: bounds.columns }, (_, column) => (
      sheetCellFileValue(materializeCell(sheet, row, column), workspace)
    ))
  ));
  return stringifyCsv(rows);
}

function cellMetadataForPortableSheet(sheet) {
  const cells = {};
  Object.values(sheet?.cells || {}).forEach((cell) => {
    const metadata = unknownFields(cell, CORE_CELL_FIELDS);
    if (cell.embed?.linkId || cell.embed?.relation) metadata.embed = clonePortableValue(cell.embed);
    if (Object.keys(metadata).length) {
      cells[cell.address || cellAddress(cell.row, cell.column)] = clonePortableValue(metadata);
    }
  });
  return cells;
}

function json(value) {
  return JSON.stringify(value, null, 2);
}

export function buildPortableV4Package(workspaceInput, options = {}) {
  const workspace = migratePortableWorkspace(workspaceInput);
  validatePortableWorkspace(workspace);
  const base = buildPortablePackage(workspace);
  const rawObjects = workspace.objects || {};

  const objects = base.workspaceIndex.objects.map((record) => {
    const source = rawObjects[record.id] || {};
    return {
      ...record,
      ...unknownFields(source, CORE_OBJECT_FIELDS),
    };
  });

  objects.forEach((record) => {
    if (record.type !== "sheet") return;
    const sheet = rawObjects[record.id];
    if (!sheet) return;
    if (record.file) base.files[record.file] = serializeCompatibilitySheetCsv(sheet, workspace);
    if (record.metadata) {
      const metadata = isPlainRecord(base.files[record.metadata])
        ? base.files[record.metadata]
        : JSON.parse(base.files[record.metadata] || "{}");
      metadata.cells = cellMetadataForPortableSheet(sheet);
      base.files[record.metadata] = json(metadata);
    }
  });

  const workspaceIndex = {
    ...base.workspaceIndex,
    ...unknownFields(workspace, CORE_WORKSPACE_INDEX_FIELDS),
    format: PORTABLE_FORMAT,
    version: CURRENT_PORTABLE_VERSION,
    id: workspace.id,
    name: workspace.name,
    homeObjectId: workspace.homeObjectId,
    homePath: workspace.homePath,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
    activeThemeId: workspace.activeThemeId,
    settings: workspace.settings,
    objects,
    themes: base.workspaceIndex.themes,
  };

  const suppliedManifest = options.manifestMetadata || {};
  const manifest = {
    ...base.manifest,
    ...unknownFields(suppliedManifest, CORE_MANIFEST_FIELDS),
    format: PORTABLE_FORMAT,
    formatVersion: CURRENT_PORTABLE_VERSION,
    entry: "workspace.json",
    workspaceId: workspace.id,
    generatedAt: suppliedManifest.generatedAt || workspace.updatedAt || base.manifest.generatedAt,
    linkSyntax: PORTABLE_LINK_SYNTAX,
  };

  base.workspaceIndex = workspaceIndex;
  base.manifest = manifest;
  base.files["workspace.json"] = json(workspaceIndex);
  base.files["manifest.json"] = json(manifest);
  return base;
}

async function readJsonFromZip(zip, path, required = false) {
  const file = path ? zip.file(path) : null;
  if (!file) {
    if (required) throw new PortableCompatibilityError("MALFORMED_PACKAGE", `The portable bundle is missing ${path}.`, { path });
    return null;
  }
  try {
    return JSON.parse(await file.async("text"));
  } catch (error) {
    throw new PortableCompatibilityError("MALFORMED_JSON", `The portable bundle contains invalid JSON at ${path}.`, {
      path,
      cause: error,
    });
  }
}

function validatePackageIndex(index) {
  validatePortableWorkspace(
    {
      ...index,
      format: PORTABLE_FORMAT,
      version: index.version,
      objects: index.objects,
      assets: {},
    },
    { checkReferences: false, checkAssets: false },
  );
  for (const record of index.objects || []) {
    const size = record.asset?.size ?? record.asset?.byteLength;
    if (size !== undefined && (!Number.isSafeInteger(Number(size)) || Number(size) < 0)) {
      throw new PortableCompatibilityError("MALFORMED_ASSET", `Asset metadata for ${record.id} has an invalid size.`, {
        objectId: record.id,
        size,
      });
    }
  }
}

export async function readPortableV4Package(input, options = {}) {
  let zip;
  try {
    zip = await JSZip.loadAsync(input);
  } catch (error) {
    throw new PortableCompatibilityError("MALFORMED_PACKAGE", "The portable bundle is not a readable ZIP package.", { cause: error });
  }
  const manifest = await readJsonFromZip(zip, "manifest.json", true);
  if (manifest.format !== undefined && manifest.format !== PORTABLE_FORMAT) {
    throw new PortableCompatibilityError("MALFORMED_FORMAT", "The portable bundle is not a Tactile package.", { format: manifest.format });
  }
  const manifestVersion = assertSupportedPortableVersion(manifest);
  if (manifestVersion !== CURRENT_PORTABLE_VERSION) {
    throw new PortableCompatibilityError("UNSUPPORTED_PACKAGE_VERSION", `Expected a v${CURRENT_PORTABLE_VERSION} portable package.`, {
      version: manifestVersion,
    });
  }
  const index = await readJsonFromZip(zip, manifest.entry || "workspace.json", true);
  const indexVersion = assertSupportedPortableVersion(index);
  if (indexVersion !== CURRENT_PORTABLE_VERSION) {
    throw new PortableCompatibilityError("UNSUPPORTED_PACKAGE_VERSION", `Expected a v${CURRENT_PORTABLE_VERSION} workspace index.`, {
      version: indexVersion,
    });
  }
  if (manifest.workspaceId && index.id && manifest.workspaceId !== index.id) {
    throw new PortableCompatibilityError("MALFORMED_PACKAGE", "The manifest and workspace index ids do not match.", {
      manifestWorkspaceId: manifest.workspaceId,
      indexWorkspaceId: index.id,
    });
  }
  validatePackageIndex(index);

  let workspace;
  try {
    workspace = await workspaceFromZip(input);
  } catch (error) {
    if (error instanceof PortableCompatibilityError) throw error;
    throw new PortableCompatibilityError("MALFORMED_PACKAGE", "The portable bundle could not be decoded.", { cause: error });
  }

  const mergedWorkspace = {
    ...workspace,
    ...unknownFields(index, CORE_WORKSPACE_INDEX_FIELDS),
    format: PORTABLE_FORMAT,
    version: CURRENT_PORTABLE_VERSION,
    objects: { ...workspace.objects },
  };
  (index.objects || []).forEach((record) => {
    if (!mergedWorkspace.objects[record.id]) return;
    mergedWorkspace.objects[record.id] = {
      ...mergedWorkspace.objects[record.id],
      ...unknownFields(record, CORE_OBJECT_FIELDS),
    };
  });

  const migrated = migratePortableWorkspace(mergedWorkspace, options);
  validatePortableWorkspace(migrated, options);
  return { workspace: migrated, manifest: clonePortableValue(manifest) };
}

export async function portablePackageToZip(packageData) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  Object.entries(packageData.files || {}).forEach(([path, contents]) => {
    if (contents && typeof contents === "object" && contents.dataUrl) {
      const match = /^data:[^;,]+(;base64)?,(.*)$/s.exec(contents.dataUrl);
      if (!match) throw new PortableCompatibilityError("MALFORMED_ASSET", `Asset ${path} has an invalid data URL.`, { path });
      zip.file(path, match[1] ? Buffer.from(match[2], "base64") : decodeURIComponent(match[2]));
    } else {
      zip.file(path, contents ?? "");
    }
  });
  return zip.generateAsync({ type: "uint8array", compression: "STORE" });
}

export function portableCellAddress(row, column) {
  return cellAddress(row, column) || cellId(row, column);
}
