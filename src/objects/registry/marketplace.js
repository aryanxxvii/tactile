import * as React from "react";
import { createId } from "../../model.js";

const DATABASE_NAME = "tactile-plugin-cache";
const DATABASE_VERSION = 1;
const STORE_NAME = "plugins";
const CATALOG_STORAGE_KEY = "tactile.marketplace.catalogUrl";
const DEFAULT_CATALOG_PATH = "/marketplace/catalog.json";

export function marketplaceCatalogUrl() {
  try {
    return localStorage.getItem(CATALOG_STORAGE_KEY) || DEFAULT_CATALOG_PATH;
  } catch {
    return DEFAULT_CATALOG_PATH;
  }
}

function resolvedArtifactUrl(path, catalogUrl) {
  return new URL(path, new URL(catalogUrl, globalThis.location?.href || "http://localhost/")).href;
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

export async function downloadMarketplacePlugin(entry, fetcher = fetch) {
  if (entry?.status !== "available" || !entry.artifact || !entry.sha256) throw new Error("This plugin is not available for installation.");
  const response = await fetcher(entry.artifact, { cache: "no-store" });
  if (!response.ok) throw new Error(`Plugin download failed (${response.status}).`);
  const source = await response.text();
  if (entry.size && new TextEncoder().encode(source).byteLength !== entry.size) throw new Error("Plugin bundle size does not match the catalog.");
  if (await sha256Hex(source) !== entry.sha256) throw new Error("Plugin bundle checksum does not match the catalog.");
  const assetSources = [];
  for (const asset of entry.assets || []) {
    const assetResponse = await fetcher(asset.artifact, { cache: "no-store" });
    if (!assetResponse.ok) throw new Error(`Plugin asset download failed (${assetResponse.status}).`);
    const bytes = new Uint8Array(await assetResponse.arrayBuffer());
    if (asset.size && bytes.byteLength !== asset.size) throw new Error(`Plugin asset ${asset.file} size does not match the catalog.`);
    if (await sha256Hex(bytes) !== asset.sha256) throw new Error(`Plugin asset ${asset.file} checksum does not match the catalog.`);
    assetSources.push({ file: asset.file, bytes });
  }
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
