import assert from "node:assert/strict";
import test from "node:test";

import { normalizeIconEmoji } from "../src/iconEmoji.js";
import { createBlankWorkspace, normalizeWorkspace } from "../src/model.js";

test("normalizes custom icons to the first emoji grapheme", () => {
  assert.equal(normalizeIconEmoji("🎵✌️fbvf"), "🎵");
  assert.equal(normalizeIconEmoji("  👩‍💻  "), "👩‍💻");
  assert.equal(normalizeIconEmoji("🇮🇳"), "🇮🇳");
  assert.equal(normalizeIconEmoji("plain text"), "");
  assert.equal(normalizeIconEmoji(""), "");
});

test("normalizes imported object icon metadata without disturbing reset values", () => {
  const workspace = createBlankWorkspace({ id: "emoji-workspace" });
  workspace.objects.home.iconEmoji = "🎵✌️fbvf";

  const normalized = normalizeWorkspace(workspace);
  assert.equal(normalized.objects.home.iconEmoji, "🎵");

  workspace.objects.home.iconEmoji = "";
  const reset = normalizeWorkspace(workspace);
  assert.equal(reset.objects.home.iconEmoji, "");
});
