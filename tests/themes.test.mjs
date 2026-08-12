import assert from "node:assert/strict";
import test from "node:test";

import { BUILT_IN_THEMES, allThemes, normalizeTheme, resolveTheme, themeStyle } from "../src/themes.js";

const requestedThemeNames = new Map([
  ["github-dark", "GitHub Dark"],
  ["catppuccin-dark", "Catppuccin Dark"],
  ["flexoki-light", "Flexoki Light"],
  ["flexoki-dark", "Flexoki Dark"],
  ["one-dark", "One Dark"],
  ["nord-dark", "Nord Dark"],
  ["vscode-dark", "VSCode Dark"],
  ["macos-light", "macOS Light"],
  ["macos-dark", "macOS Dark"],
  ["notion-light", "Notion Light"],
  ["notion-dark", "Notion Dark"],
]);

function luminance(hex) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(foreground, background) {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

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

test("default tile ink and depth are owned by each resolved theme", () => {
  const derived = normalizeTheme({
    id: "derived-dark",
    name: "Derived dark",
    tokens: { colorScheme: "dark", ink: "#d9e2f1" },
  });
  assert.equal(derived.tokens.defaultInk, "#d9e2f1");
  assert.equal(derived.tokens.surfaceHighlight, "rgba(255,255,255,.06)");
  assert.match(derived.tokens.cellShadow, /var\(--surface-highlight\)/);

  const explicit = normalizeTheme({
    id: "explicit-ink",
    name: "Explicit tile ink",
    tokens: { ink: "#111111", defaultInk: "#334455" },
  });
  assert.equal(explicit.tokens.defaultInk, "#334455");

  const githubStyle = themeStyle(resolveTheme("github-dark"));
  assert.equal(githubStyle["--default-ink"], "#e6edf3");
  assert.equal(githubStyle["--surface-highlight"], "rgba(255,255,255,.06)");
  assert.equal(githubStyle["--surface-highlight-soft"], "rgba(255,255,255,.03)");
  assert.equal(githubStyle["--elevation-shadow"], "rgba(0,0,0,.42)");
});

test("requested light and dark presets are complete built-in themes", () => {
  const themesById = new Map(BUILT_IN_THEMES.map((theme) => [theme.id, theme]));
  const expectedTokenNames = Object.keys(BUILT_IN_THEMES[0].tokens).sort();

  assert.equal(new Set(BUILT_IN_THEMES.map((theme) => theme.id)).size, BUILT_IN_THEMES.length);
  assert.equal(new Set(BUILT_IN_THEMES.map((theme) => theme.name)).size, BUILT_IN_THEMES.length);

  for (const [id, name] of requestedThemeNames) {
    const theme = themesById.get(id);
    assert.ok(theme, `${name} should be available`);
    assert.equal(theme.name, name);
    assert.equal(theme.builtIn, true);
    assert.deepEqual(Object.keys(theme.tokens).sort(), expectedTokenNames);
    assert.ok(
      contrastRatio(theme.tokens.ink, theme.tokens.paper) >= 4.5,
      `${name} should keep primary text legible on its paper surface`,
    );
    assert.ok(
      contrastRatio(theme.tokens.defaultInk, theme.tokens.cell) >= 4.5,
      `${name} should keep default tile text legible on its tile surface`,
    );
  }

  assert.equal(themesById.get("flexoki-light").tokens.colorScheme, "light");
  assert.equal(themesById.get("macos-light").tokens.colorScheme, "light");
  assert.equal(themesById.get("notion-light").tokens.colorScheme, "light");
  assert.equal(themesById.get("github-dark").tokens.colorScheme, "dark");
  assert.equal(themesById.get("notion-dark").tokens.colorScheme, "dark");
});

test("built-in presets remain immutable foundations beside custom themes", () => {
  const themes = allThemes({
    custom: { id: "custom", name: "Custom", tokens: { accent: "#123456" } },
  });

  assert.deepEqual(
    themes.filter((theme) => requestedThemeNames.has(theme.id)).map((theme) => theme.name),
    [...requestedThemeNames.values()],
  );
  assert.equal(themes.at(-1).id, "custom");
  assert.equal(themes.at(-1).builtIn, false);
  const githubStyle = themeStyle(resolveTheme("github-dark"));
  assert.equal(githubStyle.colorScheme, "dark");
  assert.equal(githubStyle["--scrollbar-track"], "#161b22");
  assert.equal(githubStyle["--scrollbar-thumb"], "#30363d");
  assert.equal(githubStyle["--scrollbar-thumb-hover"], "#2f81f7");
  assert.equal(themeStyle(resolveTheme("notion-light")).colorScheme, "light");
});
