import { BOOT_METADATA_KEY, MAX_BOOT_METADATA_BYTES } from "./constants.js";

function storageFor(storage) {
  if (storage !== undefined) return storage;
  return typeof globalThis !== "undefined" ? globalThis.localStorage : null;
}

export function readBootMetadata(storage, key = BOOT_METADATA_KEY) {
  const source = storageFor(storage);
  if (!source) return null;
  try {
    const value = source.getItem(key);
    if (!value) return null;
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeBootMetadata(metadata, storage, key = BOOT_METADATA_KEY) {
  const source = storageFor(storage);
  if (!source) return false;
  const value = JSON.stringify({
    version: 1,
    activeWorkspaceId: metadata?.activeWorkspaceId || null,
    acknowledgedRevision: metadata?.acknowledgedRevision || null,
    databaseName: metadata?.databaseName || null,
    switchedAt: metadata?.switchedAt || new Date().toISOString(),
  });
  if (value.length > MAX_BOOT_METADATA_BYTES) {
    throw new Error("Browser boot metadata exceeds its size limit.");
  }
  source.setItem(key, value);
  return true;
}

export function clearBootMetadata(storage, key = BOOT_METADATA_KEY) {
  const source = storageFor(storage);
  if (!source) return false;
  source.removeItem(key);
  return true;
}
