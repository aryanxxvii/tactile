import { createFormulaWorkerRuntime } from "./runtime.js";

const runtime = createFormulaWorkerRuntime({
  postMessage: (message) => globalThis.postMessage(message),
});

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("message", (event) => runtime.handleMessage(event?.data ?? event));
}

export { runtime };
