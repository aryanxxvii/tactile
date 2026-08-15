import assert from "node:assert/strict";
import test from "node:test";

import { WORKSPACE_AUTHORING_PROMPT, WORKSPACE_AUTHORING_PROMPT_VERSION } from "../src/workspaceAuthoringPrompt.js";

test("workspace authoring prompt declares the current contract and core architecture", () => {
  assert.equal(WORKSPACE_AUTHORING_PROMPT_VERSION, "tactile-workspace-authoring/v2");
  for (const requiredText of [
    "tactile v4",
    "[[tactile:<type>:<object-id>|<title>]]",
    "stable opaque IDs",
    "cycle",
    "Text/Markdown content is stored separately",
    "asset id",
    "A1 addressing",
    "manifest.json",
    "workspace.json",
    "sheet.meta.json",
    '"format":"tactile"',
    '"version":4',
    "IMMUTABILITY CONTRACT",
    "Never overwrite",
    "DIFF SUMMARY",
    "validation",
  ]) {
    assert.ok(WORKSPACE_AUTHORING_PROMPT.includes(requiredText), `missing ${requiredText}`);
  }
});