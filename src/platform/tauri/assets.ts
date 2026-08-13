import type { AssetId, WorkspaceId } from "../../core/ids.ts";
import type { TauriAssetHandle, TauriAssetMetadata } from "./contracts.ts";

export class AssetHandleProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssetHandleProtocolError";
  }
}

function isArrayBufferView(value: unknown): value is ArrayBufferView {
  return typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(value);
}

export function toUint8Array(value: unknown, label = "asset bytes"): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (isArrayBufferView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (Array.isArray(value)) {
    const bytes = new Uint8Array(value.length);
    value.forEach((entry, index) => {
      const byte = Number(entry);
      if (!Number.isInteger(byte) || byte < 0 || byte > 255) {
        throw new AssetHandleProtocolError(`${label} contains a value outside the byte range.`);
      }
      bytes[index] = byte;
    });
    return bytes;
  }
  throw new AssetHandleProtocolError(`${label} must be a byte array, not a data URL.`);
}

export function toIpcBytes(value: unknown, label = "asset bytes"): number[] {
  return Array.from(toUint8Array(value, label));
}

/** Asset metadata is kept separate from binary bytes at every platform edge. */
export function stripAssetBinary(record: Record<string, unknown> = {}): TauriAssetMetadata {
  const { blob: _blob, data: _data, dataUrl: _dataUrl, bytes: _bytes, ...metadata } = record;
  return metadata as TauriAssetMetadata;
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function rejectDataUrl(handle: string): string {
  if (handle.startsWith("data:")) {
    throw new AssetHandleProtocolError("Native asset handles may not be data URLs.");
  }
  return handle;
}

export function normalizeAssetHandle(value: unknown, assetId: AssetId): TauriAssetHandle {
  const source = recordOf(value);
  const candidate = typeof value === "string" ? value : (source?.handle ?? source?.token ?? source?.url);
  const handle = stringValue(candidate);
  if (!handle) throw new AssetHandleProtocolError(`Asset ${String(assetId)} did not return a native handle.`);
  const size = source?.size === undefined ? undefined : Number(source.size);
  return {
    assetId,
    handle: rejectDataUrl(handle),
    ...(stringValue(source?.mime) ? { mime: stringValue(source?.mime) } : {}),
    ...(Number.isFinite(size) ? { size } : {}),
  };
}

export function assetHandlePayload(workspaceId: WorkspaceId, assetId: AssetId, handle?: string) {
  return {
    workspaceId,
    assetId,
    ...(handle ? { handle: rejectDataUrl(handle) } : {}),
  };
}
