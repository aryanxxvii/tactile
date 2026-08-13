export const TACTILE_OBJECT_DRAG_MIME = "application/x-tactile-object";
export const TACTILE_OBJECT_DRAG_VERSION = 1;
const TACTILE_OBJECT_DRAG_TEXT_PREFIX = "tactile-object:";

function locationSegment(location) {
  const segment = location?.segments?.at(-1);
  return segment?.objectId ? segment : null;
}

export function dragPayloadForObject(objectId, location = null, object = null) {
  const segment = locationSegment(location);
  const parent = object?.parent;
  const fallback = parent?.linkId
    ? {
        linkId: parent.linkId,
        sourceObjectId: parent.parentObjectId,
        sourceCellId: parent.parentCellId,
        sourceAddress: parent.sourceAddress,
      }
    : null;
  const source = segment?.objectId === String(objectId) ? segment : fallback;
  return {
    version: TACTILE_OBJECT_DRAG_VERSION,
    objectId: String(objectId || ""),
    ...(source?.linkId ? {
      linkId: String(source.linkId),
      sourceObjectId: String(source.sourceObjectId || ""),
      sourceCellId: String(source.sourceCellId || ""),
      sourceAddress: String(source.sourceAddress || ""),
    } : {}),
  };
}

export function writeObjectDragData(event, payload) {
  const dataTransfer = event?.dataTransfer;
  if (!dataTransfer || !payload?.objectId) return false;
  const serialized = JSON.stringify({
    version: TACTILE_OBJECT_DRAG_VERSION,
    ...payload,
  });
  dataTransfer.effectAllowed = "move";
  dataTransfer.setData(TACTILE_OBJECT_DRAG_MIME, serialized);
  dataTransfer.setData("text/plain", `${TACTILE_OBJECT_DRAG_TEXT_PREFIX}${serialized}`);
  return true;
}

export function isObjectDragEvent(event) {
  return Boolean(
    event?.dataTransfer?.types
      && (Array.from(event.dataTransfer.types).includes(TACTILE_OBJECT_DRAG_MIME)
        || Array.from(event.dataTransfer.types).includes("text/plain")),
  );
}

export function readObjectDragData(event) {
  const customRaw = event?.dataTransfer?.getData(TACTILE_OBJECT_DRAG_MIME);
  const textRaw = event?.dataTransfer?.getData("text/plain");
  const raw = customRaw || (textRaw?.startsWith(TACTILE_OBJECT_DRAG_TEXT_PREFIX)
    ? textRaw.slice(TACTILE_OBJECT_DRAG_TEXT_PREFIX.length)
    : "");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version !== TACTILE_OBJECT_DRAG_VERSION || !parsed.objectId) return null;
    return {
      version: TACTILE_OBJECT_DRAG_VERSION,
      objectId: String(parsed.objectId),
      ...(parsed.linkId ? { linkId: String(parsed.linkId) } : {}),
      ...(parsed.sourceObjectId ? { sourceObjectId: String(parsed.sourceObjectId) } : {}),
      ...(parsed.sourceCellId ? { sourceCellId: String(parsed.sourceCellId) } : {}),
      ...(parsed.sourceAddress ? { sourceAddress: String(parsed.sourceAddress) } : {}),
    };
  } catch {
    return null;
  }
}
