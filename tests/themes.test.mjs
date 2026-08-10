import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTheme, resolveTheme } from "../src/themes.js";

test("themes backfill known tokens and preserve future tokens", () => {
  const theme = normalizeTheme({
    id: "custom",
    name: "Custom",
    tokens: { accent: "#123456", pluginDepth: 0.72 },
  });
  assert.equal(theme.tokens.accent, "#123456");
  assert.equal(theme.tokens.positive, "#4f6b55");
  assert.equal(theme.tokens.pluginDepth, 0.72);
});

test("resolving an older custom theme exposes current token defaults", () => {
  const resolved = resolveTheme("older", {
    older: { id: "older", name: "Older", tokens: { paper: "#ffffff" } },
  });
  assert.equal(resolved.tokens.paper, "#ffffff");
  assert.equal(resolved.tokens.negative, "#9b4032");
});
