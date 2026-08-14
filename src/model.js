import {
  cellAddress,
  cellId,
  coordinatesFromCellId,
} from "./sheet/coordinates.js";
import {
  repairObjectTopology,
  repairWorkspaceTopology,
} from "./core/topology.js";
import { normalizeIconEmoji } from "./iconEmoji.js";

export { normalizeIconEmoji };

export const WORKSPACE_VERSION = 4;
export const DEFAULT_ROWS = 256;
export const DEFAULT_COLUMNS = 64;

export const OBJECT_TYPE_NAMES = {
  sheet: "Tiles",
  markdown: "Text",
  document: "Text",
  pdf: "PDF",
  image: "Image",
  video: "Video",
  html: "HTML",
  svg: "SVG",
};

export function createId(prefix = "object") {
  const random = globalThis.crypto?.randomUUID?.().slice(0, 8)
    || Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

export function generatedObjectTitle(type, address = "") {
  const label = OBJECT_TYPE_NAMES[type] || "Object";
  return address ? `${label} ${address}` : `Untitled ${label}`;
}

export function createCellRecord(row, column, patch = {}) {
  return {
    id: cellId(row, column),
    address: cellAddress(row, column),
    row,
    column,
    value: "",
    formula: "",
    embed: null,
    ...patch,
  };
}

export function materializeCell(sheet, row, column) {
  const id = cellId(row, column);
  return sheet?.cells?.[id] || createCellRecord(row, column);
}

export function isCellUsed(cell) {
  if (!cell) return false;
  return Boolean(
    cell.value
    || cell.formula
    || cell.embed
    || cell.note
    || cell.style
    || cell.validation
  );
}

function parseLegacyEmbeddedLink(value) {
  if (typeof value !== "string" || !value.startsWith("[[tactile:") || !value.endsWith("]]")) return null;
  const body = value.slice(10, -2);
  const separator = body.indexOf(":");
  const pipe = body.indexOf("|", separator + 1);
  if (separator < 1 || pipe < separator + 2) return null;
  return {
    type: body.slice(0, separator),
    objectId: body.slice(separator + 1, pipe),
    title: body.slice(pipe + 1).replace(/\\([\\|\]])/g, "$1"),
  };
}

export function normalizeCell(cell, fallbackId) {
  const coordinates = Number.isInteger(cell?.row) && Number.isInteger(cell?.column)
    ? { row: cell.row, column: cell.column }
    : coordinatesFromCellId(cell?.id || fallbackId);
  if (!coordinates) return null;
  const parsedEmbed = cell?.embed?.objectId
    ? cell.embed
    : parseLegacyEmbeddedLink(cell?.embed) || parseLegacyEmbeddedLink(cell?.value);
  return createCellRecord(coordinates.row, coordinates.column, {
    ...cell,
    id: cellId(coordinates.row, coordinates.column),
    address: cellAddress(coordinates.row, coordinates.column),
    value: parsedEmbed?.title
      || (typeof cell?.value === "string" ? cell.value : String(cell?.value ?? "")),
    formula: typeof cell?.formula === "string" ? cell.formula : "",
    embed: parsedEmbed?.objectId
      ? {
          ...parsedEmbed,
          objectId: String(parsedEmbed.objectId),
          type: String(parsedEmbed.type || "markdown"),
          ...(parsedEmbed.linkId ? { linkId: String(parsedEmbed.linkId) } : {}),
          ...(parsedEmbed.relation ? { relation: String(parsedEmbed.relation) } : {}),
        }
      : null,
  });
}

export function createSheetObject({
  id = createId("tiles"),
  title,
  description = "",
  rows = DEFAULT_ROWS,
  columns = DEFAULT_COLUMNS,
  cells = {},
  rowHeight,
  columnWidth,
  rowHeights = {},
  columnWidths = {},
  parent = null,
} = {}) {
  const normalizedRowHeights = Object.fromEntries(Object.entries(rowHeights || {})
    .filter(([index, value]) => Number.isInteger(Number(index)) && Number.isFinite(Number(value)))
    .map(([index, value]) => [String(Number(index)), Math.max(24, Math.min(96, Number(value)))]));
  const normalizedColumnWidths = Object.fromEntries(Object.entries(columnWidths || {})
    .filter(([index, value]) => Number.isInteger(Number(index)) && Number.isFinite(Number(value)))
    .map(([index, value]) => [String(Number(index)), Math.max(56, Math.min(420, Number(value)))]));
  return {
    id,
    type: "sheet",
    title: title || generatedObjectTitle("sheet"),
    description,
    parent: parent && typeof parent === "object" ? { ...parent } : null,
    rows: Math.max(DEFAULT_ROWS, rows),
    columns: Math.max(DEFAULT_COLUMNS, columns),
    cells,
    rowHeight: Number.isFinite(Number(rowHeight)) ? Math.max(24, Math.min(72, Number(rowHeight))) : undefined,
    columnWidth: Number.isFinite(Number(columnWidth)) ? Math.max(76, Math.min(280, Number(columnWidth))) : undefined,
    rowHeights: normalizedRowHeights,
    columnWidths: normalizedColumnWidths,
    rowGroups: [],
    columnGroups: [],
    conditionalFormats: [],
    filters: [],
    frozenRows: 0,
    frozenColumns: 0,
  };
}

export function createMarkdownObject({
  id = createId("text"),
  title,
  description = "",
  content = "",
  parent = null,
} = {}) {
  return {
    id,
    type: "markdown",
    title: title || generatedObjectTitle("markdown"),
    description,
    parent: parent && typeof parent === "object" ? { ...parent } : null,
    content,
  };
}

export function createObjectForType(type, options = {}) {
  if (type === "sheet") return createSheetObject(options);
  if (type === "markdown" || type === "document") return createMarkdownObject(options);
  return {
    ...options,
    id: options.id || createId(type),
    type,
    title: options.title || generatedObjectTitle(type),
    description: options.description || "",
    parent: options.parent && typeof options.parent === "object" ? { ...options.parent } : null,
    assetId: options.assetId || null,
    source: options.source || "",
  };
}

export function inferFileObjectType(file) {
  const mime = String(file?.mime || file?.type || "").toLowerCase();
  const extension = String(file?.extension || file?.fileName || file?.name || "").split(".").pop().toLowerCase();
  if (mime === "application/pdf" || extension === "pdf") return "pdf";
  if (mime === "image/svg+xml" || extension === "svg") return "svg";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime === "text/html" || ["html", "htm"].includes(extension)) return "html";
  return "markdown";
}

export function createBlankWorkspace({
  id = createId("workspace"),
  name = "Tactile",
} = {}) {
  const home = createSheetObject({ id: "home", title: "Home" });
  const now = new Date().toISOString();
  return {
    format: "tactile",
    version: WORKSPACE_VERSION,
    id,
    name,
    homeObjectId: home.id,
    homePath: [],
    createdAt: now,
    updatedAt: now,
    objects: { [home.id]: home },
    assets: {},
    themes: {},
    activeThemeId: "paper-public",
    settings: {
      reduceMotion: false,
      openSingleClick: "floating",
      openDoubleClick: "full",
      filesPinned: false,
      filesWidth: 360,
    },
  };
}

function normalizeAxisGroups(groups, prefix, maxIndex) {
  if (!Array.isArray(groups)) return [];
  return groups
    .filter((group) => Number.isInteger(group?.start) && Number.isInteger(group?.end))
    .map((group) => {
      const start = Math.max(0, Math.min(maxIndex, Math.min(group.start, group.end)));
      const end = Math.max(0, Math.min(maxIndex, Math.max(group.start, group.end)));
      return {
        id: String(group.id || createId(prefix)),
        start,
        end,
        collapsed: Boolean(group.collapsed),
      };
    })
    .filter((group) => group.end > group.start);
}

function normalizeObject(object, fallbackId) {
  const type = object?.type === "document" ? "markdown" : object?.type;
  const iconPatch = Object.prototype.hasOwnProperty.call(object || {}, "iconEmoji")
    ? { iconEmoji: normalizeIconEmoji(object.iconEmoji) }
    : {};
  if (type === "sheet") {
    const cells = {};
    Object.entries(object.cells || {}).forEach(([id, value]) => {
      const cell = normalizeCell(value, id);
      if (cell && isCellUsed(cell)) cells[cell.id] = cell;
    });
    const sheet = createSheetObject({
        id: object.id || fallbackId,
        title: object.title,
        description: object.description || "",
        parent: object.parent,
        rows: object.rows,
        columns: object.columns,
        cells,
        rowHeight: object.rowHeight,
        columnWidth: object.columnWidth,
        rowHeights: object.rowHeights,
        columnWidths: object.columnWidths,
      });
    return {
      ...object,
      ...sheet,
      ...iconPatch,
      rowGroups: normalizeAxisGroups(object.rowGroups, "row-group", sheet.rows - 1),
      columnGroups: normalizeAxisGroups(object.columnGroups, "column-group", sheet.columns - 1),
      conditionalFormats: Array.isArray(object.conditionalFormats) ? object.conditionalFormats : [],
      filters: Array.isArray(object.filters) ? object.filters : [],
      frozenRows: Number.isInteger(object.frozenRows) ? object.frozenRows : 0,
      frozenColumns: Number.isInteger(object.frozenColumns) ? object.frozenColumns : 0,
    };
  }
  if (type === "markdown") {
    const legacyContent = Array.isArray(object.blocks)
      ? object.blocks.map((block) => {
          if (block.type === "heading") return `## ${block.text}`;
          if (block.type === "quote") return `> ${block.text}`;
          return block.text || "";
        }).join("\n\n")
      : "";
    return {
      ...object,
      ...createMarkdownObject({
      id: object.id || fallbackId,
      title: object.title,
      description: object.description || "",
      parent: object.parent,
      content: typeof object.content === "string" ? object.content : legacyContent,
      }),
      ...iconPatch,
    };
  }
  return createObjectForType(type || "markdown", {
    ...object,
    id: object?.id || fallbackId,
    ...iconPatch,
  });
}

export function normalizeWorkspace(input) {
  if (!input || typeof input !== "object" || !input.objects) return createBlankWorkspace();
  const objects = {};
  Object.entries(input.objects).forEach(([id, object]) => {
    const normalized = normalizeObject(object, id);
    objects[normalized.id] = normalized;
  });

  let homeObjectId = input.homeObjectId || input.rootObjectId;
  if (!objects[homeObjectId]) homeObjectId = Object.keys(objects)[0];
  if (!homeObjectId) {
    const blank = createBlankWorkspace({ id: input.id, name: input.name });
    return blank;
  }

  const now = new Date().toISOString();
  const homePath = Array.isArray(input.homePath)
    ? input.homePath.map((entry) => ({
      objectId: String(entry?.objectId || ""),
      sourceObjectId: String(entry?.sourceObjectId || ""),
      ...(entry?.sourceCellId ? { sourceCellId: String(entry.sourceCellId) } : {}),
      sourceAddress: String(entry?.sourceAddress || ""),
      ...(entry?.linkId ? { linkId: String(entry.linkId) } : {}),
    })).filter((entry) => entry.objectId && entry.sourceObjectId && entry.sourceAddress)
    : [];
  const workspace = {
    ...input,
    format: "tactile",
    version: WORKSPACE_VERSION,
    id: input.id || createId("workspace"),
    name: input.name || "Tactile",
    homeObjectId,
    homePath,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
    objects,
    assets: input.assets && typeof input.assets === "object" ? input.assets : {},
    themes: input.themes && typeof input.themes === "object" ? input.themes : {},
    activeThemeId: input.activeThemeId || "paper-public",
    settings: {
      reduceMotion: false,
      openSingleClick: "floating",
      openDoubleClick: "full",
      onboardingComplete: false,
      onboardingThemeId: "",
      nativeWorkspacePath: "",
      ...(input.settings || {}),
    },
  };
  const hasDurableTopology = Object.values(objects).some((object) => (
    object?.parent
    || Object.values(object?.cells || {}).some((cell) => Boolean(cell?.embed?.linkId))
  ));
  return repairWorkspaceTopology(workspace, {
    // Legacy snapshots used homePath as their only route hint. Consume it
    // once during migration; normalized workspaces keep Home independent from
    // the canonical Files hierarchy thereafter.
    preferredPath: hasDurableTopology ? [] : homePath,
  });
}

function homeObjectIds(objects) {
  return new Set(Object.entries(objects || {})
    .filter(([objectId, object]) => (
      objectId === "home"
      || (object?.type === "sheet" && object?.title === "Home" && !object?.parent)
    ))
    .map(([objectId]) => objectId));
}

function deletionObjectIds(repaired, objectId) {
  const childrenByParent = new Map();
  repaired?.canonicalByChild?.forEach((edge, childId) => {
    const children = childrenByParent.get(edge.sourceObjectId) || [];
    children.push(String(childId));
    childrenByParent.set(edge.sourceObjectId, children);
  });

  const objectIds = new Set([String(objectId)]);
  const pending = [String(objectId)];
  while (pending.length) {
    const parentId = pending.pop();
    (childrenByParent.get(parentId) || []).forEach((childId) => {
      if (objectIds.has(childId)) return;
      objectIds.add(childId);
      pending.push(childId);
    });
  }
  return objectIds;
}

function protectedObjectIds(repaired, workspace) {
  const protectedIds = homeObjectIds(repaired?.objects);
  let currentId = String(workspace?.homeObjectId || "");
  while (currentId && !protectedIds.has(currentId)) {
    protectedIds.add(currentId);
    currentId = repaired?.canonicalByChild?.get(currentId)?.sourceObjectId || "";
  }
  return protectedIds;
}

export function objectDeletionPlan(workspace, objectId) {
  const targetId = String(objectId || "");
  const objects = workspace?.objects || {};
  if (!targetId || !objects[targetId]) {
    return {
      objectId: targetId,
      objectIds: new Set(),
      protectedObjectIds: new Set(),
      canDelete: false,
      reason: "Object not found",
    };
  }

  const repaired = repairObjectTopology(objects);
  const objectIds = deletionObjectIds(repaired, targetId);
  const protectedIds = protectedObjectIds(repaired, workspace);
  const blockedId = [...objectIds].find((id) => protectedIds.has(id));
  const homeIds = homeObjectIds(repaired.objects);
  const reason = blockedId === String(workspace?.homeObjectId || "")
    ? "Current start"
    : homeIds.has(blockedId)
      ? "Home"
      : blockedId
        ? "Contains current start"
        : "";

  return {
    objectId: targetId,
    objectIds,
    protectedObjectIds: protectedIds,
    repaired,
    canDelete: !blockedId,
    reason,
  };
}

/**
 * Delete an object and its canonical descendants as one workspace update.
 * Alias cells pointing into the deleted subtree are cleared as well, while
 * unrelated objects and shared assets remain intact.
 */
export function deleteObjectFromWorkspace(workspace, objectId) {
  const plan = objectDeletionPlan(workspace, objectId);
  if (!plan.canDelete) return workspace;

  const sourceObjects = plan.repaired.objects;
  const removedAssetIds = new Set([...plan.objectIds]
    .map((id) => sourceObjects[id]?.assetId)
    .filter(Boolean)
    .map(String));
  const objects = {};

  Object.entries(sourceObjects).forEach(([id, object]) => {
    if (plan.objectIds.has(id)) return;
    if (object?.type !== "sheet") {
      objects[id] = object;
      return;
    }

    const cells = {};
    Object.entries(object.cells || {}).forEach(([cellId, cell]) => {
      if (plan.objectIds.has(String(cell?.embed?.objectId || ""))) return;
      cells[cellId] = cell;
    });
    objects[id] = Object.keys(cells).length === Object.keys(object.cells || {}).length
      ? object
      : { ...object, cells };
  });

  const remainingAssetIds = new Set(Object.values(objects)
    .map((object) => object?.assetId)
    .filter(Boolean)
    .map(String));
  const assets = Object.fromEntries(Object.entries(workspace.assets || {}).filter(([assetId]) => (
    !removedAssetIds.has(String(assetId)) || remainingAssetIds.has(String(assetId))
  )));

  return repairWorkspaceTopology({
    ...workspace,
    updatedAt: new Date().toISOString(),
    objects,
    assets,
  });
}

export function createEmbeddedObject(workspace, {
  parentObjectId,
  parentCellId,
  type,
}) {
  const parent = workspace.objects[parentObjectId];
  if (parent?.type !== "sheet") return { workspace, object: null };
  const coordinates = coordinatesFromCellId(parentCellId);
  if (!coordinates) return { workspace, object: null };
  const address = cellAddress(coordinates.row, coordinates.column);
  const object = createObjectForType(type, {
    title: generatedObjectTitle(type, address),
  });
  const linkId = createId("link");
  const cell = createCellRecord(coordinates.row, coordinates.column, {
    ...(parent.cells[parentCellId] || {}),
    value: object.title,
    formula: "",
    embed: {
      objectId: object.id,
      type: object.type,
      linkId,
      relation: "containment",
    },
  });
  object.parent = {
    linkId,
    parentObjectId,
    parentCellId: cell.id,
    sourceAddress: cell.address,
  };
  const now = new Date().toISOString();
  return {
    object,
    workspace: repairWorkspaceTopology({
      ...workspace,
      updatedAt: now,
      objects: {
        ...workspace.objects,
        [parentObjectId]: {
          ...parent,
          cells: { ...parent.cells, [cell.id]: cell },
        },
        [object.id]: object,
      },
    }),
  };
}

export function usedSheetBounds(sheet) {
  let maxRow = -1;
  let maxColumn = -1;
  Object.values(sheet?.cells || {}).forEach((cell) => {
    if (!isCellUsed(cell)) return;
    maxRow = Math.max(maxRow, cell.row);
    maxColumn = Math.max(maxColumn, cell.column);
  });
  return {
    rows: maxRow + 1,
    columns: maxColumn + 1,
  };
}
