import { getObjectTypeDefinition } from "../objects/registry/index.js";
import {
  pathEntryForEdge,
  repairObjectTopology,
  TOPOLOGY_REVISION,
} from "../core/topology.js";

const FILE_TYPES = new Set(["pdf", "image", "video", "html", "svg"]);

function compareText(left, right) {
  return String(left || "").localeCompare(String(right || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function typeCategory(type) {
  if (type === "sheet") return "tiles";
  if (type === "markdown" || type === "document") return "text";
  if (FILE_TYPES.has(type)) return "files";
  return "other";
}

function filesTypeLabel(type, definition) {
  return type === "sheet" ? "Tiles" : definition?.label || type || "Object";
}

function titleFor(objects, objectId) {
  return objects?.[objectId]?.title || "Untitled object";
}

function locationForPath(objects, path, fallbackObjectId) {
  const rootObjectId = path?.rootObjectId || fallbackObjectId;
  const titles = [titleFor(objects, rootObjectId)];
  (path?.segments || []).forEach((segment) => titles.push(titleFor(objects, segment.objectId)));
  return {
    rootObjectId,
    segments: (path?.segments || []).map((segment, index, list) => ({
      ...segment,
      mode: index === list.length - 1 ? "full" : "full",
    })),
    pathLabel: titles.join(" / "),
    pathTitles: titles,
  };
}

function pathForObject(objects, objectId, edgeByLink, parentByObject) {
  if (!objects?.[objectId]) return null;
  const segments = [];
  const visited = new Set();
  let currentId = String(objectId);
  while (currentId) {
    if (visited.has(currentId)) return null;
    visited.add(currentId);
    const parent = parentByObject.get(currentId) || objects[currentId]?.parent;
    if (!parent) break;
    const edge = edgeByLink.get(String(parent.linkId));
    if (!edge || edge.objectId !== currentId || edge.sourceObjectId !== String(parent.parentObjectId)) return null;
    segments.unshift(pathEntryForEdge(edge));
    currentId = edge.sourceObjectId;
  }
  return { rootObjectId: currentId || String(objectId), segments };
}

function matchScore(entry, query) {
  if (!query) return 0;
  const normalized = normalizeSearchText(query);
  const tokens = normalized.split(" ").filter(Boolean);
  const title = entry.searchTitle;
  const fileName = entry.searchFileName;
  const path = entry.searchPath;
  const type = entry.searchType;
  const id = entry.searchId;
  const fields = [title, fileName, path, type, id];
  if (!tokens.every((token) => fields.some((field) => field.includes(token)))) return -1;

  if (title === normalized) return 1000;
  if (title.startsWith(normalized)) return 900;
  if (tokens.some((token) => title.split(" ").some((part) => part.startsWith(token)))) return 800;
  if (fileName && fileName.includes(normalized)) return 700;
  if (path.includes(normalized)) return 600;
  if (type.includes(normalized)) return 500;
  if (id === normalized) return 300;
  return 200;
}

function sortObjectIds(objects, ids, homeObjectId = "") {
  return [...ids].sort((left, right) => (
    (left === homeObjectId ? -1 : 0) - (right === homeObjectId ? -1 : 0)
    || compareText(titleFor(objects, left), titleFor(objects, right))
    || compareText(left, right)
  ));
}

/**
 * Build the disposable read model used by the Files drawer. The index stores
 * titles, routes, and searchable metadata only; it never retains cell maps or
 * binary payloads. It is therefore safe to rebuild after a workspace change.
 */
export function buildFilesIndex(workspace, previousIndex = null) {
  const objects = workspace?.objects || {};
  const topologyRevision = workspace?.[TOPOLOGY_REVISION] || 0;
  const topology = previousIndex?.topologyRevision === topologyRevision
    ? previousIndex.topology
    : (() => {
      const repaired = repairObjectTopology(objects);
      const edges = repaired.edges || [];
      const edgeByLink = new Map(edges.map((edge) => [String(edge.linkId), edge]));
      const canonicalByChild = repaired.canonicalByChild || new Map();
      const canonicalChildren = new Map();
      const aliasesByParent = new Map();
      const aliasEdgesByObject = new Map();
      const parentByObject = new Map(Object.entries(repaired.objects || {})
        .map(([objectId, object]) => [objectId, object.parent || null]));

      Object.keys(objects).forEach((objectId) => {
        canonicalChildren.set(objectId, []);
        aliasesByParent.set(objectId, []);
      });
      canonicalByChild.forEach((edge, objectId) => {
        const children = canonicalChildren.get(edge.sourceObjectId) || [];
        children.push(String(objectId));
        canonicalChildren.set(edge.sourceObjectId, children);
      });
      edges.forEach((edge) => {
        if (canonicalByChild.get(edge.objectId)?.linkId === edge.linkId) return;
        const aliases = aliasesByParent.get(edge.sourceObjectId) || [];
        aliases.push(edge);
        aliasesByParent.set(edge.sourceObjectId, aliases);
        const locations = aliasEdgesByObject.get(edge.objectId) || [];
        locations.push(edge);
        aliasEdgesByObject.set(edge.objectId, locations);
      });
      const roots = Object.keys(objects).filter((objectId) => !canonicalByChild.has(objectId));
      return {
        edges,
        edgeByLink,
        canonicalByChild,
        canonicalChildren,
        aliasesByParent,
        aliasEdgesByObject,
        parentByObject,
        roots,
      };
    })();
  const {
    edgeByLink,
    canonicalByChild,
    canonicalChildren,
    aliasesByParent,
    aliasEdgesByObject,
    parentByObject,
  } = topology;
  const homeObjectIds = new Set(Object.entries(objects)
    .filter(([objectId, object]) => (
      objectId === "home"
      || (object?.type === "sheet" && object?.title === "Home" && !parentByObject.get(objectId))
    ))
    .map(([objectId]) => objectId));
  const protectedObjectIds = new Set(homeObjectIds);
  let protectedId = String(workspace?.homeObjectId || "");
  while (protectedId && !protectedObjectIds.has(protectedId)) {
    protectedObjectIds.add(protectedId);
    protectedId = canonicalByChild.get(protectedId)?.sourceObjectId || "";
  }
  const entries = [];

  const roots = sortObjectIds(
    objects,
    topology.roots,
    workspace?.homeObjectId,
  );

  Object.keys(objects).sort(compareText).forEach((objectId) => {
    const object = objects[objectId];
    const definition = getObjectTypeDefinition(object?.type);
    const asset = object?.assetId ? workspace?.assets?.[object.assetId] : null;
    const canonicalPath = locationForPath(
      objects,
      pathForObject(objects, objectId, edgeByLink, parentByObject),
      objectId,
    );
    const aliases = (aliasEdgesByObject.get(objectId) || [])
      .map((edge) => {
        const parentPath = locationForPath(
          objects,
          pathForObject(objects, edge.sourceObjectId, edgeByLink, parentByObject),
          edge.sourceObjectId,
        );
        return locationForPath(objects, {
          rootObjectId: parentPath.rootObjectId,
          segments: [...parentPath.segments, pathEntryForEdge(edge)],
        }, objectId);
      })
      .sort((left, right) => compareText(left.pathLabel, right.pathLabel));
    const pathLabels = [canonicalPath.pathLabel, ...aliases.map((location) => location.pathLabel)];
    const fileName = asset?.fileName || object?.fileName || "";
    const title = object?.title || "Untitled object";
    const isRoot = topology.roots.includes(objectId);
    const isStart = objectId === workspace?.homeObjectId;
    const isHome = homeObjectIds.has(objectId);
    const deleteBlocked = protectedObjectIds.has(objectId);
    entries.push({
      objectId,
      title,
      type: object?.type || "unknown",
      typeLabel: filesTypeLabel(object?.type, definition),
      iconEmoji: object?.iconEmoji || "",
      iconColor: object?.iconColor || "",
      category: typeCategory(object?.type),
      fileName,
      isRoot,
      isStart,
      isHome,
      canDelete: !deleteBlocked,
      deleteReason: deleteBlocked
        ? isStart
          ? "Current start"
          : isHome
            ? "Home"
            : "Contains current start"
        : "",
      canonical: canonicalPath,
      aliases,
      locations: [canonicalPath, ...aliases],
      searchTitle: normalizeSearchText(title),
      searchFileName: normalizeSearchText(fileName),
      searchPath: normalizeSearchText(pathLabels.join(" ")),
      searchType: normalizeSearchText(`${definition?.label || ""} ${object?.type || ""} ${object?.type === "sheet" ? "tiles" : ""}`),
      searchId: normalizeSearchText(objectId),
    });
  });

  const entryByObjectId = new Map(entries.map((entry) => [entry.objectId, entry]));
  canonicalChildren.forEach((children, parentId) => {
    canonicalChildren.set(parentId, sortObjectIds(objects, children, workspace?.homeObjectId));
  });
  aliasesByParent.forEach((aliases, parentId) => {
    aliasesByParent.set(parentId, aliases.sort((left, right) => (
      compareText(titleFor(objects, left.objectId), titleFor(objects, right.objectId))
      || compareText(left.sourceAddress, right.sourceAddress)
      || compareText(left.linkId, right.linkId)
    )));
  });

  const index = {
    entries,
    entryByObjectId,
    canonicalChildren,
    aliasesByParent,
    roots,
    protectedObjectIds,
    edgeByLink,
    revision: workspace?.updatedAt || "",
    topologyRevision,
    topology,
    search(query, category = "all", limit = 100) {
      const normalizedCategory = String(category || "all").toLowerCase();
      return entries
        .filter((entry) => normalizedCategory === "all" || entry.category === normalizedCategory)
        .map((entry) => ({ entry, score: matchScore(entry, query) }))
        .filter(({ score }) => score >= 0)
        .sort((left, right) => right.score - left.score || compareText(left.entry.title, right.entry.title) || compareText(left.entry.objectId, right.entry.objectId))
        .slice(0, limit)
        .map(({ entry, score }) => ({ ...entry, score }));
    },
  };

  return index;
}

export function searchFilesIndex(index, query, category = "all", limit = 100) {
  return index?.search ? index.search(query, category, limit) : [];
}

export function validateObjectTitle(index, objectId, value) {
  const title = String(value ?? "").trim();
  const normalizedTitle = normalizeSearchText(title);
  if (!normalizedTitle) {
    return {
      valid: false,
      code: "empty",
      title,
      message: "Name cannot be empty.",
    };
  }

  const duplicate = index?.entries?.find((entry) => (
    entry.objectId !== String(objectId)
      && normalizeSearchText(entry.title) === normalizedTitle
  ));
  if (duplicate) {
    return {
      valid: false,
      code: "duplicate",
      title,
      duplicateObjectId: duplicate.objectId,
      message: `An object named "${duplicate.title}" already exists.`,
    };
  }

  return { valid: true, code: "", title, message: "" };
}

export function fileRouteForObject(index, objectId, locationIndex = 0) {
  const entry = index?.entryByObjectId?.get(String(objectId));
  return entry?.locations?.[locationIndex] || null;
}
