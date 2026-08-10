import { createId } from "./model.js";

export const THEME_VERSION = 1;

const baseTokens = {
  appBackground: "#ede9e2",
  paper: "#fbfaf6",
  paperElevated: "#fffefa",
  tray: "#e9e5dd",
  cell: "#fbfaf6",
  cellHover: "#fffefa",
  ink: "#181816",
  muted: "#6f6b64",
  faint: "#9a958d",
  line: "#d8d3ca",
  lineStrong: "#c7c0b5",
  accent: "#b34d35",
  accentSoft: "rgba(179, 77, 53, 0.18)",
  focusRing: "#a94530",
  positive: "#4f6b55",
  negative: "#9b4032",
  cellRadius: 5,
  cellGap: 1,
  cellHeight: 30,
  columnWidth: 126,
  rowHeaderWidth: 34,
  columnHeaderHeight: 25,
  uiFont: '"Public Sans Variable", "Segoe UI Variable", Arial, sans-serif',
  monoFont: '"Lilex Variable", "Cascadia Mono", Consolas, monospace',
  titleWeight: 620,
  titleTracking: "-0.035em",
  titleSize: 20,
  cellShadow: "inset 0 1px 0 rgba(255,255,255,.96), inset 0 -1px 0 rgba(196,188,176,.34), 0 1px 1px rgba(55,46,36,.08), 0 2px 4px rgba(55,46,36,.025)",
  cellHoverShadow: "inset 0 1px 0 #fff, inset 0 -1px 0 rgba(190,181,168,.42), 0 3px 7px rgba(55,46,36,.13)",
};

export const BUILT_IN_THEMES = [
  {
    id: "paper-public",
    name: "Public Paper",
    description: "Warm ivory, rust focus, Public Sans and Lilex.",
    version: THEME_VERSION,
    builtIn: true,
    tokens: { ...baseTokens },
  },
  {
    id: "paper-slate",
    name: "Slate Paper",
    description: "A cool technical paper with a quiet blue focus.",
    version: THEME_VERSION,
    builtIn: true,
    tokens: {
      ...baseTokens,
      appBackground: "#e8ebeb",
      paper: "#f7f8f6",
      paperElevated: "#fcfdfb",
      tray: "#e2e6e5",
      cell: "#f7f8f6",
      cellHover: "#ffffff",
      ink: "#192022",
      muted: "#637074",
      faint: "#929da0",
      line: "#cfd6d5",
      lineStrong: "#bac5c5",
      accent: "#476d82",
      accentSoft: "rgba(71,109,130,.17)",
      focusRing: "#3e657a",
    },
  },
  {
    id: "paper-moss",
    name: "Moss Paper",
    description: "Soft archival stock with an olive working accent.",
    version: THEME_VERSION,
    builtIn: true,
    tokens: {
      ...baseTokens,
      appBackground: "#ebeade",
      paper: "#faf9ef",
      paperElevated: "#fffef5",
      tray: "#e6e4d6",
      cell: "#faf9ef",
      cellHover: "#fffef7",
      ink: "#202019",
      muted: "#706f60",
      faint: "#999786",
      line: "#d5d2c2",
      lineStrong: "#c3bfab",
      accent: "#69734b",
      accentSoft: "rgba(105,115,75,.18)",
      focusRing: "#5d6841",
    },
  },
  {
    id: "paper-plum",
    name: "Plum Paper",
    description: "Neutral paper warmed by a restrained editorial plum.",
    version: THEME_VERSION,
    builtIn: true,
    tokens: {
      ...baseTokens,
      appBackground: "#ece7e8",
      paper: "#faf7f7",
      paperElevated: "#fffdfd",
      tray: "#e7e0e2",
      cell: "#faf7f7",
      cellHover: "#fffdfd",
      ink: "#211c1e",
      muted: "#72666a",
      faint: "#9b8f93",
      line: "#d9ced1",
      lineStrong: "#c7b9bd",
      accent: "#7d5264",
      accentSoft: "rgba(125,82,100,.18)",
      focusRing: "#704659",
    },
  },
];

export function normalizeTheme(theme) {
  if (!theme || typeof theme !== "object") throw new Error("This is not a Tactile theme.");
  return {
    ...theme,
    id: String(theme.id || createId("theme")),
    name: String(theme.name || "Imported theme"),
    description: String(theme.description || ""),
    version: Number(theme.version || THEME_VERSION),
    builtIn: false,
    tokens: {
      ...baseTokens,
      ...(theme.tokens || {}),
    },
  };
}

export function resolveTheme(themeId, customThemes = {}) {
  return (customThemes[themeId] ? normalizeTheme(customThemes[themeId]) : null)
    || BUILT_IN_THEMES.find((theme) => theme.id === themeId)
    || BUILT_IN_THEMES[0];
}

export function allThemes(customThemes = {}) {
  return [...BUILT_IN_THEMES, ...Object.values(customThemes).map(normalizeTheme)];
}

export function cloneTheme(theme) {
  return normalizeTheme({
    ...theme,
    id: createId("theme"),
    name: `${theme.name} copy`,
    builtIn: false,
    tokens: { ...theme.tokens },
  });
}

export function themeStyle(theme) {
  const tokens = { ...baseTokens, ...(theme?.tokens || {}) };
  return {
    "--app-background": tokens.appBackground,
    "--paper": tokens.paper,
    "--paper-elevated": tokens.paperElevated,
    "--tray": tokens.tray,
    "--cell": tokens.cell,
    "--cell-hover": tokens.cellHover,
    "--ink": tokens.ink,
    "--muted": tokens.muted,
    "--faint": tokens.faint,
    "--line": tokens.line,
    "--line-strong": tokens.lineStrong,
    "--accent": tokens.accent,
    "--accent-soft": tokens.accentSoft,
    "--focus-ring": tokens.focusRing,
    "--positive": tokens.positive,
    "--negative": tokens.negative,
    "--cell-radius": `${tokens.cellRadius}px`,
    "--cell-gap": `${tokens.cellGap}px`,
    "--cell-height": `${tokens.cellHeight}px`,
    "--font-display": tokens.uiFont,
    "--font-ui": tokens.uiFont,
    "--font-description": tokens.uiFont,
    "--font-body": tokens.uiFont,
    "--font-mono": tokens.monoFont,
    "--title-weight": tokens.titleWeight,
    "--title-tracking": tokens.titleTracking,
    "--title-size": `${tokens.titleSize}px`,
    "--cell-shadow": tokens.cellShadow,
    "--cell-hover-shadow": tokens.cellHoverShadow,
  };
}

export function themeSheetMetrics(theme) {
  const tokens = { ...baseTokens, ...(theme?.tokens || {}) };
  return {
    rowHeight: Math.max(24, Number(tokens.cellHeight) + Number(tokens.cellGap)),
    columnWidth: Math.max(76, Number(tokens.columnWidth)),
    rowHeaderWidth: Math.max(28, Number(tokens.rowHeaderWidth)),
    columnHeaderHeight: Math.max(20, Number(tokens.columnHeaderHeight)),
    overscan: 3,
  };
}

export function downloadTheme(theme) {
  const portable = normalizeTheme(theme);
  const blob = new Blob([JSON.stringify(portable, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${portable.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.tactile-theme.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function themeFromFile(file) {
  return normalizeTheme(JSON.parse(await file.text()));
}
