import assert from "node:assert/strict";
import test from "node:test";

import { prepareBrowserSource } from "../marketplace/plugins/code/execution.js";

test("browser execution leaves JavaScript unchanged", () => {
  const source = "const answer = 42; console.log(answer);";
  assert.equal(prepareBrowserSource(source, "javascript"), source);
});

test("browser execution removes TypeScript syntax before running", () => {
  const output = prepareBrowserSource("const answer: number = 42; console.log(answer);", "typescript");
  assert.doesNotMatch(output, /: number/);
  assert.match(output, /const answer = 42/);
});

test("browser execution reports invalid TypeScript during transformation", () => {
  assert.throws(() => prepareBrowserSource("const value: = 1;", "typescript"));
});