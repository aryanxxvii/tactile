export const FORMULA_WORKER_PROTOCOL = "tactile/formula";
export const FORMULA_WORKER_VERSION = 1;

export const FORMULA_REQUEST_TYPES = Object.freeze({
  init: "init",
  update: "update",
  recalculate: "recalculate",
});

export const FORMULA_RESPONSE_TYPES = Object.freeze({
  result: "result",
  error: "error",
  stale: "stale",
});

const REQUEST_ALIASES = new Map([
  ["initialize", FORMULA_REQUEST_TYPES.init],
  ["init", FORMULA_REQUEST_TYPES.init],
  ["apply", FORMULA_REQUEST_TYPES.update],
  ["apply-changes", FORMULA_REQUEST_TYPES.update],
  ["update", FORMULA_REQUEST_TYPES.update],
  ["recalculate", FORMULA_REQUEST_TYPES.recalculate],
  ["recalc", FORMULA_REQUEST_TYPES.recalculate],
]);

let requestSerial = 0;

function nextRequestId() {
  requestSerial += 1;
  return `formula-${requestSerial}`;
}

export function canonicalFormulaRequestType(type) {
  return REQUEST_ALIASES.get(String(type || "").toLowerCase()) || null;
}

export function createFormulaWorkerRequest(type, payload = {}, { requestId, revision = 0 } = {}) {
  const canonicalType = canonicalFormulaRequestType(type);
  if (!canonicalType) throw new TypeError(`Unknown formula worker request: ${String(type)}`);
  return {
    ...payload,
    protocol: FORMULA_WORKER_PROTOCOL,
    version: FORMULA_WORKER_VERSION,
    type: canonicalType,
    requestId: requestId ?? nextRequestId(),
    revision,
  };
}

export function normalizeFormulaWorkerRequest(message, fallbackRevision = 0) {
  if (!message || typeof message !== "object") throw new TypeError("Formula worker request must be an object.");
  if (message.protocol && message.protocol !== FORMULA_WORKER_PROTOCOL) {
    throw new TypeError(`Unsupported formula worker protocol: ${String(message.protocol)}`);
  }
  if (message.version !== undefined && message.version !== FORMULA_WORKER_VERSION) {
    throw new TypeError(`Unsupported formula worker protocol version: ${String(message.version)}`);
  }
  const type = canonicalFormulaRequestType(message.type || message.operation || message.kind);
  if (!type) throw new TypeError(`Unknown formula worker request: ${String(message.type || message.operation || message.kind)}`);
  const revision = Number.isInteger(message.revision) ? message.revision : fallbackRevision;
  return {
    ...message,
    protocol: FORMULA_WORKER_PROTOCOL,
    version: FORMULA_WORKER_VERSION,
    type,
    requestId: message.requestId ?? nextRequestId(),
    revision,
  };
}

export function createFormulaWorkerResult(request, payload = {}) {
  return {
    ...payload,
    protocol: FORMULA_WORKER_PROTOCOL,
    version: FORMULA_WORKER_VERSION,
    type: FORMULA_RESPONSE_TYPES.result,
    operation: request.type,
    requestId: request.requestId,
    revision: request.revision,
  };
}

export function createFormulaWorkerError(request, error) {
  return {
    protocol: FORMULA_WORKER_PROTOCOL,
    version: FORMULA_WORKER_VERSION,
    type: FORMULA_RESPONSE_TYPES.error,
    operation: request?.type || null,
    requestId: request?.requestId ?? null,
    revision: request?.revision ?? 0,
    error: {
      code: error?.code || "FORMULA_WORKER_ERROR",
      message: error?.message || String(error),
    },
  };
}

export function createFormulaWorkerStale(request, latestRevision) {
  return {
    protocol: FORMULA_WORKER_PROTOCOL,
    version: FORMULA_WORKER_VERSION,
    type: FORMULA_RESPONSE_TYPES.stale,
    operation: request?.type || null,
    requestId: request?.requestId ?? null,
    revision: request?.revision ?? 0,
    latestRevision,
    error: {
      code: "STALE_RESULT",
      message: `Formula result revision ${String(request?.revision ?? 0)} is older than revision ${String(latestRevision)}.`,
    },
  };
}
