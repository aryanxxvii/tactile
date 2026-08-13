function globalBlobConstructor() {
  return typeof globalThis !== "undefined" ? globalThis.Blob : undefined;
}

function isBlob(value) {
  const BlobConstructor = globalBlobConstructor();
  return Boolean(BlobConstructor && value instanceof BlobConstructor);
}

function decodeDataUrl(dataUrl) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(String(dataUrl));
  if (!match) return null;
  const mime = match[1] || "application/octet-stream";
  const payload = match[3] || "";
  if (match[2]) {
    if (typeof atob === "function") {
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      return { mime, bytes };
    }
    return null;
  }
  return { mime, bytes: new TextEncoder().encode(decodeURIComponent(payload)) };
}

export function toNativeBlob(value, mime = "application/octet-stream") {
  if (isBlob(value)) return value;
  const BlobConstructor = globalBlobConstructor();
  if (!BlobConstructor) throw new Error("Blob storage is unavailable in this environment.");
  if (typeof value === "string" && value.startsWith("data:")) {
    const decoded = decodeDataUrl(value);
    if (!decoded) throw new Error("The asset data URL could not be decoded.");
    return new BlobConstructor([decoded.bytes], { type: decoded.mime });
  }
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    return new BlobConstructor([value], { type: mime });
  }
  if (value === undefined || value === null) return null;
  return new BlobConstructor([value], { type: mime });
}

export async function blobBytes(blob) {
  if (!blob || typeof blob.arrayBuffer !== "function") return new Uint8Array();
  return new Uint8Array(await blob.arrayBuffer());
}

function base64FromBytes(bytes) {
  if (typeof btoa !== "function") {
    const BufferConstructor = typeof globalThis !== "undefined" ? globalThis.Buffer : undefined;
    return BufferConstructor ? BufferConstructor.from(bytes).toString("base64") : null;
  }
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

export async function blobToDataUrl(blob, mime = "application/octet-stream") {
  const bytes = await blobBytes(blob);
  const base64 = base64FromBytes(bytes);
  if (base64 === null) throw new Error("Base64 encoding is unavailable in this environment.");
  return `data:${blob?.type || mime};base64,${base64}`;
}

function defaultUrlApi() {
  return typeof globalThis !== "undefined" ? globalThis.URL : null;
}

export class AssetUrlRegistry {
  constructor({ urlApi = defaultUrlApi(), createObjectURL, revokeObjectURL } = {}) {
    this.createObjectURL = createObjectURL || urlApi?.createObjectURL?.bind(urlApi);
    this.revokeObjectURL = revokeObjectURL || urlApi?.revokeObjectURL?.bind(urlApi);
    this.entries = new Map();
  }

  acquire(assetId, blob) {
    if (!blob) throw new Error(`Asset ${String(assetId)} has no Blob data.`);
    if (typeof this.createObjectURL !== "function" || typeof this.revokeObjectURL !== "function") {
      throw new Error("Object URLs are unavailable in this environment.");
    }
    const key = String(assetId);
    let entry = this.entries.get(key);
    if (!entry || entry.blob !== blob) {
      if (entry) this.revokeEntry(key, entry);
      entry = {
        assetId: key,
        blob,
        url: this.createObjectURL(blob),
        references: 0,
      };
      this.entries.set(key, entry);
    }
    entry.references += 1;
    let released = false;
    return {
      assetId: key,
      url: entry.url,
      release: () => {
        if (released) return false;
        released = true;
        return this.release(key, entry.url);
      },
    };
  }

  release(assetId, url) {
    const key = String(assetId);
    const entry = this.entries.get(key);
    if (!entry || (url && entry.url !== url)) return false;
    entry.references = Math.max(0, entry.references - 1);
    if (entry.references === 0) this.revokeEntry(key, entry);
    return true;
  }

  revoke(assetId) {
    const key = String(assetId);
    const entry = this.entries.get(key);
    if (!entry) return false;
    this.revokeEntry(key, entry);
    return true;
  }

  clear() {
    [...this.entries.entries()].forEach(([key, entry]) => this.revokeEntry(key, entry));
  }

  revokeEntry(key, entry) {
    this.revokeObjectURL(entry.url);
    this.entries.delete(key);
  }
}

export const AssetHandleRegistry = AssetUrlRegistry;
