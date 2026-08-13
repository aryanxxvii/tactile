import { FormulaEngine } from "../../sheet/formulas.js";
import {
  createFormulaWorkerError,
  createFormulaWorkerResult,
  createFormulaWorkerStale,
  normalizeFormulaWorkerRequest,
  FORMULA_REQUEST_TYPES,
} from "./protocol.js";

function serializeValues(values) {
  if (values instanceof Map) return Object.fromEntries(values);
  return { ...(values || {}) };
}

function resultPayload(engine, calculation, { includeGraph = false, fullValues = false } = {}) {
  const values = fullValues
    ? engine.getFormulaValues()
    : calculation.values;
  const payload = {
    values: serializeValues(values),
    changedAddresses: calculation.changedAddresses || calculation.affectedAddresses || [],
    affectedAddresses: calculation.affectedAddresses || [],
    evaluatedAddresses: calculation.evaluatedAddresses || [],
    removedAddresses: calculation.removedAddresses || [],
    calculation: calculation.calculation || engine.lastCalculation,
    stats: engine.getStats(),
  };
  if (includeGraph) {
    const snapshot = engine.snapshot();
    payload.dependencies = snapshot.dependencies;
    payload.reverseDependencies = snapshot.reverseDependencies;
  }
  return payload;
}

export class FormulaWorkerRuntime {
  constructor({ postMessage = () => {} } = {}) {
    this.postMessage = postMessage;
    this.engine = null;
    this.latestRevision = -1;
  }

  process(message) {
    let request;
    try {
      request = normalizeFormulaWorkerRequest(message, this.latestRevision + 1);
    } catch (error) {
      return createFormulaWorkerError(message, error);
    }
    if (request.revision < this.latestRevision) {
      return createFormulaWorkerStale(request, this.latestRevision);
    }
    this.latestRevision = Math.max(this.latestRevision, request.revision);
    try {
      if (request.type === FORMULA_REQUEST_TYPES.init) {
        if (!request.sheet) throw new TypeError("Formula worker init requires a sheet snapshot.");
        this.engine = new FormulaEngine(request.sheet, {
          revision: request.revision,
          autoRecalculate: true,
        });
        const calculation = {
          ...this.engine.lastCalculation,
          values: this.engine.getFormulaValues(),
          changedAddresses: this.engine.graph.formulaAddresses(),
          affectedAddresses: this.engine.graph.formulaAddresses(),
          evaluatedAddresses: this.engine.lastCalculation.evaluatedAddresses,
        };
        return createFormulaWorkerResult(request, resultPayload(this.engine, calculation, {
          includeGraph: Boolean(request.includeGraph),
          fullValues: true,
        }));
      }
      if (!this.engine) throw new Error("Formula worker must be initialized before it can calculate.");
      this.engine.revision = request.revision;
      if (request.type === FORMULA_REQUEST_TYPES.update) {
        const calculation = this.engine.applyChanges(request.changes || request.updates || [], {
          revision: request.revision,
        });
        return createFormulaWorkerResult(request, resultPayload(this.engine, calculation, {
          includeGraph: Boolean(request.includeGraph),
        }));
      }
      if (request.type === FORMULA_REQUEST_TYPES.recalculate) {
        const calculation = request.all
          ? this.engine.recalculateAll({ advanceRevision: false })
          : this.engine.recalculate({ addresses: request.addresses || [], advanceRevision: false });
        return createFormulaWorkerResult(request, resultPayload(this.engine, calculation, {
          includeGraph: Boolean(request.includeGraph),
          fullValues: Boolean(request.all),
        }));
      }
      throw new TypeError(`Unsupported formula worker request: ${request.type}`);
    } catch (error) {
      return createFormulaWorkerError(request, error);
    }
  }

  handleMessage(message) {
    const response = this.process(message);
    this.postMessage(response);
    return response;
  }
}

export function createFormulaWorkerRuntime(options) {
  return new FormulaWorkerRuntime(options);
}

export { serializeValues };
