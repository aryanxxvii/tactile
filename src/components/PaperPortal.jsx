import { createPortal } from "react-dom";
import { useLayoutEffect, useRef } from "react";

const PAPER_THEME_VARIABLES = [
  "--app-background",
  "--paper",
  "--paper-elevated",
  "--tray",
  "--cell",
  "--cell-hover",
  "--ink",
  "--default-ink",
  "--muted",
  "--faint",
  "--line",
  "--line-strong",
  "--accent",
  "--accent-soft",
  "--focus-ring",
  "--positive",
  "--negative",
  "--selection-background",
  "--selection-foreground",
  "--surface-highlight",
  "--surface-highlight-soft",
  "--elevation-shadow",
  "--scrollbar-track",
  "--scrollbar-thumb",
  "--scrollbar-thumb-hover",
  "--cell-radius",
  "--cell-gap",
  "--cell-height",
  "--cell-shadow",
  "--cell-hover-shadow",
  "--font-display",
  "--font-ui",
  "--font-description",
  "--font-body",
  "--font-mono",
  "--title-weight",
  "--title-tracking",
  "--title-size",
];

function documentLevelPortalTarget() {
  if (typeof document === "undefined") return null;
  // The app root is the stable React event boundary and is a direct child of
  // the document body. Portal surfaces remain top-level siblings of the
  // clipped app surface without creating a new delegated-listener boundary.
  return document.getElementById("root") || document.body;
}

function themeVariablesFor(source) {
  if (typeof Element === "undefined" || !(source instanceof Element)) return {};
  const computed = getComputedStyle(source);
  const variables = {};
  const names = new Set(PAPER_THEME_VARIABLES);
  for (let index = 0; index < computed.length; index += 1) {
    const name = computed.item(index);
    if (name?.startsWith("--")) names.add(name);
  }
  for (const name of names) {
    const value = computed.getPropertyValue(name).trim();
    if (value) variables[name] = value;
  }
  return variables;
}

export function PaperPortal({ children, className = "", themeSource = null }) {
  const target = documentLevelPortalTarget();
  const layerRef = useRef(null);

  useLayoutEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    for (let index = layer.style.length - 1; index >= 0; index -= 1) {
      const name = layer.style.item(index);
      if (name?.startsWith("--")) layer.style.removeProperty(name);
    }
    Object.entries(themeVariablesFor(themeSource)).forEach(([name, value]) => {
      layer.style.setProperty(name, value);
    });
  });

  if (!target) return null;

  const overlayProps = {
    className: ["tactile-overlay-layer", className].filter(Boolean).join(" "),
    "data-overlay-layer": "true",
    "data-floating-interactive": "true",
    ...(className.includes("tactile-tooltip-layer") ? { "data-tooltip-layer": "true" } : {}),
  };

  return createPortal(<div {...overlayProps} ref={layerRef}>{children}</div>, target);
}
