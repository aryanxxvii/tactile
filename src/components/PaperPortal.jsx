import { createPortal } from "react-dom";
import { useLayoutEffect, useState } from "react";

function themeVariablesFor(source) {
  if (typeof Element === "undefined" || !(source instanceof Element)) return {};
  const computed = getComputedStyle(source);
  const variables = {};
  for (let index = 0; index < computed.length; index += 1) {
    const name = computed.item(index);
    if (name?.startsWith("--")) variables[name] = computed.getPropertyValue(name).trim();
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
    Object.entries(themeVariablesFor(themeSource)).forEach(([name, value]) => {
      root.style.setProperty(name, value);
    });
  }, [root, themeSource]);

  return root ? createPortal(children, root) : null;
}
