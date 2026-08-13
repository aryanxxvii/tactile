function withoutKeys(record, keys) {
  if (!record || typeof record !== "object") return {};
  return Object.fromEntries(Object.entries(record).filter(([key]) => !keys.has(key)));
}

export function workspaceKey(workspaceId) {
  return String(workspaceId);
}

export function objectKey(workspaceId, objectId) {
  return [String(workspaceId), String(objectId)];
}

export function cellKey(workspaceId, objectId, cellId) {
  return [String(workspaceId), String(objectId), String(cellId)];
}

export function assetKey(workspaceId, assetId) {
  return [String(workspaceId), String(assetId)];
}

export function themeKey(workspaceId, themeId) {
  return [String(workspaceId), String(themeId)];
}

export function workspaceMetaRecord(workspace, revision = null, storageState = "active") {
  const { objects: _objects, assets: _assets, themes: _themes, ...meta } = workspace || {};
  return {
    ...meta,
    workspaceId: String(workspace?.id || meta.id || ""),
    acknowledgedRevision: revision || workspace?.acknowledgedRevision || null,
    storageState,
  };
}

export function objectRecord(workspaceId, object) {
  const { cells: _cells, workspaceId: _workspaceId, objectId: _objectId, ...record } = object || {};
  return {
    ...record,
    workspaceId: String(workspaceId),
    objectId: String(object?.id || record.id || ""),
  };
}

export function cellRecord(workspaceId, objectId, cell) {
  const { workspaceId: _workspaceId, objectId: _objectId, cellId: _cellId, ...record } = cell || {};
  return {
    ...record,
    workspaceId: String(workspaceId),
    objectId: String(objectId),
    cellId: String(cell?.id || record.id || ""),
  };
}

export function assetMetadata(asset) {
  return withoutKeys(asset, new Set(["workspaceId", "assetId", "blob", "data", "dataUrl", "bytes"]));
}

export function assetRecord(workspaceId, assetId, metadata, blob = null) {
  return {
    ...assetMetadata(metadata),
    id: String(metadata?.id || assetId),
    workspaceId: String(workspaceId),
    assetId: String(assetId || metadata?.id || ""),
    ...(blob ? { blob } : {}),
  };
}

export function themeRecord(workspaceId, theme) {
  const { workspaceId: _workspaceId, themeId: _themeId, ...record } = theme || {};
  return {
    ...record,
    id: String(theme?.id || theme?.themeId || ""),
    workspaceId: String(workspaceId),
    themeId: String(theme?.id || theme?.themeId || ""),
  };
}

export function workspaceMetaFromRecord(record) {
  return withoutKeys(record, new Set(["workspaceId", "acknowledgedRevision", "storageState"]));
}

export function objectFromRecord(record) {
  return withoutKeys(record, new Set(["workspaceId", "objectId"]));
}

export function cellFromRecord(record) {
  return withoutKeys(record, new Set(["workspaceId", "objectId", "cellId"]));
}

export function assetFromRecord(record) {
  return withoutKeys(record, new Set(["workspaceId", "assetId", "blob"]));
}

export function themeFromRecord(record) {
  return withoutKeys(record, new Set(["workspaceId", "themeId"]));
}
