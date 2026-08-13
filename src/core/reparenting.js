import {
  cellAddress,
  cellId,
  coordinatesFromAddress,
  coordinatesFromCellId,
} from "../sheet/coordinates.js";
import { createCellRecord, isCellUsed } from "../model.js";
import {
  EMBED_RELATIONS,
  deterministicEmbedLinkId,
  repairObjectTopology,
  repairWorkspaceTopology,
} from "./topology.js";

export const REPARENT_REASONS = Object.freeze({
  MISSING_OBJECT: "missing-object",
  INVALID_SOURCE: "invalid-source",
  INVALID_TARGET: "invalid-target",
  TARGET_OUT_OF_BOUNDS: "target-out-of-bounds",
  TARGET_OCCUPIED: "target-occupied",
  NO_TARGET_SPACE: "no-target-space",
  CYCLE: "cycle",
  SAME_LOCATION: "same-location",
  LINK_COLLISION: "link-collision",
});

function text(value) {
  return value == null ? "" : String(value);
}

function coordinatesForReference(reference = {}) {
  return coordinatesFromCellId(reference.cellId || reference.targetCellId)
    || coordinatesFromAddress(reference.address || reference.targetAddress);
}

function inSheetBounds(sheet, coordinates) {
  return Boolean(
    coordinates
      && coordinates.row >= 0
      && coordinates.column >= 0
      && coordinates.row < Number(sheet?.rows || 0)
      && coordinates.column < Number(sheet?.columns || 0),
  );
}

function edgeMatchesSource(edge, source = {}) {
  return edge.objectId === text(source.objectId)
    && (!source.linkId || edge.linkId === text(source.linkId))
    && (!source.sourceObjectId || edge.sourceObjectId === text(source.sourceObjectId))
    && (!source.sourceCellId || edge.sourceCellId === text(source.sourceCellId))
    && (!source.sourceAddress || edge.sourceAddress === text(source.sourceAddress));
}

function sourceEdgeForTopology(repaired, object, objectId, source = {}) {
  const hasSourceLocation = Boolean(
    source.linkId
      || source.sourceObjectId
      || source.sourceCellId
      || source.sourceAddress,
  );
  const candidates = repaired.edges.filter((edge) => edge.objectId === objectId);
  if (hasSourceLocation) {
    return candidates.find((edge) => edgeMatchesSource(edge, { ...source, objectId })) || null;
  }
  if (object?.parent?.linkId) {
    return candidates.find((edge) => edge.linkId === text(object.parent.linkId)) || null;
  }
  if (object?.parent?.parentObjectId) {
    return candidates.find((edge) => (
      edge.sourceObjectId === text(object.parent.parentObjectId)
        && edge.sourceCellId === text(object.parent.parentCellId)
    )) || null;
  }
  return null;
}

function graphHasPath(edges, fromObjectId, toObjectId) {
  if (fromObjectId === toObjectId) return true;
  const outgoing = new Map();
  edges.forEach((edge) => {
    const next = outgoing.get(edge.sourceObjectId) || [];
    next.push(edge.objectId);
    outgoing.set(edge.sourceObjectId, next);
  });
  const visited = new Set([fromObjectId]);
  const pending = [fromObjectId];
  while (pending.length) {
    const current = pending.shift();
    for (const child of outgoing.get(current) || []) {
      if (child === toObjectId) return true;
      if (visited.has(child)) continue;
      visited.add(child);
      pending.push(child);
    }
  }
  return false;
}

function firstAvailableCell(sheet, excludedCellId = "") {
  for (let row = 0; row < Number(sheet?.rows || 0); row += 1) {
    for (let column = 0; column < Number(sheet?.columns || 0); column += 1) {
      const id = cellId(row, column);
      if (id === excludedCellId) continue;
      if (!isCellUsed(sheet.cells?.[id])) return { row, column };
    }
  }
  return null;
}

function nextLinkId(edges, parentObjectId, targetCellId, objectId) {
  const used = new Set(edges.map((edge) => edge.linkId));
  let suffix = "";
  let linkId = deterministicEmbedLinkId(parentObjectId, targetCellId, objectId);
  let attempt = 0;
  while (used.has(linkId)) {
    attempt += 1;
    suffix = String(attempt);
    linkId = deterministicEmbedLinkId(parentObjectId, targetCellId, objectId, suffix);
  }
  return linkId;
}

function failure(objects, reason) {
  return {
    ok: false,
    changed: false,
    reason,
    objects,
  };
}

export function reparentObjects(objects, input = {}) {
  const sourceObjects = objects && typeof objects === "object" ? objects : {};
  const objectId = text(input.objectId || input.source?.objectId);
  const object = sourceObjects[objectId];
  if (!objectId || !object) return failure(sourceObjects, REPARENT_REASONS.MISSING_OBJECT);

  const repaired = repairObjectTopology(sourceObjects);
  const source = { ...(input.source || {}), objectId };
  const sourceEdge = sourceEdgeForTopology(repaired, object, objectId, source);
  const hasSourceLocation = Boolean(
    source.linkId
      || source.sourceObjectId
      || source.sourceCellId
      || source.sourceAddress,
  );
  if (hasSourceLocation && !sourceEdge) return failure(sourceObjects, REPARENT_REASONS.INVALID_SOURCE);
  if (object.parent && !sourceEdge) return failure(sourceObjects, REPARENT_REASONS.INVALID_SOURCE);

  const target = input.target || {};
  const targetObjectId = text(target.parentObjectId || target.targetObjectId || target.objectId);
  const targetSheet = sourceObjects[targetObjectId];
  if (!targetObjectId || targetSheet?.type !== "sheet") {
    return failure(sourceObjects, REPARENT_REASONS.INVALID_TARGET);
  }

  if (graphHasPath(repaired.edges, objectId, targetObjectId)) {
    return failure(sourceObjects, REPARENT_REASONS.CYCLE);
  }

  const sourceCellId = sourceEdge?.sourceCellId || "";
  let coordinates = coordinatesForReference(target);
  if (!coordinates) coordinates = firstAvailableCell(targetSheet, sourceEdge?.sourceObjectId === targetObjectId ? sourceCellId : "");
  if (!coordinates) return failure(sourceObjects, REPARENT_REASONS.NO_TARGET_SPACE);
  if (!inSheetBounds(targetSheet, coordinates)) {
    return failure(sourceObjects, REPARENT_REASONS.TARGET_OUT_OF_BOUNDS);
  }

  const targetCellId = cellId(coordinates.row, coordinates.column);
  if (sourceEdge?.sourceObjectId === targetObjectId && sourceCellId === targetCellId) {
    return failure(sourceObjects, REPARENT_REASONS.SAME_LOCATION);
  }
  if (isCellUsed(targetSheet.cells?.[targetCellId])) {
    return failure(sourceObjects, REPARENT_REASONS.TARGET_OCCUPIED);
  }

  const canonicalEdge = repaired.canonicalByChild.get(objectId);
  const movesCanonicalLocation = !sourceEdge || canonicalEdge?.linkId === sourceEdge.linkId;
  const relation = movesCanonicalLocation
    ? EMBED_RELATIONS.CONTAINMENT
    : (sourceEdge.relation || EMBED_RELATIONS.ALIAS);
  const linkId = sourceEdge?.linkId || nextLinkId(repaired.edges, targetObjectId, targetCellId, objectId);
  if (repaired.edges.some((edge) => edge.linkId === linkId && edge.linkId !== sourceEdge?.linkId)) {
    return failure(sourceObjects, REPARENT_REASONS.LINK_COLLISION);
  }

  const sourceCell = sourceEdge
    ? sourceObjects[sourceEdge.sourceObjectId]?.cells?.[sourceEdge.sourceCellId]
    : null;
  const targetCell = createCellRecord(coordinates.row, coordinates.column, {
    ...(sourceCell || {}),
    id: targetCellId,
    address: cellAddress(coordinates.row, coordinates.column),
    row: coordinates.row,
    column: coordinates.column,
    value: object.title || "",
    formula: "",
    embed: {
      ...(sourceCell?.embed || {}),
      objectId,
      type: sourceCell?.embed?.type || object.type,
      linkId,
      relation,
    },
  });

  const nextObjects = { ...sourceObjects };
  if (sourceEdge) {
    const sourceSheet = sourceObjects[sourceEdge.sourceObjectId];
    const sourceCells = { ...(sourceSheet?.cells || {}) };
    delete sourceCells[sourceEdge.sourceCellId];
    nextObjects[sourceEdge.sourceObjectId] = { ...sourceSheet, cells: sourceCells };
  }
  const targetCells = { ...(nextObjects[targetObjectId]?.cells || {}), [targetCellId]: targetCell };
  nextObjects[targetObjectId] = { ...nextObjects[targetObjectId], cells: targetCells };
  if (movesCanonicalLocation) {
    nextObjects[objectId] = {
      ...object,
      parent: {
        linkId,
        parentObjectId: targetObjectId,
        parentCellId: targetCellId,
        sourceAddress: targetCell.address,
      },
    };
  }

  const finalTopology = repairObjectTopology(nextObjects);
  const finalEdge = finalTopology.edges.find((edge) => edge.linkId === linkId && edge.objectId === objectId);
  return {
    ok: true,
    changed: true,
    reason: null,
    objects: finalTopology.objects,
    objectId,
    sourceEdge,
    targetEdge: finalEdge || {
      linkId,
      relation,
      objectId,
      sourceObjectId: targetObjectId,
      sourceCellId: targetCellId,
      sourceAddress: targetCell.address,
    },
    linkId,
    targetObjectId,
    targetCellId,
    targetAddress: targetCell.address,
    relation,
  };
}

export function reparentWorkspace(workspace, input = {}) {
  const result = reparentObjects(workspace?.objects || {}, input);
  if (!result.ok) return { ...result, workspace };
  const nextWorkspace = repairWorkspaceTopology({
    ...workspace,
    updatedAt: new Date().toISOString(),
    objects: result.objects,
  });
  const finalEdge = repairObjectTopology(nextWorkspace.objects).edges
    .find((edge) => edge.linkId === result.linkId && edge.objectId === result.objectId);
  return {
    ...result,
    workspace: nextWorkspace,
    objects: nextWorkspace.objects,
    targetEdge: finalEdge || result.targetEdge,
  };
}

export function reparentReasonMessage(reason) {
  const messages = {
    [REPARENT_REASONS.MISSING_OBJECT]: "That object is no longer available.",
    [REPARENT_REASONS.INVALID_SOURCE]: "The object source is no longer valid.",
    [REPARENT_REASONS.INVALID_TARGET]: "Objects can only be placed in a Tiles sheet.",
    [REPARENT_REASONS.TARGET_OUT_OF_BOUNDS]: "That sheet position is outside the sheet.",
    [REPARENT_REASONS.TARGET_OCCUPIED]: "That sheet position is already in use.",
    [REPARENT_REASONS.NO_TARGET_SPACE]: "There is no open sheet position there.",
    [REPARENT_REASONS.CYCLE]: "An object cannot be placed inside itself or its descendants.",
    [REPARENT_REASONS.SAME_LOCATION]: "The object is already at that location.",
    [REPARENT_REASONS.LINK_COLLISION]: "That move would duplicate an embedded link.",
  };
  return messages[reason] || "That object could not be moved.";
}
