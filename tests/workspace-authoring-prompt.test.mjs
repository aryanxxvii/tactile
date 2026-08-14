import assert from "node:assert/strict";
import test from "node:test";

import { WORKSPACE_AUTHORING_PROMPT, WORKSPACE_AUTHORING_PROMPT_VERSION } from "../src/workspaceAuthoringPrompt.js";

test("workspace authoring prompt declares the current contract and core architecture", () => {
  assert.equal(WORKSPACE_AUTHORING_PROMPT_VERSION, "tactile-workspace-authoring/v1");
  for (const requiredText of [
    "portable v4",
    "[[tactile:<type>:<object-id>|<title>]]",
    "stable opaque IDs",
    "cycle",
    "Text/Markdown content is stored separately",
    "asset id",
    "A1 addressing",
    '"schemaVersion": "tactile-workspace-authoring/v1"',
    '"portableVersion": 4',
    "validation",
  ]) {
    assert.ok(WORKSPACE_AUTHORING_PROMPT.includes(requiredText), `missing ${requiredText}`);
  }
});
