const CACHE_ENTRY_LIMIT = 64;
const CACHE_BYTE_LIMIT = 8 * 1024 * 1024;
const RENDERER_VERSION = "mermaid-11.16-tactile-2";
const renderedDiagrams = new Map();
const textEncoder = new TextEncoder();

let cachedBytes = 0;
let mermaidPromise;
let renderQueue = Promise.resolve();
let renderSequence = 0;

function normalizedSource(source) {
  return String(source || "").replace(/\r\n?/g, "\n").trim();
}

function themeValues(theme = {}) {
  return {
    colorScheme: theme.colorScheme === "dark" ? "dark" : "light",
    paper: theme.paper || "#ffffff",
    paperElevated: theme.paperElevated || theme.paper || "#ffffff",
    tray: theme.tray || theme.paper || "#f3f3f3",
    cell: theme.cell || theme.paperElevated || theme.paper || "#ffffff",
    ink: theme.ink || "#181816",
    defaultInk: theme.defaultInk || theme.ink || "#2c2925",
    muted: theme.muted || "#6f6b64",
    faint: theme.faint || theme.muted || "#9a958d",
    line: theme.lineStrong || theme.line || "#c7c0b5",
    accent: theme.accent || "#b34d35",
    positive: theme.positive || "#4f6b55",
    negative: theme.negative || "#9b4032",
    fontFamily: theme.uiFont || '"Public Sans Variable", "Segoe UI Variable", Arial, sans-serif',
  };
}

export function mermaidThemeSignature(theme) {
  return JSON.stringify(themeValues(theme));
}

export function mermaidConfig(theme) {
  const values = themeValues(theme);
  return {
    startOnLoad: false,
    securityLevel: "strict",
    suppressErrorRendering: true,
    htmlLabels: false,
    theme: "base",
    fontFamily: values.fontFamily,
    flowchart: {
      curve: "basis",
      diagramPadding: 18,
      nodeSpacing: 48,
      rankSpacing: 56,
      useMaxWidth: false,
    },
    sequence: {
      actorMargin: 64,
      boxMargin: 12,
      diagramMarginX: 24,
      diagramMarginY: 18,
      messageMargin: 28,
      useMaxWidth: false,
    },
    themeVariables: {
      background: values.paper,
      fontFamily: values.fontFamily,
      fontSize: "13px",
      primaryColor: values.cell,
      primaryTextColor: values.ink,
      primaryBorderColor: values.accent,
      lineColor: values.muted,
      secondaryColor: values.tray,
      secondaryTextColor: values.defaultInk,
      secondaryBorderColor: values.line,
      tertiaryColor: values.paperElevated,
      tertiaryTextColor: values.defaultInk,
      tertiaryBorderColor: values.line,
      clusterBkg: values.paper,
      clusterBorder: values.line,
      edgeLabelBackground: values.paper,
      mainBkg: values.cell,
      nodeBorder: values.accent,
      textColor: values.defaultInk,
      titleColor: values.ink,
      actorBkg: values.cell,
      actorBorder: values.accent,
      actorTextColor: values.ink,
      signalColor: values.muted,
      signalTextColor: values.defaultInk,
      labelBoxBkgColor: values.paper,
      labelBoxBorderColor: values.line,
      labelTextColor: values.defaultInk,
      activationBkgColor: values.accent,
      activationBorderColor: values.accent,
      noteBkgColor: values.tray,
      noteBorderColor: values.line,
      noteTextColor: values.defaultInk,
      sectionBkgColor: values.paperElevated,
      altSectionBkgColor: values.paper,
      sectionBkgColor2: values.tray,
      taskBkgColor: values.cell,
      taskBorderColor: values.line,
      taskTextColor: values.defaultInk,
      activeTaskBkgColor: values.accent,
      activeTaskBorderColor: values.accent,
      gridColor: values.line,
      todayLineColor: values.negative,
      cScale0: values.accent,
      cScale1: values.positive,
      cScale2: values.negative,
    },
  };
}

export async function mermaidCacheKey(source, theme) {
  const payload = `${RENDERER_VERSION}\u0000${mermaidThemeSignature(theme)}\u0000${normalizedSource(source)}`;
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(payload));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cachedSvg(key) {
  const entry = renderedDiagrams.get(key);
  if (!entry) return null;
  renderedDiagrams.delete(key);
  renderedDiagrams.set(key, entry);
  return entry.svg;
}

function cacheSvg(key, svg) {
  const bytes = textEncoder.encode(svg).byteLength;
  if (bytes > CACHE_BYTE_LIMIT) return;
  renderedDiagrams.set(key, { svg, bytes });
  cachedBytes += bytes;
  while (renderedDiagrams.size > CACHE_ENTRY_LIMIT || cachedBytes > CACHE_BYTE_LIMIT) {
    const oldestKey = renderedDiagrams.keys().next().value;
    const oldest = renderedDiagrams.get(oldestKey);
    renderedDiagrams.delete(oldestKey);
    cachedBytes -= oldest.bytes;
  }
}

function safeSvg(svg) {
  const value = String(svg || "");
  if (!/^<svg[\s>]/i.test(value.trim())) throw new Error("Mermaid did not produce an SVG diagram.");
  if (/<script[\s>]|\son[a-z]+\s*=|(?:href|src)\s*=\s*["']?javascript:/i.test(value)) {
    throw new Error("Mermaid produced unsafe diagram content.");
  }
  return value;
}

async function loadMermaid() {
  mermaidPromise ||= import("mermaid").then((module) => module.default || module);
  return mermaidPromise;
}

export async function renderMermaid(source, theme) {
  const normalized = normalizedSource(source);
  const key = await mermaidCacheKey(normalized, theme);
  const cached = cachedSvg(key);
  if (cached) return { svg: cached, cacheHit: true, key };

  const render = renderQueue.then(async () => {
    const queuedCached = cachedSvg(key);
    if (queuedCached) return { svg: queuedCached, cacheHit: true, key };
    const mermaid = await loadMermaid();
    mermaid.initialize(mermaidConfig(theme));
    const id = `tactile-mermaid-${key.slice(0, 16)}-${renderSequence++}`;
    const result = await mermaid.render(id, normalized);
    const svg = safeSvg(result.svg);
    cacheSvg(key, svg);
    return { svg, cacheHit: false, key };
  });
  renderQueue = render.catch(() => undefined);
  return render;
}

export function mermaidCacheStats() {
  return { entries: renderedDiagrams.size, bytes: cachedBytes };
}