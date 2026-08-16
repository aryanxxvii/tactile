import {
  DEFAULT_COLUMNS,
  DEFAULT_ROWS,
  WORKSPACE_VERSION,
  normalizeWorkspace,
} from "./model.js";
import { parseSheetCsv, serializeSheetCsv } from "./format/csv.js";

let jsZipPromise;

function loadJsZip() {
  jsZipPromise ||= import("jszip").then((module) => module.default || module);
  return jsZipPromise;
}

export function safeFileName(value) {
  return String(value || "file")
    .trim()
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "file";
}

function json(value) {
  return JSON.stringify(value, null, 2);
}

function extensionForObject(object, asset) {
  if (asset?.extension) return String(asset.extension).replace(/^\./, "").toLowerCase();
  const fromName = asset?.fileName?.split(".").pop();
  if (fromName && fromName !== asset.fileName) return fromName.toLowerCase();
  return {
    pdf: "pdf",
    image: "png",
    video: "mp4",
    audio: "mp3",
    html: "html",
    svg: "svg",
  }[object.type] || "bin";
}

function stripBinaryData(asset) {
  if (!asset) return null;
  const { dataUrl, blob, ...metadata } = asset;
  return metadata;
}

function pluginObjectData(object) {
  const core = new Set(["id", "type", "title", "description", "parent", "iconEmoji", "iconColor", "assetId", "source"]);
  return Object.fromEntries(Object.entries(object || {}).filter(([key]) => !core.has(key)));
}

function sheetMetadata(object) {
  const cellMetadata = {};
  Object.values(object.cells || {}).forEach((cell) => {
    const metadata = {};
    if (cell.style) metadata.style = cell.style;
    if (cell.note) metadata.note = cell.note;
    if (cell.validation) metadata.validation = cell.validation;
    if (cell.embed?.linkId || cell.embed?.relation) metadata.embed = { ...cell.embed };
    if (Object.keys(metadata).length) cellMetadata[cell.address] = metadata;
  });
  return {
    rows: object.rows,
    columns: object.columns,
    rowHeight: object.rowHeight,
    columnWidth: object.columnWidth,
    rowHeights: object.rowHeights || {},
    columnWidths: object.columnWidths || {},
    frozenRows: object.frozenRows || 0,
    frozenColumns: object.frozenColumns || 0,
    rowGroups: object.rowGroups || [],
    columnGroups: object.columnGroups || [],
    conditionalFormats: object.conditionalFormats || [],
    filters: object.filters || [],
    cells: cellMetadata,
  };
}

export function buildPortablePackage(workspaceInput) {
  const workspace = normalizeWorkspace(workspaceInput);
  const files = {};
  const objects = [];

  Object.values(workspace.objects).forEach((object) => {
    const folder = `objects/${safeFileName(object.id)}`;
    const record = {
      id: object.id,
      type: object.type,
      title: object.title,
      description: object.description || "",
      parent: object.parent || null,
      ...(object.iconEmoji ? { iconEmoji: object.iconEmoji } : {}),
      ...(object.iconColor ? { iconColor: object.iconColor } : {}),
    };

    if (object.type === "sheet") {
      record.file = `${folder}/sheet.csv`;
      record.metadata = `${folder}/sheet.meta.json`;
      files[record.file] = serializeSheetCsv(object, workspace);
      files[record.metadata] = json(sheetMetadata(object));
    } else if (object.type === "markdown") {
      record.file = `${folder}/content.md`;
      files[record.file] = object.content || "";
    } else if (object.type === "link") {
      record.url = object.url || "";
      record.source = object.source || "";
    } else {
      const asset = object.assetId ? workspace.assets[object.assetId] : null;
      const extension = extensionForObject(object, asset);
      record.file = `${folder}/content.${extension}`;
      record.assetId = object.assetId || null;
      record.source = object.source || "";
      const data = pluginObjectData(object);
      if (Object.keys(data).length) record.data = data;
      record.asset = stripBinaryData(asset);
      if (asset?.dataUrl) files[record.file] = { dataUrl: asset.dataUrl };
      else if (typeof object.source === "string") files[record.file] = object.source;
    }
    objects.push(record);
  });

  const themeRecords = Object.values(workspace.themes || {}).map((theme) => {
    const file = `themes/${safeFileName(theme.id || theme.name)}.json`;
    files[file] = json(theme);
    return { id: theme.id, name: theme.name, file };
  });

  const workspaceIndex = {
    version: WORKSPACE_VERSION,
    id: workspace.id,
    name: workspace.name,
    homeObjectId: workspace.homeObjectId,
    homePath: workspace.homePath,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
    activeThemeId: workspace.activeThemeId,
    settings: workspace.settings,
    pluginRequirements: [...new Set(Object.values(workspace.objects)
      .map((object) => object.type)
      .filter((type) => !["sheet", "markdown", "document", "link"].includes(type)))].map((type) => ({
      packageId: `tactile.${type}`,
      type,
    })),
    objects,
    themes: themeRecords,
  };
  const manifest = {
    format: "tactile",
    formatVersion: WORKSPACE_VERSION,
    entry: "workspace.json",
    workspaceId: workspace.id,
    generatedAt: new Date().toISOString(),
    linkSyntax: "[[tactile:<type>:<object-id>|<title>]]",
    note: "Sheets are sparse used-range CSV files. Embedded and binary objects are separate files.",
  };
  files["manifest.json"] = json(manifest);
  files["workspace.json"] = json(workspaceIndex);
  return { manifest, workspaceIndex, files };
}

function dataUrlParts(dataUrl) {
  if (typeof dataUrl !== "string") return null;
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) return null;
  return {
    mime: match[1] || "application/octet-stream",
    base64: Boolean(match[2]),
    data: match[3],
  };
}

export async function workspaceToZipBlob(workspace) {
  const packageData = buildPortablePackage(workspace);
  const JSZip = await loadJsZip();
  const zip = new JSZip();
  Object.entries(packageData.files).forEach(([path, contents]) => {
    if (contents && typeof contents === "object" && contents.dataUrl) {
      const data = dataUrlParts(contents.dataUrl);
      if (data) zip.file(path, data.data, { base64: data.base64 });
    } else {
      zip.file(path, contents ?? "");
    }
  });
  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

function downloadBlob(blob, fileName) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export async function downloadWorkspaceZip(workspace) {
  const blob = await workspaceToZipBlob(workspace);
  downloadBlob(blob, `${safeFileName(workspace.name)}.zip`);
}

export function downloadWorkspaceJson(workspace) {
  const blob = new Blob([json(normalizeWorkspace(workspace))], { type: "application/json" });
  downloadBlob(blob, `${safeFileName(workspace.name)}.tactile.json`);
}

async function optionalJson(zip, path, fallback = null) {
  const file = path ? zip.file(path) : null;
  return file ? JSON.parse(await file.async("text")) : fallback;
}

async function binaryFileToDataUrl(file, mime = "application/octet-stream") {
  const base64 = await file.async("base64");
  return `data:${mime};base64,${base64}`;
}

function mimeForExtension(extension) {
  return {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    mp4: "video/mp4",
    webm: "video/webm",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    flac: "audio/flac",
    m4a: "audio/mp4",
    aac: "audio/aac",
    html: "text/html",
  }[extension] || "application/octet-stream";
}

export async function workspaceFromZip(input) {
  const JSZip = await loadJsZip();
  const zip = await JSZip.loadAsync(input);
  const indexFile = zip.file("workspace.json");
  if (!indexFile) throw new Error("This bundle is missing workspace.json.");
  const index = JSON.parse(await indexFile.async("text"));
  const objects = {};
  const assets = {};

  for (const record of index.objects || []) {
    if (record.type === "sheet") {
      const csv = record.file && zip.file(record.file) ? await zip.file(record.file).async("text") : "";
      const metadata = await optionalJson(zip, record.metadata, {});
      const cells = parseSheetCsv(csv);
      Object.entries(metadata.cells || {}).forEach(([address, cellMetadata]) => {
        const cell = Object.values(cells).find((candidate) => candidate.address === address);
        if (cell) Object.assign(cell, cellMetadata);
      });
      objects[record.id] = {
        id: record.id,
        type: "sheet",
        title: record.title,
        description: record.description || "",
        parent: record.parent || null,
        iconEmoji: record.iconEmoji || "",
        iconColor: record.iconColor || "",
        rows: Math.max(DEFAULT_ROWS, metadata.rows || 0),
        columns: Math.max(DEFAULT_COLUMNS, metadata.columns || 0),
        rowHeight: metadata.rowHeight,
        columnWidth: metadata.columnWidth,
        rowHeights: metadata.rowHeights || {},
        columnWidths: metadata.columnWidths || {},
        cells,
        rowGroups: metadata.rowGroups || [],
        columnGroups: metadata.columnGroups || [],
        conditionalFormats: metadata.conditionalFormats || [],
        filters: metadata.filters || [],
        frozenRows: metadata.frozenRows || 0,
        frozenColumns: metadata.frozenColumns || 0,
      };
    } else if (record.type === "markdown") {
      objects[record.id] = {
        id: record.id,
        type: "markdown",
        title: record.title,
        description: record.description || "",
        parent: record.parent || null,
        iconEmoji: record.iconEmoji || "",
        iconColor: record.iconColor || "",
        content: record.file && zip.file(record.file) ? await zip.file(record.file).async("text") : "",
      };
    } else if (record.type === "link") {
      objects[record.id] = {
        id: record.id,
        type: "link",
        title: record.title,
        description: record.description || "",
        parent: record.parent || null,
        iconEmoji: record.iconEmoji || "",
        iconColor: record.iconColor || "",
        url: record.url || "",
        source: record.source || "",
      };
    } else {
      const file = record.file ? zip.file(record.file) : null;
      const assetId = record.assetId || `${record.id}-asset`;
      if (file) {
        const extension = record.file.split(".").pop().toLowerCase();
        const mime = record.asset?.mime || mimeForExtension(extension);
        assets[assetId] = {
          ...(record.asset || {}),
          id: assetId,
          extension,
          mime,
          dataUrl: await binaryFileToDataUrl(file, mime),
        };
      }
      objects[record.id] = {
        ...(record.data && typeof record.data === "object" ? record.data : {}),
        id: record.id,
        type: record.type,
        title: record.title,
        description: record.description || "",
        parent: record.parent || null,
        iconEmoji: record.iconEmoji || "",
        iconColor: record.iconColor || "",
        assetId: file ? assetId : null,
        source: record.source || "",
      };
    }
  }

  const themes = {};
  for (const themeRecord of index.themes || []) {
    const theme = await optionalJson(zip, themeRecord.file);
    if (theme) themes[theme.id || themeRecord.id] = theme;
  }
  return normalizeWorkspace({
    ...index,
    objects,
    assets,
    themes,
  });
}

export async function importWorkspaceFile(file) {
  if (!file) throw new Error("No file selected.");
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".json")) return normalizeWorkspace(JSON.parse(await file.text()));
  return workspaceFromZip(file);
}
