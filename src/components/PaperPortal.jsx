import { createPortal } from "react-dom";
import { useLayoutEffect, useState } from "react";

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
  const [root, setRoot] = useState(null);

  useLayoutEffect(() => {
    const element = document.createElement("div");
    element.className = ["tactile-overlay-layer", className].filter(Boolean).join(" ");
    element.dataset.overlayLayer = "true";
    if (className.includes("tactile-tooltip-layer")) element.dataset.tooltipLayer = "true";
    document.body.appendChild(element);
    setRoot(element);
    return () => {
      element.remove();
      setRoot(null);
    };
  }, [className]);

  useLayoutEffect(() => {
    if (!root) return;
    for (let index = root.style.length - 1; index >= 0; index -= 1) {
      const name = root.style.item(index);
      if (name?.startsWith("--")) root.style.removeProperty(name);
    }
    Object.entries(themeVariablesFor(themeSource)).forEach(([name, value]) => {
      root.style.setProperty(name, value);
    });
  });

  return root ? createPortal(children, root) : null;
}
