import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import { FormulaEngine } from "../src/sheet/formulas.js";

import { FIXTURE_SPEC, createPerformanceWorkspace } from "./generate-fixture.mjs";

export function runFormulaWorkerBenchmark() {
  const workspace = createPerformanceWorkspace();
  const sheet = workspace.objects[FIXTURE_SPEC.rootSheetId];
  const initialStart = performance.now();
  const engine = new FormulaEngine(sheet);
  const initialMs = performance.now() - initialStart;
  const editStart = performance.now();
  const result = engine.updateCell("B500", { value: "2000", formula: "" });
  const editMs = performance.now() - editStart;
  return {
    formulaCount: engine.getStats().formulaCount,
    initialMs,
    editMs,
    evaluatedOnEdit: result.evaluatedAddresses.length,
    calculation: engine.lastCalculation,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log(JSON.stringify(runFormulaWorkerBenchmark(), null, 2));
}
