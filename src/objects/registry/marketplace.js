import * as React from "react";
import { createId } from "../../model.js";
import { TACTILE_CHANNEL } from "../../buildRevision.js";

const DATABASE_NAME = "tactile-plugin-cache";
const DATABASE_VERSION = 1;
const STORE_NAME = "plugins";
const CATALOG_STORAGE_KEY = "tactile.marketplace.catalogUrl";
export const LOCAL_MARKETPLACE_CATALOG_URL = "/marketplace/catalog.json";
export const HOSTED_MARKETPLACE_CATALOG_URL = "https://raw.githubusercontent.com/aryanxxvii/tactile/main/marketplace/dist/catalog.json";

export function hostedMarketplaceCatalogUrl(channel = TACTILE_CHANNEL) {
  if (channel === "alpha" || channel === "rc") {
    return "https://raw.githubusercontent.com/aryanxxvii/tactile/alpha/marketplace/dist/catalog.json";
  }
  return HOSTED_MARKETPLACE_CATALOG_URL;
}

export function isLocalMarketplaceDevelopment(environment = import.meta.env) {
  return environment?.DEV === true;
}

export function marketplaceCatalogUrl({
  development = isLocalMarketplaceDevelopment(),
  storage = globalThis.localStorage,
  channel = TACTILE_CHANNEL,
} = {}) {
  if (development) return LOCAL_MARKETPLACE_CATALOG_URL;
  try {
    return storage?.getItem(CATALOG_STORAGE_KEY) || hostedMarketplaceCatalogUrl(channel);
  } catch {
    return hostedMarketplaceCatalogUrl(channel);
  }
}

function resolvedArtifactUrl(path, catalogUrl) {
  return new URL(path, new URL(catalogUrl, globalThis.location?.href || "http://localhost/")).href;
}

function versionParts(version) {
  const [core, prerelease = ""] = String(version || "0.0.0").split("-", 2);
  return {
    core: core.split(".").map((part) => Number.parseInt(part, 10) || 0),
    prerelease,
  };
}

export function comparePluginVersions(left, right) {
  const leftVersion = versionParts(left);
  const rightVersion = versionParts(right);
  const length = Math.max(leftVersion.core.length, rightVersion.core.length, 3);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftVersion.core[index] || 0) - (rightVersion.core[index] || 0);
    if (difference) return Math.sign(difference);
  }
  if (leftVersion.prerelease === rightVersion.prerelease) return 0;
  if (!leftVersion.prerelease) return 1;
  if (!rightVersion.prerelease) return -1;
  return leftVersion.prerelease.localeCompare(rightVersion.prerelease);
}

export function isPluginUpdateAvailable(catalogEntry, installedRecord) {
  return Boolean(
    catalogEntry?.status === "available"
    && installedRecord
    && comparePluginVersions(catalogEntry.version, installedRecord.version) > 0,
  );
}

export function buildCellObjectDefinitions(activeDefinitions, installedRecords) {
  const activePackageIds = new Set(activeDefinitions.map((definition) => definition.package?.id).filter(Boolean));
  return [
    ...activeDefinitions,
    ...Object.values(installedRecords || {})
      .filter((record) => !activePackageIds.has(record.packageId))
      .map((record) => ({
        type: record.type,
        label: record.name,
        description: record.description,
        source: "runtime",
        package: { id: record.packageId, version: record.version },
        installedPlaceholder: true,
      })),
  ];
}

export function updatedPluginRecord(currentRecord, catalogEntry, downloaded, updatedAt = new Date().toISOString()) {
  return {
    ...catalogEntry,
    ...downloaded,
    enabled: currentRecord.enabled !== false,
    installedAt: currentRecord.installedAt,
    updatedAt,
  };
}

export async function localDevelopmentPluginRecord(record, catalogEntry, downloader = downloadMarketplacePlugin) {
  if (!catalogEntry) throw new Error(`Local marketplace entry not found for ${record.packageId}.`);
  const downloaded = await downloader(catalogEntry);
  return {
    ...catalogEntry,
    ...downloaded,
    enabled: record.enabled !== false,
    installedAt: record.installedAt,
    developmentSource: true,
  };
}

function openDatabase() {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("Plugin storage is unavailable."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "packageId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Unable to open plugin storage."));
  });
}

function transaction(database, mode, operation) {
  return new Promise((resolve, reject) => {
    const current = database.transaction(STORE_NAME, mode);
    const request = operation(current.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Plugin storage operation failed."));
  });
}

export async function readInstalledPlugins() {
  const database = await openDatabase();
  try {
    return await transaction(database, "readonly", (store) => store.getAll());
  } finally {
    database.close();
  }
}

export async function writeInstalledPlugin(plugin) {
  const database = await openDatabase();
  try {
    await transaction(database, "readwrite", (store) => store.put(plugin));
  } finally {
    database.close();
  }
}

export async function deleteInstalledPlugin(packageId) {
  const database = await openDatabase();
  try {
    await transaction(database, "readwrite", (store) => store.delete(packageId));
  } finally {
    database.close();
  }
}

export async function fetchMarketplaceCatalog(fetcher = fetch) {
  const catalogUrl = marketplaceCatalogUrl();
  const response = await fetcher(catalogUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`Marketplace catalog request failed (${response.status}).`);
  const catalog = await response.json();
  if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog.plugins)) throw new Error("Marketplace catalog is invalid.");
  return {
    ...catalog,
    plugins: catalog.plugins.map((entry) => ({
      ...entry,
      ...(entry.artifact ? { artifact: resolvedArtifactUrl(entry.artifact, catalogUrl) } : {}),
      assets: (entry.assets || []).map((asset) => ({
        ...asset,
        artifact: resolvedArtifactUrl(asset.artifact, catalogUrl),
      })),
    })),
  };
}

export async function sha256Hex(source) {
  const bytes = typeof source === "string" ? new TextEncoder().encode(source) : source;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function marketplaceInstallSize(entry) {
  return Math.max(0, Number(entry?.size) || 0)
    + (entry?.assets || []).reduce((total, asset) => total + Math.max(0, Number(asset?.size) || 0), 0);
}

async function responseBytes(response, onChunk) {
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const chunks = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      chunks.push(chunk);
      length += chunk.byteLength;
      onChunk?.(chunk.byteLength);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  onChunk?.(bytes.byteLength);
  return bytes;
}

export async function downloadMarketplacePlugin(entry, fetcher = fetch, onProgress) {
  if (entry?.status !== "available" || !entry.artifact || !entry.sha256) throw new Error("This plugin is not available for installation.");
  const total = marketplaceInstallSize(entry);
  let loaded = 0;
  const report = (phase, file) => onProgress?.({ phase, file, loaded, total });
  const receive = async (response, file) => responseBytes(response, (chunkSize) => {
    loaded += chunkSize;
    report("downloading", file);
  });
  report("downloading", "plugin.js");
  const response = await fetcher(entry.artifact, { cache: "no-store" });
  if (!response.ok) throw new Error(`Plugin download failed (${response.status}).`);
  const sourceBytes = await receive(response, "plugin.js");
  if (entry.size && sourceBytes.byteLength !== entry.size) throw new Error("Plugin bundle size does not match the catalog.");
  report("verifying", "plugin.js");
  if (await sha256Hex(sourceBytes) !== entry.sha256) throw new Error("Plugin bundle checksum does not match the catalog.");
  const source = new TextDecoder().decode(sourceBytes);
  const assetSources = [];
  for (const asset of entry.assets || []) {
    report("downloading", asset.file);
    const assetResponse = await fetcher(asset.artifact, { cache: "no-store" });
    if (!assetResponse.ok) throw new Error(`Plugin asset download failed (${assetResponse.status}).`);
    const bytes = await receive(assetResponse, asset.file);
    if (asset.size && bytes.byteLength !== asset.size) throw new Error(`Plugin asset ${asset.file} size does not match the catalog.`);
    report("verifying", asset.file);
    if (await sha256Hex(bytes) !== asset.sha256) throw new Error(`Plugin asset ${asset.file} checksum does not match the catalog.`);
    assetSources.push({ file: asset.file, bytes });
  }
  report("verified", "");
  return { source, assetSources };
}

export async function activatePluginSource(source, entry, hostServices = {}) {
  const styleElements = [];
  const assetUrls = new Map((entry.assetSources || []).map((asset) => {
    const mime = asset.file.endsWith(".mjs") || asset.file.endsWith(".js") ? "text/javascript" : "application/octet-stream";
    return [asset.file, URL.createObjectURL(new Blob([asset.bytes], { type: mime }))];
  }));
  const host = Object.freeze({
    React,
    createId,
    ...hostServices,
    pluginAssetUrl: (file) => assetUrls.get(file) || "",
    installStyle: (css) => {
      const style = document.createElement("style");
      style.dataset.tactilePlugin = entry.packageId;
      style.textContent = css;
      document.head.appendChild(style);
      styleElements.push(style);
    },
  });
  const blobUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  try {
    globalThis.__TACTILE_PLUGIN_HOST__ = host;
    const module = await import(/* @vite-ignore */ blobUrl);
    if (typeof module.activate !== "function") throw new Error("Plugin bundle does not export activate(hostApi)." );
    const definition = await module.activate(host);
    if (definition?.type !== entry.type) throw new Error("Plugin type does not match the catalog.");
    if (definition?.package?.id !== entry.packageId) throw new Error("Plugin package id does not match the catalog.");
    if (definition?.package?.version !== entry.version) throw new Error("Plugin version does not match the catalog.");
    return {
      definition,
      dispose: () => {
        styleElements.forEach((style) => style.remove());
        assetUrls.forEach((url) => URL.revokeObjectURL(url));
      },
    };
  } catch (error) {
    styleElements.forEach((style) => style.remove());
    assetUrls.forEach((url) => URL.revokeObjectURL(url));
    throw error;
  } finally {
    delete globalThis.__TACTILE_PLUGIN_HOST__;
    URL.revokeObjectURL(blobUrl);
  }
}
