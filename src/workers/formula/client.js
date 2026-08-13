import {
  createFormulaWorkerRequest,
  FORMULA_RESPONSE_TYPES,
  FORMULA_WORKER_PROTOCOL,
} from "./protocol.js";

export class StaleFormulaResultError extends Error {
  constructor(revision, latestRevision) {
    super(`Stale formula result revision ${String(revision)}; latest revision is ${String(latestRevision)}.`);
    this.name = "StaleFormulaResultError";
    this.code = "STALE_RESULT";
    this.revision = revision;
    this.latestRevision = latestRevision;
  }
}

export function isFreshFormulaWorkerResult(result, currentRevision) {
  return Boolean(
    result
    && result.type === FORMULA_RESPONSE_TYPES.result
    && Number.isInteger(result.revision)
    && result.revision >= currentRevision,
  );
}

export function assertFreshFormulaWorkerResult(result, currentRevision) {
  if (!isFreshFormulaWorkerResult(result, currentRevision)) {
    throw new StaleFormulaResultError(result?.revision ?? -1, currentRevision);
  }
  return result;
}

export class FormulaWorkerClient {
  constructor(worker) {
    if (!worker || typeof worker.postMessage !== "function") {
      throw new TypeError("FormulaWorkerClient requires a Worker-compatible transport.");
    }
    this.worker = worker;
    this.latestIssuedRevision = -1;
    this.latestAcceptedRevision = -1;
    this.nextRequestId = 1;
    this.pending = new Map();
    this._listener = (event) => this.handleMessage(event?.data ?? event);
    if (typeof worker.addEventListener === "function") worker.addEventListener("message", this._listener);
    else worker.onmessage = this._listener;
  }

  request(type, payload = {}, { revision } = {}) {
    const nextRevision = revision ?? this.latestIssuedRevision + 1;
    if (!Number.isInteger(nextRevision) || nextRevision <= this.latestIssuedRevision) {
      throw new RangeError(`Formula worker revisions must increase above ${String(this.latestIssuedRevision)}.`);
    }
    const request = createFormulaWorkerRequest(type, payload, {
      requestId: `client-${this.nextRequestId++}`,
      revision: nextRevision,
    });
    this.latestIssuedRevision = nextRevision;
    return new Promise((resolve, reject) => {
      this.pending.set(String(request.requestId), { resolve, reject, revision: nextRevision });
      try {
        this.worker.postMessage(request);
      } catch (error) {
        this.pending.delete(String(request.requestId));
        reject(error);
      }
    });
  }

  initialize(sheet, options = {}) {
    return this.request("init", { sheet, includeGraph: options.includeGraph }, options);
  }

  update(changes, options = {}) {
    return this.request("update", { changes, includeGraph: options.includeGraph }, options);
  }

  recalculate(options = {}) {
    return this.request("recalculate", {
      addresses: options.addresses,
      all: options.all,
      includeGraph: options.includeGraph,
    }, options);
  }

  handleMessage(message) {
    if (!message || message.protocol !== FORMULA_WORKER_PROTOCOL) return false;
    const requestId = String(message.requestId ?? "");
    const pending = this.pending.get(requestId);
    if (!pending) return false;
    this.pending.delete(requestId);
    const revision = Number.isInteger(message.revision) ? message.revision : -1;
    const stale = message.type === FORMULA_RESPONSE_TYPES.stale
      || revision < this.latestIssuedRevision
      || revision < this.latestAcceptedRevision;
    if (stale) {
      pending.reject(new StaleFormulaResultError(revision, Math.max(this.latestIssuedRevision, this.latestAcceptedRevision)));
      return false;
    }
    if (message.type === FORMULA_RESPONSE_TYPES.error) {
      const error = new Error(message.error?.message || "Formula worker failed.");
      error.code = message.error?.code || "FORMULA_WORKER_ERROR";
      pending.reject(error);
      return false;
    }
    if (message.type !== FORMULA_RESPONSE_TYPES.result) {
      pending.reject(new Error(`Unknown formula worker response: ${String(message.type)}`));
      return false;
    }
    this.latestAcceptedRevision = Math.max(this.latestAcceptedRevision, revision);
    pending.resolve(message);
    return true;
  }

  dispose() {
    if (typeof this.worker.removeEventListener === "function") this.worker.removeEventListener("message", this._listener);
    for (const pending of this.pending.values()) pending.reject(new Error("Formula worker client disposed."));
    this.pending.clear();
  }
}

export function createFormulaWorkerClient(worker) {
  return new FormulaWorkerClient(worker);
}
