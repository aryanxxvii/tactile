export * from "./protocol.js";
export * from "./runtime.js";
export * from "./client.js";

import { FormulaWorkerClient } from "./client.js";

export function createFormulaWorker(options = {}) {
  const worker = options.worker || new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
  return new (options.Client || FormulaWorkerClient)(worker);
}
