import {
  cellAddress,
  cellId,
  coordinatesFromAddress,
  coordinatesFromCellId,
} from "../sheet/coordinates.js";

export const EMBED_RELATIONS = Object.freeze({
  CONTAINMENT: "containment",
  ALIAS: "alias",
});

// Runtime-only revision. Symbols are ignored by JSON/portable serialization,
// while ordinary cell edits can preserve it so read models know whether they
// need to rebuild the containment graph.
export const TOPOLOGY_REVISION = Symbol.for("tactile.topologyRevision");

export const ROUTE_VERSION = 1;

function compareText(left, right) {
  const leftText = String(left || "");
  const rightText = String(right || "");
  return leftText === rightText ? 0 : leftText < rightText ? -1 : 1;
}

function hashText(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function deterministicEmbedLinkId(parentObjectId, parentCellId, childObjectId, suffix = "") {
  const seed = [parentObjectId, parentCellId, childObjectId, suffix].map(String).join("|");
  return `link-${hashText(seed)}`;
}

function coordinatesForCell(cell, fallbackId) {
  if (Number.isInteger(cell?.row) && Number.isInteger(cell?.column)) {
    return { row: cell.row, column: cell.column };
  }
  return coordinatesFromCellId(cell?.id || fallbackId)
    || coordinatesFromAddress(cell?.address || fallbackId);
}

function relationForEmbed(embed) {
  return embed?.relation === EMBED_RELATIONS.ALIAS
    ? EMBED_RELATIONS.ALIAS
    : EMBED_RELATIONS.CONTAINMENT;
}

function edgeSort(left, right) {
  return compareText(left.sourceObjectId, right.sourceObjectId)
    || left.row - right.row
    || left.column - right.column
    || compareText(left.objectId, right.objectId)
    || compareText(left.linkId, right.linkId);
}

function candidateMatchesParent(candidate, parent) {
  if (!parent || typeof parent !== "object") return false;
  if (parent.linkId && String(parent.linkId) === candidate.linkId) return true;
  const parentObjectId = String(parent.parentObjectId || parent.sourceObjectId || "");
  const parentCellId = String(parent.parentCellId || parent.sourceCellId || "");
  const parentAddress = String(parent.sourceAddress || "");
  return parentObjectId === candidate.sourceObjectId
    && (!parentCellId || parentCellId === candidate.sourceCellId)
    && (!parentAddress || parentAddress === candidate.sourceAddress);
}

function cycleWouldForm(canonicalByChild, childObjectId, parentObjectId) {
  const visited = new Set([childObjectId]);
  let current = parentObjectId;
  while (current) {
    if (visited.has(current)) return true;
    visited.add(current);
    current = canonicalByChild.get(current)?.sourceObjectId || "";
  }
  return false;
}

function edgePathEntry(edge) {
  return {
    objectId: edge.objectId,
    sourceObjectId: edge.sourceObjectId,
    sourceCellId: edge.sourceCellId,
    sourceAddress: edge.sourceAddress,
    linkId: edge.linkId,
  };
}

function sameParent(left, right) {
  return Boolean(left) === Boolean(right)
    && (!left || (
      String(left.linkId || "") === String(right.linkId || "")
      && String(left.parentObjectId || "") === String(right.parentObjectId || "")
      && String(left.parentCellId || "") === String(right.parentCellId || "")
      && String(left.sourceAddress || "") === String(right.sourceAddress || "")
    ));
}

/**
 * Build and repair the durable object containment graph.
 *
 * Cells remain the source of truth for the visible location of a link, while
 * object.parent and embed.linkId make the relationship directly inspectable.
 * Legacy workspaces without link ids are repaired deterministically.
 */
export function repairObjectTopology(objects = {}, { preferredPath = [] } = {}) {
  const sourceObjects = objects && typeof objects === "object" ? objects : {};
  const objectIds = Object.keys(sourceObjects).sort(compareText);
  const objectById = new Map(objectIds.map((id) => [id, sourceObjects[id]]));
  const usedLinkIds = new Set();
  const edges = [];
  const cellUpdates = new Map();
  const report = {
    generatedLinkIds: [],
    repairedParents: [],
    aliases: [],
    cycles: [],
    danglingLinks: [],
    orphans: [],
  };

  objectIds.forEach((sourceObjectId) => {
    const sourceObject = objectById.get(sourceObjectId);
    if (sourceObject?.type !== "sheet") return;
    Object.entries(sourceObject.cells || {})
      .sort(([leftId, left], [rightId, right]) => (
        (coordinatesForCell(left, leftId)?.row ?? Number.MAX_SAFE_INTEGER)
          - (coordinatesForCell(right, rightId)?.row ?? Number.MAX_SAFE_INTEGER)
        || (coordinatesForCell(left, leftId)?.column ?? Number.MAX_SAFE_INTEGER)
          - (coordinatesForCell(right, rightId)?.column ?? Number.MAX_SAFE_INTEGER)
        || compareText(leftId, rightId)
      ))
      .forEach(([fallbackCellId, cell]) => {
        const embed = cell?.embed;
        if (!embed?.objectId) return;
        const childObjectId = String(embed.objectId);
        const coordinates = coordinatesForCell(cell, fallbackCellId);
        if (!coordinates) return;
        const sourceCellId = cellId(coordinates.row, coordinates.column);
        const sourceAddress = cellAddress(coordinates.row, coordinates.column);
        if (!objectById.has(childObjectId)) {
          report.danglingLinks.push({ sourceObjectId, sourceCellId, objectId: childObjectId });
          return;
        }

        const baseLinkId = String(embed.linkId || deterministicEmbedLinkId(
          sourceObjectId,
          sourceCellId,
          childObjectId,
        ));
        let linkId = baseLinkId;
        let collision = 0;
        while (usedLinkIds.has(linkId)) {
          collision += 1;
          linkId = deterministicEmbedLinkId(sourceObjectId, sourceCellId, childObjectId, String(collision));
        }
        usedLinkIds.add(linkId);
        if (!embed.linkId || String(embed.linkId) !== linkId) {
          cellUpdates.set(`${sourceObjectId}:${sourceCellId}`, {
            sourceObjectId,
            sourceCellId,
            embed: {
              ...embed,
              linkId,
              relation: relationForEmbed(embed),
            },
          });
          if (!embed.linkId) report.generatedLinkIds.push(linkId);
        } else if (embed.relation !== EMBED_RELATIONS.CONTAINMENT && embed.relation !== EMBED_RELATIONS.ALIAS) {
          cellUpdates.set(`${sourceObjectId}:${sourceCellId}`, {
            sourceObjectId,
            sourceCellId,
            embed: { ...embed, relation: relationForEmbed(embed) },
          });
        }
        edges.push({
          linkId,
          relation: relationForEmbed(embed),
          objectId: childObjectId,
          sourceObjectId,
          sourceCellId,
          sourceAddress,
          row: coordinates.row,
          column: coordinates.column,
          type: String(embed.type || objectById.get(childObjectId)?.type || "markdown"),
        });
      });
  });

  const preferred = Array.isArray(preferredPath) ? preferredPath : [];
  const incoming = new Map();
  edges.forEach((edge) => {
    const list = incoming.get(edge.objectId) || [];
    list.push(edge);
    incoming.set(edge.objectId, list);
  });

  const canonicalByChild = new Map();
  objectIds.forEach((childObjectId) => {
    const candidates = (incoming.get(childObjectId) || []).map((edge) => {
      const object = objectById.get(childObjectId);
      const explicit = candidateMatchesParent(edge, object?.parent);
      const preferredIndex = preferred.findIndex((entry) => (
        (entry?.linkId && String(entry.linkId) === edge.linkId)
        || (
          String(entry?.objectId || "") === edge.objectId
          && String(entry?.sourceObjectId || "") === edge.sourceObjectId
          && String(entry?.sourceAddress || "") === edge.sourceAddress
        )
      ));
      return {
        edge,
        rank: explicit ? 0 : preferredIndex >= 0 ? 1 : edge.relation === EMBED_RELATIONS.CONTAINMENT ? 2 : 3,
        preferredIndex: preferredIndex >= 0 ? preferredIndex : Number.MAX_SAFE_INTEGER,
      };
    }).sort((left, right) => (
      left.rank - right.rank
      || left.preferredIndex - right.preferredIndex
      || edgeSort(left.edge, right.edge)
    ));

    const selected = candidates.find(({ edge }) => !cycleWouldForm(
      canonicalByChild,
      childObjectId,
      edge.sourceObjectId,
    ));
    if (selected) {
      canonicalByChild.set(childObjectId, selected.edge);
      if (selected.edge.relation === EMBED_RELATIONS.ALIAS || selected.rank > 2) {
        report.repairedParents.push({ objectId: childObjectId, linkId: selected.edge.linkId });
      }
    } else if (candidates.length) {
      report.cycles.push({ objectId: childObjectId, links: candidates.map(({ edge }) => edge.linkId) });
    }

    candidates.forEach(({ edge }) => {
      if (!selected || edge.linkId !== selected.edge.linkId) {
        report.aliases.push(edge.linkId);
      }
    });
  });

  const repairedObjects = { ...sourceObjects };
  const changedObjectIds = new Set();
  const updatedCells = new Map();

  cellUpdates.forEach((update) => {
    updatedCells.set(update.sourceObjectId, {
      ...(updatedCells.get(update.sourceObjectId) || {}),
      [update.sourceCellId]: update.embed,
    });
  });

  edges.forEach((edge) => {
    const selected = canonicalByChild.get(edge.objectId);
    const relation = selected?.linkId === edge.linkId
      ? EMBED_RELATIONS.CONTAINMENT
      : EMBED_RELATIONS.ALIAS;
    const sourceObject = repairedObjects[edge.sourceObjectId];
    const sourceCell = sourceObject?.cells?.[edge.sourceCellId];
    if (!sourceCell?.embed) return;
    const nextEmbed = {
      ...sourceCell.embed,
      objectId: edge.objectId,
      type: sourceCell.embed.type || edge.type,
      linkId: edge.linkId,
      relation,
    };
    const previousEmbed = sourceCell.embed;
    if (
      previousEmbed.linkId !== nextEmbed.linkId
      || previousEmbed.relation !== nextEmbed.relation
      || previousEmbed.objectId !== nextEmbed.objectId
      || previousEmbed.type !== nextEmbed.type
    ) {
      updatedCells.set(edge.sourceObjectId, {
        ...(updatedCells.get(edge.sourceObjectId) || {}),
        [edge.sourceCellId]: nextEmbed,
      });
    }
  });

  updatedCells.forEach((cells, sourceObjectId) => {
    const object = repairedObjects[sourceObjectId];
    const nextCells = { ...(object?.cells || {}) };
    Object.entries(cells).forEach(([sourceCellId, embed]) => {
      if (nextCells[sourceCellId]) nextCells[sourceCellId] = { ...nextCells[sourceCellId], embed };
    });
    repairedObjects[sourceObjectId] = { ...object, cells: nextCells };
    changedObjectIds.add(sourceObjectId);
  });

  objectIds.forEach((objectId) => {
    const object = repairedObjects[objectId];
    if (!object) return;
    const selected = canonicalByChild.get(objectId);
    const nextParent = selected
      ? {
          linkId: selected.linkId,
          parentObjectId: selected.sourceObjectId,
          parentCellId: selected.sourceCellId,
          sourceAddress: selected.sourceAddress,
        }
      : null;
    if (!sameParent(object.parent, nextParent)) {
      repairedObjects[objectId] = { ...object, parent: nextParent };
      changedObjectIds.add(objectId);
    }
    if (!selected && (incoming.get(objectId) || []).length === 0) report.orphans.push(objectId);
  });

  const repairedEdges = edges.map((edge) => ({
    ...edge,
    relation: canonicalByChild.get(edge.objectId)?.linkId === edge.linkId
      ? EMBED_RELATIONS.CONTAINMENT
      : EMBED_RELATIONS.ALIAS,
  }));

  return {
    objects: repairedObjects,
    edges: repairedEdges,
    canonicalByChild,
    changedObjectIds: [...changedObjectIds],
    report,
  };
}

export function repairWorkspaceTopology(workspace, options = {}) {
  const repaired = repairObjectTopology(workspace?.objects || {}, {
    // Home is launch metadata, never a containment preference. A saved home
    // route may still be validated below, including an intentional alias, but
    // changing Home must not reorder the canonical Files hierarchy.
    preferredPath: options.preferredPath || [],
  });
  const result = {
    ...workspace,
    objects: repaired.objects,
    [TOPOLOGY_REVISION]: (workspace?.[TOPOLOGY_REVISION] || 0) + 1,
  };
  if (Array.isArray(workspace?.homePath) && workspace?.homeObjectId) {
    result.homePath = canonicalizePathForTopology(
      repaired,
      workspace.homeObjectId,
      workspace.homePath,
    );
  }
  if (options.includeReport) result.topologyReport = repaired.report;
  return result;
}

export function topologyForObjects(objects) {
  return repairObjectTopology(objects).edges;
}

export function findEmbeddedEdge(objects, reference = {}) {
  const edges = topologyForObjects(objects);
  return findEdgeInList(edges, reference);
}

function findEdgeInList(edges, reference = {}) {
  const matchesIdentity = (edge) => (
    (!reference.objectId || edge.objectId === String(reference.objectId))
    && (!reference.sourceObjectId || edge.sourceObjectId === String(reference.sourceObjectId))
    && (
      !reference.sourceCellId
      || edge.sourceCellId === String(reference.sourceCellId)
      || edge.sourceAddress === String(reference.sourceCellId)
    )
    && (!reference.sourceAddress || edge.sourceAddress === String(reference.sourceAddress))
  );
  if (reference.linkId) {
    const exact = edges.find((edge) => edge.linkId === String(reference.linkId));
    return exact && matchesIdentity(exact) ? exact : null;
  }
  return edges.find(matchesIdentity);
}

function canonicalPathFromTopology(repaired, targetObjectId) {
  if (!repaired?.objects?.[targetObjectId]) return null;
  const edges = repaired.edges;
  const byLink = new Map(edges.map((edge) => [edge.linkId, edge]));
  const path = [];
  const visited = new Set();
  let currentId = String(targetObjectId);
  while (currentId) {
    if (visited.has(currentId)) return null;
    visited.add(currentId);
    const parent = repaired.objects[currentId]?.parent;
    if (!parent) break;
    const edge = byLink.get(String(parent.linkId));
    if (!edge || edge.objectId !== currentId || edge.sourceObjectId !== String(parent.parentObjectId)) return null;
    path.unshift(edgePathEntry(edge));
    currentId = edge.sourceObjectId;
  }
  return path;
}

function validateRouteAgainstTopology(repaired, segments = []) {
  if (!Array.isArray(segments)) return { stack: [], valid: false, reason: "route-not-array" };
  const normalized = [];
  const visited = new Set();
  let parentObjectId = null;
  for (const segment of segments) {
    const edge = findEdgeInList(repaired.edges, {
      linkId: segment?.linkId,
      objectId: segment?.objectId,
      sourceObjectId: segment?.sourceObjectId,
      sourceCellId: segment?.sourceCellId,
      sourceAddress: segment?.sourceAddress,
    });
    if (!edge) return { stack: normalized, valid: false, reason: "missing-edge" };
    if (parentObjectId && edge.sourceObjectId !== parentObjectId) {
      return { stack: normalized, valid: false, reason: "non-adjacent-edge" };
    }
    if (visited.has(edge.objectId) || edge.objectId === edge.sourceObjectId) {
      return { stack: normalized, valid: false, reason: "route-cycle" };
    }
    visited.add(edge.objectId);
    const normalizedSegment = edgePathEntry(edge);
    if (segment?.mode) normalizedSegment.mode = segment.mode === "full" ? "full" : "floating";
    normalized.push(normalizedSegment);
    parentObjectId = edge.objectId;
  }
  return { stack: normalized, valid: true, reason: null };
}

function canonicalizePathForTopology(repaired, targetObjectId, segments) {
  const validated = validateRouteAgainstTopology(repaired, segments);
  if (validated.valid && validated.stack.at(-1)?.objectId === String(targetObjectId)) {
    const firstSourceObjectId = validated.stack[0]?.sourceObjectId;
    const prefix = firstSourceObjectId
      ? canonicalPathFromTopology(repaired, firstSourceObjectId) || []
      : [];
    const combined = validateRouteAgainstTopology(repaired, [...prefix, ...validated.stack]);
    if (combined.valid && combined.stack.at(-1)?.objectId === String(targetObjectId)) {
      return combined.stack.map(edgePathEntry);
    }
  }
  return canonicalPathFromTopology(repaired, targetObjectId) || [];
}

export function canonicalPathForObject(objects, targetObjectId) {
  if (!objects?.[targetObjectId]) return null;
  const repaired = repairObjectTopology(objects);
  return canonicalPathFromTopology(repaired, targetObjectId);
}

export function validateNavigationRoute(objects, segments = []) {
  return validateRouteAgainstTopology(repairObjectTopology(objects), segments);
}

export function routeFromLinkIds(objects, linkIds = [], topMode = "floating") {
  const ids = Array.isArray(linkIds) ? linkIds.filter(Boolean) : [];
  const segments = ids.map((linkId, index) => ({
    linkId,
    mode: index === ids.length - 1 ? topMode : "full",
  }));
  return validateNavigationRoute(objects, segments);
}

export function pathEntryForEdge(edge) {
  return edgePathEntry(edge);
}
