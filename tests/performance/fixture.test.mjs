import assert from "node:assert/strict";
import test from "node:test";

import {
  FIXTURE_SPEC,
  createPerformanceWorkspace,
  fixtureFingerprint,
  validatePerformanceWorkspace,
} from "../../benchmarks/generate-fixture.mjs";

test("performance fixture is the fixed 250,000-cell workspace", () => {
  const workspace = createPerformanceWorkspace();
  const result = validatePerformanceWorkspace(workspace);

  assert.equal(result.valid, true, JSON.stringify(result, null, 2));
  assert.equal(result.counts.objects, FIXTURE_SPEC.objectCount);
  assert.equal(result.counts.usedCells, FIXTURE_SPEC.usedCellCount);
  assert.equal(result.counts.rootUsedCells, FIXTURE_SPEC.rootSheetUsedCellCount);
  assert.equal(result.counts.formulas, FIXTURE_SPEC.formulaCount);
  assert.equal(result.counts.conditionalFormats, FIXTURE_SPEC.conditionalFormatCount);
  assert.equal(result.counts.maxEmbedDepth, FIXTURE_SPEC.nestedEmbedDepth);
  assert.equal(result.counts.markdownBytes, FIXTURE_SPEC.markdownBytes);
  assert.equal(result.counts.assetBytes, FIXTURE_SPEC.assetBytes);
});

test("performance fixture generation is deterministic", () => {
  const first = fixtureFingerprint(createPerformanceWorkspace());
  const second = fixtureFingerprint(createPerformanceWorkspace());
  assert.equal(first, second);
});
