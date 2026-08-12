import {
  cellAddress,
  cellId,
  coordinatesFromAddress,
  coordinatesFromCellId,
} from "../sheet/coordinates.js";
import { parseTactileLink } from "../format/csv.js";
import { repairWorkspaceTopology } from "../core/topology.js";
import { PortableCompatibilityError } from "./errors.js";
import {
  assertSupportedPortableVersion,
  clonePortableValue,
  isPlainRecord,
  validatePortableWorkspace,
} from "./schema.js";

export const LEGACY_COMPATIBILITY_EPOCH = "1970-01-01T00:00:00.000Z";

export const MIGRATION_CONTRACTS = Object.freeze([
  Object.freeze({
    from: 1,
    to: 2,
    name: "addressed-cells-to-sparse-records",
    preserves: ["embedded link titles", "cell metadata", "object metadata", "asset metadata", "theme tokens"],
  }),
  Object.freeze({
    from: 2,
    to: 3,
    name: "record-maps-to-ordered-portable-tables",
    preserves: ["stable ids", "sparse cells", "nested references", "unknown metadata"],
  }),
  Object.freeze({
    from: 3,
    to: 4,
    name: "ordered-tables-to-v4-workspace-snapshot",
    preserves: ["v4 link syntax", "separate assets", "unknown workspace/object/cell/theme fields"],
  }),
]);

const DEFAULT_SETTINGS = {
  reduceMotion: false,
  openSingleClick: "floating",
  openDoubleClick: "full",
  filesPinned: false,
  filesWidth: 360,
};

function fail(code, message, details = {}) {
  throw new PortableCompatibilityError(code, message, details);
}

function collectionEntries(collection, label) {
  if (Array.isArray(collection)) {
    return collection.map((record, index) => {
      if (!isPlainRecord(record)) fail("MALFORMED_COLLECTION", `${label}[${index}] must be an object.`, { label, index });
      return [String(record.id || index), record];
    });
  }
  if (!isPlainRecord(collection)) fail("MALFORMED_COLLECTION", `${label} must be an object or array.`, { label });
  return Object.entries(collection);
}

function collectionMap(collection, label) {
  return Object.fromEntries(collectionEntries(collection, label).map(([key, record]) => [String(record.id || key), clonePortableValue(record)]));
}

function coordinatesForCell(cell, fallbackKey) {
  if (Number.isInteger(cell?.row) && Number.isInteger(cell?.column) && cell.row >= 0 && cell.column >= 0) {
    return { row: cell.row, column: cell.column };
  }
  return coordinatesFromCellId(cell?.id)
    || coordinatesFromCellId(fallbackKey)
    || coordinatesFromAddress(cell?.address)
    || coordinatesFromAddress(fallbackKey);
}

function legacyContentFromBlocks(blocks) {
  if (!Array.isArray(blocks)) return "";
  return blocks.map((block) => {
    if (block?.type === "heading") return `## ${block.text || ""}`;
    if (block?.type === "quote") return `> ${block.text || ""}`;
    return block?.text || "";
  }).join("\n\n");
}

function normalizeEmbed(embed, fallbackValue) {
  const link = typeof embed === "string" ? parseTactileLink(embed) : null;
  if (link) return { objectId: link.objectId, type: link.type, title: link.title };
  if (isPlainRecord(embed) && embed.objectId) {
    return {
      ...embed,
      objectId: String(embed.objectId),
      type: String(embed.type || "markdown"),
    };
  }
  const valueLink = parseTactileLink(fallbackValue);
  if (valueLink) return { objectId: valueLink.objectId, type: valueLink.type, title: valueLink.title };
  if (embed) fail("MALFORMED_REFERENCE", "An embedded cell must contain an object id.");
  return null;
}

function normalizeCell(cellInput, fallbackKey) {
  const source = isPlainRecord(cellInput)
    ? clonePortableValue(cellInput)
    : { value: cellInput };
  const metadata = isPlainRecord(source.metadata) ? source.metadata : {};
  const cell = { ...metadata, ...source };
  const coordinates = coordinatesForCell(cell, fallbackKey);
  if (!coordinates) {
    fail("MALFORMED_CELL", `Cell ${String(fallbackKey)} has no valid address or coordinates.`, { cellId: fallbackKey });
  }

  const rawValue = typeof cell.value === "string" ? cell.value : String(cell.value ?? "");
  const link = typeof cell.link === "string" ? parseTactileLink(cell.link) : parseTactileLink(rawValue);
  const formula = typeof cell.formula === "string"
    ? cell.formula
    : rawValue.startsWith("=")
      ? rawValue
      : "";
  const embed = normalizeEmbed(cell.embed, rawValue) || (link
    ? { objectId: link.objectId, type: link.type, title: link.title }
    : null);
  return {
    ...cell,
    id: cellId(coordinates.row, coordinates.column),
    address: cellAddress(coordinates.row, coordinates.column),
    row: coordinates.row,
    column: coordinates.column,
    value: embed ? (embed.title || link?.title || rawValue) : formula ? "" : rawValue,
    formula,
    embed: embed
      ? {
          ...embed,
          objectId: String(embed.objectId),
          type: String(embed.type || link?.type || "markdown"),
        }
      : null,
  };
}

function normalizeCells(cells, objectId) {
  const entries = collectionEntries(cells || {}, `objects.${objectId}.cells`);
  const result = {};
  entries.forEach(([key, value]) => {
    const cell = normalizeCell(value, key);
    if (result[cell.id]) fail("DUPLICATE_ID", `Cell ${cell.id} appears more than once in ${objectId}.`, { objectId, cellId: cell.id });
    result[cell.id] = cell;
  });
  return result;
}

function normalizeObjectRecord(objectInput, fallbackId) {
  if (!isPlainRecord(objectInput)) fail("MALFORMED_OBJECT", `Object ${String(fallbackId)} must be an object.`, { objectId: fallbackId });
  const source = clonePortableValue(objectInput);
  const id = String(source.id || fallbackId || "");
  if (!id) fail("MALFORMED_OBJECT", "An object is missing its id.");
  const type = source.type === "document" ? "markdown" : String(source.type || "markdown");
  const normalized = {
    ...source,
    id,
    type,
    title: String(source.title || `Untitled ${type}`),
    description: typeof source.description === "string" ? source.description : String(source.description || ""),
  };
  if (type === "sheet") {
    return {
      ...normalized,
      rows: Math.max(256, Number.isFinite(Number(source.rows)) ? Number(source.rows) : 256),
      columns: Math.max(64, Number.isFinite(Number(source.columns)) ? Number(source.columns) : 64),
      cells: normalizeCells(source.cells, id),
      rowGroups: Array.isArray(source.rowGroups) ? source.rowGroups : [],
      columnGroups: Array.isArray(source.columnGroups) ? source.columnGroups : [],
      conditionalFormats: Array.isArray(source.conditionalFormats) ? source.conditionalFormats : [],
      filters: Array.isArray(source.filters) ? source.filters : [],
      frozenRows: Number.isInteger(source.frozenRows) ? source.frozenRows : 0,
      frozenColumns: Number.isInteger(source.frozenColumns) ? source.frozenColumns : 0,
    };
  }
  if (type === "markdown") {
    return {
      ...normalized,
      content: typeof source.content === "string" ? source.content : legacyContentFromBlocks(source.blocks),
    };
  }
  return {
    ...normalized,
    assetId: source.assetId || null,
    source: typeof source.source === "string" ? source.source : "",
  };
}

function normalizeObjectMap(objects) {
  const result = {};
  collectionEntries(objects, "objects").forEach(([key, value]) => {
    const object = normalizeObjectRecord(value, key);
    if (result[object.id]) fail("DUPLICATE_ID", `Object id ${object.id} appears more than once.`, { id: object.id });
    result[object.id] = object;
  });
  return result;
}

function normalizeThemes(themes) {
  return collectionMap(themes || {}, "themes");
}

function normalizeAssets(themes) {
  return collectionMap(themes || {}, "assets");
}

export function migrateV1ToV2(input) {
  const source = clonePortableValue(input);
  const objects = normalizeObjectMap(source.objects);
  const themes = normalizeThemes(source.themes || {});
  const assets = normalizeAssets(source.assets || {});
  return {
    ...source,
    version: 2,
    homeObjectId: source.homeObjectId || source.rootObjectId,
    objects,
    assets,
    themes,
    activeThemeId: source.activeThemeId || Object.keys(themes)[0] || "paper-public",
    settings: { ...DEFAULT_SETTINGS, ...(isPlainRecord(source.settings) ? source.settings : {}) },
  };
}

export function migrateV2ToV3(input) {
  const source = clonePortableValue(input);
  const objectTable = collectionEntries(source.objects, "objects").map(([key, value]) => {
    const object = normalizeObjectRecord(value, key);
    return {
      ...object,
      cells: object.type === "sheet" ? Object.values(object.cells) : object.cells,
    };
  });
  const assets = collectionEntries(source.assets || {}, "assets").map(([key, value]) => ({
    ...clonePortableValue(value),
    id: String(value.id || key),
    file: value.file || value.path || null,
  }));
  const themes = collectionEntries(source.themes || {}, "themes").map(([key, value]) => ({
    ...clonePortableValue(value),
    id: String(value.id || key),
  }));
  return {
    ...source,
    version: 3,
    objects: objectTable,
    assets,
    themes,
  };
}

export function migrateV3ToV4(input) {
  const source = clonePortableValue(input);
  const objects = normalizeObjectMap(source.objects);
  const assets = normalizeAssets(source.assets || {});
  const themes = normalizeThemes(source.themes || {});
  return {
    ...source,
    format: "tactile",
    version: 4,
    homeObjectId: source.homeObjectId || source.rootObjectId || Object.keys(objects)[0],
    objects,
    assets,
    themes,
    activeThemeId: source.activeThemeId || Object.keys(themes)[0] || "paper-public",
    createdAt: source.createdAt || LEGACY_COMPATIBILITY_EPOCH,
    updatedAt: source.updatedAt || source.createdAt || LEGACY_COMPATIBILITY_EPOCH,
    settings: { ...DEFAULT_SETTINGS, ...(isPlainRecord(source.settings) ? source.settings : {}) },
  };
}

const MIGRATORS = new Map([
  [1, migrateV1ToV2],
  [2, migrateV2ToV3],
  [3, migrateV3ToV4],
]);

export function migratePortableStep(input, fromVersion) {
  const actualVersion = assertSupportedPortableVersion(input);
  if (actualVersion !== fromVersion) {
    fail("MIGRATION_SEQUENCE", `Expected v${fromVersion}, received v${actualVersion}.`, {
      expected: fromVersion,
      actual: actualVersion,
    });
  }
  const migrator = MIGRATORS.get(fromVersion);
  if (!migrator) fail("MIGRATION_SEQUENCE", `No migration is registered for v${fromVersion}.`, { fromVersion });
  return migrator(input);
}

export function migratePortableWorkspace(input, options = {}) {
  const initial = clonePortableValue(input);
  let version = assertSupportedPortableVersion(initial);
  validatePortableWorkspace(initial, options);
  let current = initial;
  while (version < 4) {
    current = migratePortableStep(current, version);
    version += 1;
    validatePortableWorkspace(current, options);
  }
  const repaired = repairWorkspaceTopology(current, { includeReport: Boolean(options.includeTopologyReport) });
  validatePortableWorkspace(repaired, options);
  return repaired;
}
