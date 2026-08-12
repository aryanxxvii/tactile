import { useLayoutEffect, useRef, useState } from "react";
import { PaperPortal } from "./PaperPortal.jsx";

const TOOLTIP_GAP = 7;
const VIEWPORT_GUTTER = 8;

function anchorFor(target) {
  return target instanceof Element
    ? target.closest("[data-tooltip]")
    : null;
}

function isExcludedAnchor(anchor) {
  return !anchor
    || anchor.matches(":disabled")
    || Boolean(anchor.closest(".object-window-expand"));
}

function isInsideAnchor(anchor, target) {
  return typeof Node !== "undefined" && target instanceof Node && anchor.contains(target);
}

function initialPosition(anchor) {
  const rect = anchor.getBoundingClientRect();
  const isDock = Boolean(anchor.closest(".app-dock"));
  return {
    left: rect.left + rect.width / 2,
    top: isDock ? rect.top - TOOLTIP_GAP : rect.bottom + TOOLTIP_GAP,
    placement: isDock ? "above" : "below",
  };
}

function themeVariables(anchor) {
  const computed = getComputedStyle(anchor);
  const value = (name, fallback) => computed.getPropertyValue(name).trim() || fallback;
  return {
    "--ink": value("--ink", "#181816"),
    "--default-ink": value("--default-ink", "#2c2925"),
    "--paper-elevated": value("--paper-elevated", "#fffefa"),
    "--accent": value("--accent", "#b34d35"),
    "--line-strong": value("--line-strong", "#c7c0b5"),
    "--surface-highlight": value("--surface-highlight", "rgba(255,255,255,.82)"),
    "--surface-highlight-soft": value("--surface-highlight-soft", "rgba(255,255,255,.42)"),
    "--elevation-shadow": value("--elevation-shadow", "rgba(49,41,32,.18)"),
  };
}

function positionTooltip(anchor, tooltip) {
  const anchorBox = anchor.getBoundingClientRect();
  const tooltipBox = tooltip.getBoundingClientRect();
  const isDock = Boolean(anchor.closest(".app-dock"));
  const belowTop = anchorBox.bottom + TOOLTIP_GAP;
  const aboveTop = anchorBox.top - TOOLTIP_GAP;
  const canFitBelow = belowTop + tooltipBox.height <= window.innerHeight - VIEWPORT_GUTTER;
  const canFitAbove = aboveTop - tooltipBox.height >= VIEWPORT_GUTTER;
  const useAbove = (isDock && canFitAbove) || (!canFitBelow && canFitAbove);
  const placement = useAbove ? "above" : "below";
  const unclampedTop = useAbove ? aboveTop : belowTop;
  const minTop = useAbove ? VIEWPORT_GUTTER + tooltipBox.height : VIEWPORT_GUTTER;
  const maxTop = useAbove
    ? window.innerHeight - VIEWPORT_GUTTER
    : window.innerHeight - VIEWPORT_GUTTER - tooltipBox.height;
  const left = Math.min(
    Math.max(anchorBox.left + anchorBox.width / 2, VIEWPORT_GUTTER + tooltipBox.width / 2),
    window.innerWidth - VIEWPORT_GUTTER - tooltipBox.width / 2,
  );
  return {
    left,
    top: Math.max(minTop, Math.min(maxTop, unclampedTop)),
    placement,
    variables: themeVariables(anchor),
  };
}

export function TooltipLayer() {
  const [active, setActive] = useState(null);
  const [position, setPosition] = useState(null);
  const tooltipRef = useRef(null);

  useLayoutEffect(() => {
    if (!active || !tooltipRef.current) return;
    const updatePosition = () => {
      if (!active.anchor.isConnected) {
        setActive(null);
        return;
      }
      setPosition(positionTooltip(active.anchor, tooltipRef.current));
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [active]);

  useLayoutEffect(() => {
    const show = (event) => {
      if (event.type === "pointerover" && event.pointerType === "touch") return;
      const anchor = anchorFor(event.target);
      if (isExcludedAnchor(anchor)) return;
      if (event.type === "pointerover" && isInsideAnchor(anchor, event.relatedTarget)) return;
      const text = anchor.getAttribute("data-tooltip");
      if (!text) return;
      setPosition(initialPosition(anchor));
      setActive({ anchor, text });
    };
    const hide = (event) => {
      const anchor = anchorFor(event.target);
      if (!anchor || anchor !== active?.anchor || isInsideAnchor(anchor, event.relatedTarget)) return;
      setActive(null);
      setPosition(null);
    };
    const handleFocusOut = (event) => {
      const anchor = anchorFor(event.target);
      if (!anchor || anchor !== active?.anchor || isInsideAnchor(anchor, event.relatedTarget)) return;
      setActive(null);
      setPosition(null);
    };

    document.addEventListener("pointerover", show, true);
    document.addEventListener("pointerout", hide, true);
    document.addEventListener("focusin", show, true);
    document.addEventListener("focusout", handleFocusOut, true);
    return () => {
      document.removeEventListener("pointerover", show, true);
      document.removeEventListener("pointerout", hide, true);
      document.removeEventListener("focusin", show, true);
      document.removeEventListener("focusout", handleFocusOut, true);
    };
  }, [active]);

  if (!active || !position) return null;
  return (
    <PaperPortal className="tactile-tooltip-layer" themeSource={active.anchor}>
      <div
        ref={tooltipRef}
        className={`tactile-tooltip is-${position.placement}`}
        role="tooltip"
        style={{ left: position.left, top: position.top, ...position.variables }}
      >
        {active.text}
      </div>
    </PaperPortal>
  );
}
