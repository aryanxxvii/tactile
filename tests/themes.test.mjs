import assert from "node:assert/strict";
import test from "node:test";

import { normalizeTheme, resolveTheme, themeStyle } from "../src/themes.js";

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

test("theme styles expose active selection colors and derive them for older themes", () => {
  const resolved = resolveTheme("custom", {
    custom: {
      id: "custom",
      name: "Custom",
      tokens: { ink: "#192234", accentSoft: "#f8d56b" },
    },
  });
  const style = themeStyle(resolved);

  assert.equal(style["--selection-foreground"], "#192234");
  assert.equal(style["--selection-background"], "#f8d56b");
});
