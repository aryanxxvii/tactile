import { parseTactileLink } from "../format/csv.js";
import { PortableCompatibilityError } from "./errors.js";

export const PORTABLE_FORMAT = "tactile";
export const CURRENT_PORTABLE_VERSION = 4;
export const PORTABLE_LINK_SYNTAX = "[[tactile:<type>:<object-id>|<title>]]";

export const DEFAULT_PORTABLE_LIMITS = Object.freeze({
  maxObjects: 10_000,
  maxCells: 1_000_000,
  maxAssetBytes: 100 * 1024 * 1024,
  maxTotalAssetBytes: 512 * 1024 * 1024,
});

export function clonePortableValue(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function isPlainRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, details = {}) {
  throw new PortableCompatibilityError(code, message, details);
}

export function portableVersionOf(input) {
  const raw = input?.formatVersion ?? input?.version;
  if (raw === undefined || raw === null || raw === "") {
    fail("MALFORMED_VERSION", "The portable workspace does not declare a format version.");
  }
  const version = Number(raw);
  if (!Number.isInteger(version) || version < 1) {
    fail("MALFORMED_VERSION", `Invalid portable format version: ${String(raw)}.`);
  }
  return version;
}

export function assertSupportedPortableVersion(input) {
  const version = portableVersionOf(input);
  if (version > CURRENT_PORTABLE_VERSION) {
    fail(
      "UNSUPPORTED_VERSION",
      `Portable format v${version} is newer than the supported v${CURRENT_PORTABLE_VERSION} format.`,
      { version, supportedVersion: CURRENT_PORTABLE_VERSION },
    );
  }
  return version;
}

function collectionRecords(collection, label) {
  if (Array.isArray(collection)) {
    return collection.map((record, index) => {
      if (!isPlainRecord(record)) {
        fail("MALFORMED_COLLECTION", `${label}[${index}] must be an object.`, { label, index });
      }
      return { key: String(record.id || index), record };
    });
  }
  if (!isPlainRecord(collection)) {
    fail("MALFORMED_COLLECTION", `${label} must be an object or array.`, { label });
  }
  return Object.entries(collection).map(([key, record]) => {
    if (!isPlainRecord(record)) {
      fail("MALFORMED_COLLECTION", `${label}.${key} must be an object.`, { label, key });
    }
    return { key, record };
  });
}

function objectRecords(input) {
  if (input?.objects === undefined) {
    fail("MALFORMED_OBJECTS", "The portable workspace is missing its objects collection.");
  }
  return collectionRecords(input.objects, "objects");
}

function assetRecords(input) {
  if (input?.assets === undefined || input.assets === null) return [];
  return collectionRecords(input.assets, "assets");
}

function cellRecords(object) {
  if (object?.cells === undefined || object.cells === null) return [];
  return collectionRecords(object.cells, `objects.${object.id}.cells`);
}

function validateDeclaredAssetSize(asset, limits, total) {
  const rawSize = asset.size ?? asset.byteLength;
  if (rawSize === undefined || rawSize === null || rawSize === "") return total;
  const size = Number(rawSize);
  if (!Number.isSafeInteger(size) || size < 0) {
    fail("MALFORMED_ASSET", `Asset ${String(asset.id || "unknown")} has an invalid size.`, {
      assetId: asset.id,
      size: rawSize,
    });
  }
  if (size > limits.maxAssetBytes) {
    fail(
      "OVERSIZED_ASSET",
      `Asset ${String(asset.id || "unknown")} exceeds the ${limits.maxAssetBytes}-byte compatibility limit.`,
      { assetId: asset.id, size, maxAssetBytes: limits.maxAssetBytes },
    );
  }
  const nextTotal = total + size;
  if (nextTotal > limits.maxTotalAssetBytes) {
    fail("OVERSIZED_WORKSPACE", "The portable workspace exceeds its total asset-size limit.", {
      totalAssetBytes: nextTotal,
      maxTotalAssetBytes: limits.maxTotalAssetBytes,
    });
  }
  return nextTotal;
}

export function validatePortableWorkspace(input, options = {}) {
  const version = assertSupportedPortableVersion(input);
  const limits = { ...DEFAULT_PORTABLE_LIMITS, ...(options.limits || {}) };
  if (input.format !== undefined && input.format !== PORTABLE_FORMAT) {
    fail("MALFORMED_FORMAT", `Expected a ${PORTABLE_FORMAT} workspace.`, { format: input.format });
  }

  const records = objectRecords(input);
  if (records.length > limits.maxObjects) {
    fail("OVERSIZED_WORKSPACE", "The portable workspace contains too many objects.", {
      objectCount: records.length,
      maxObjects: limits.maxObjects,
    });
  }

  const objectsById = new Map();
  records.forEach(({ key, record }) => {
    const id = String(record.id || "");
    if (!id) fail("MALFORMED_OBJECT", `Object ${key} is missing an id.`, { key });
    if (objectsById.has(id)) {
      fail("DUPLICATE_ID", `Object id ${id} appears more than once.`, { id });
    }
    objectsById.set(id, record);
  });

  const homeObjectId = input.homeObjectId || input.rootObjectId;
  if (homeObjectId && !objectsById.has(String(homeObjectId))) {
    fail("DANGLING_REFERENCE", `Home object ${String(homeObjectId)} does not exist.`, {
      reference: homeObjectId,
      kind: "homeObjectId",
    });
  }

  const assets = assetRecords(input);
  const assetsById = new Map();
  let totalAssetBytes = 0;
  assets.forEach(({ key, record }) => {
    const id = String(record.id || key || "");
    if (!id) fail("MALFORMED_ASSET", `Asset ${key} is missing an id.`, { key });
    if (assetsById.has(id)) fail("DUPLICATE_ID", `Asset id ${id} appears more than once.`, { id });
    assetsById.set(id, record);
    totalAssetBytes = validateDeclaredAssetSize(record, limits, totalAssetBytes);
  });

  let cellCount = 0;
  records.forEach(({ record }) => {
    const type = String(record.type || "");
    if (!type) fail("MALFORMED_OBJECT", `Object ${String(record.id)} is missing a type.`, { objectId: record.id });
    if (record.parent !== undefined && record.parent !== null) {
      if (!isPlainRecord(record.parent)) {
        fail("MALFORMED_REFERENCE", `Object ${String(record.id)} has an invalid parent record.`, {
          objectId: record.id,
          kind: "parent",
        });
      }
      if (!record.parent.parentObjectId || !objectsById.has(String(record.parent.parentObjectId))) {
        fail("DANGLING_REFERENCE", `Object ${String(record.id)} references a missing parent object.`, {
          objectId: record.id,
          parentObjectId: record.parent.parentObjectId,
          kind: "parent",
        });
      }
      if (record.parent.linkId !== undefined && typeof record.parent.linkId !== "string") {
        fail("MALFORMED_REFERENCE", `Object ${String(record.id)} has an invalid parent link id.`, {
          objectId: record.id,
          kind: "parent",
        });
      }
    }
    if (type !== "sheet") {
      if (options.checkAssets !== false && record.assetId && !assetsById.has(String(record.assetId))) {
        fail("DANGLING_REFERENCE", `Object ${String(record.id)} references missing asset ${String(record.assetId)}.`, {
          objectId: record.id,
          assetId: record.assetId,
          kind: "asset",
        });
      }
      return;
    }

    const cells = cellRecords(record);
    cellCount += cells.length;
    if (cellCount > limits.maxCells) {
      fail("OVERSIZED_WORKSPACE", "The portable workspace contains too many cell records.", {
        cellCount,
        maxCells: limits.maxCells,
      });
    }
    cells.forEach(({ key, record: cell }) => {
      if (!isPlainRecord(cell)) {
        fail("MALFORMED_CELL", `Cell ${key} in ${String(record.id)} must be an object.`, {
          objectId: record.id,
          cellId: key,
        });
      }
      if (options.checkReferences === false) return;
      let reference = cell.embed?.objectId;
      if (!reference && typeof cell.embed === "string") reference = parseTactileLink(cell.embed)?.objectId;
      if (!reference && typeof cell.value === "string") reference = parseTactileLink(cell.value)?.objectId;
      if (cell.embed && !reference) {
        fail("MALFORMED_REFERENCE", `Cell ${key} in ${String(record.id)} has an invalid embed.`, {
          objectId: record.id,
          cellId: key,
        });
      }
      if (cell.embed && typeof cell.embed === "object") {
        if (cell.embed.linkId !== undefined && typeof cell.embed.linkId !== "string") {
          fail("MALFORMED_REFERENCE", `Cell ${key} in ${String(record.id)} has an invalid link id.`, {
            objectId: record.id,
            cellId: key,
            kind: "linkId",
          });
        }
        if (
          cell.embed.relation !== undefined
          && !["containment", "alias"].includes(String(cell.embed.relation))
        ) {
          fail("MALFORMED_REFERENCE", `Cell ${key} in ${String(record.id)} has an invalid relation.`, {
            objectId: record.id,
            cellId: key,
            kind: "relation",
          });
        }
      }
      if (reference && !objectsById.has(String(reference))) {
        fail("DANGLING_REFERENCE", `Cell ${key} in ${String(record.id)} references missing object ${String(reference)}.`, {
          objectId: record.id,
          cellId: key,
          reference,
          kind: "embed",
        });
      }
    });
  });

  return {
    version,
    objectCount: records.length,
    cellCount,
    assetCount: assets.length,
    totalAssetBytes,
  };
}
