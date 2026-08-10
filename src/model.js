import {
  cellAddress,
  cellId,
  coordinatesFromCellId,
} from "./sheet/coordinates.js";

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

export function normalizeCell(cell, fallbackId) {
  const coordinates = Number.isInteger(cell?.row) && Number.isInteger(cell?.column)
    ? { row: cell.row, column: cell.column }
    : coordinatesFromCellId(cell?.id || fallbackId);
  if (!coordinates) return null;
  return createCellRecord(coordinates.row, coordinates.column, {
    ...cell,
    id: cellId(coordinates.row, coordinates.column),
    address: cellAddress(coordinates.row, coordinates.column),
    value: typeof cell?.value === "string" ? cell.value : String(cell?.value ?? ""),
    formula: typeof cell?.formula === "string" ? cell.formula : "",
    embed: cell?.embed?.objectId
      ? {
          objectId: String(cell.embed.objectId),
          type: String(cell.embed.type || "markdown"),
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
} = {}) {
  return {
    id,
    type: "markdown",
    title: title || generatedObjectTitle("markdown"),
    description,
    content,
  };
}

export function createObjectForType(type, options = {}) {
  if (type === "sheet") return createSheetObject(options);
  if (type === "markdown" || type === "document") return createMarkdownObject(options);
  return {
    id: options.id || createId(type),
    type,
    title: options.title || generatedObjectTitle(type),
    description: options.description || "",
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
        rows: object.rows,
        columns: object.columns,
        cells,
        rowHeight: object.rowHeight,
        columnWidth: object.columnWidth,
        rowHeights: object.rowHeights,
        columnWidths: object.columnWidths,
      });
    return {
      ...sheet,
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
    return createMarkdownObject({
      id: object.id || fallbackId,
      title: object.title,
      description: object.description || "",
      content: typeof object.content === "string" ? object.content : legacyContent,
    });
  }
  return createObjectForType(type || "markdown", {
    ...object,
    id: object?.id || fallbackId,
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
  return {
    format: "tactile",
    version: WORKSPACE_VERSION,
    id: input.id || createId("workspace"),
    name: input.name || "Tactile",
    homeObjectId,
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
      ...(input.settings || {}),
    },
  };
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
  const cell = createCellRecord(coordinates.row, coordinates.column, {
    ...(parent.cells[parentCellId] || {}),
    value: object.title,
    formula: "",
    embed: { objectId: object.id, type: object.type },
  });
  const now = new Date().toISOString();
  return {
    object,
    workspace: {
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
    },
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
