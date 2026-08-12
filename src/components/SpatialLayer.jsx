import { IconArrowsMaximize } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { PaperPortal } from "./PaperPortal.jsx";

export function SpatialLayer({ layer, children, onExpand, onClose, depth = 1, viewportInsetLeft = 0 }) {
  const [expandHintVisible, setExpandHintVisible] = useState(false);
  const expandRef = useRef(null);
  const sourceRect = layer.sourceRect;
  const rawViewport = layer.viewport || { width: window.innerWidth, height: window.innerHeight };
  const insetLeft = Math.min(Math.max(0, viewportInsetLeft), Math.max(0, rawViewport.width - 1));
  const viewport = {
    width: Math.max(1, rawViewport.width - insetLeft),
    height: rawViewport.height,
  };
  const source = sourceRect
    ? { ...sourceRect, left: sourceRect.left - insetLeft }
    : null;
  const sourceScaleX = source ? Math.max(0.001, source.width / viewport.width) : 1;
  const sourceScaleY = source ? Math.max(0.001, source.height / viewport.height) : 1;
  const floatingScale = Math.max(0.84, 0.92 - Math.max(0, depth - 1) * 0.024);
  const style = source
    ? {
        "--source-x": `${source.left}px`,
        "--source-y": `${source.top}px`,
        "--source-width": `${source.width}px`,
        "--source-height": `${source.height}px`,
        "--source-scale-x": sourceScaleX,
        "--source-scale-y": sourceScaleY,
        "--floating-scale": floatingScale,
        "--floating-x": `${viewport.width * (1 - floatingScale) / 2}px`,
        "--floating-y": `${viewport.height * (1 - floatingScale) / 2}px`,
      }
    : undefined;
  const expandTooltipStyle = layer.phase === "floating" && !layer.closing
    ? {
        "--expand-tooltip-top": `${viewport.height * (1 - floatingScale) / 2 + (31 + 24) * floatingScale + 7}px`,
        "--expand-tooltip-right": `${viewportInsetLeft + viewport.width - (viewport.width * (1 - floatingScale) / 2 + viewport.width * floatingScale - 12 * floatingScale)}px`,
      }
    : undefined;
  const expandTooltipId = `expand-tooltip-${String(layer.key || layer.objectId).replace(/[^a-z0-9_-]/gi, "-")}`;

  return (
    <div
      className={`spatial-layer phase-${layer.phase} ${layer.closing ? "is-closing" : ""}`}
      style={style}
      data-spatial-phase={layer.phase}
      data-spatial-depth={depth}
      data-layer-object={layer.objectId}
    >
      <div className="transition-backdrop" aria-hidden="true" onPointerDown={() => onClose?.(layer.key)} />

      <section className="object-window" aria-label={`${layer.sourceLabel || "Embedded object"} window`}>
        {layer.phase === "floating" && !layer.closing ? (
          <button
            className="object-window-expand"
            ref={expandRef}
            type="button"
            onClick={() => onExpand?.(layer.key)}
            data-tooltip="Expand to full view · ]"
            aria-label="Expand embedded object"
            aria-describedby={expandTooltipId}
            onPointerEnter={() => setExpandHintVisible(true)}
            onPointerLeave={() => setExpandHintVisible(false)}
            onFocus={() => setExpandHintVisible(true)}
            onBlur={() => setExpandHintVisible(false)}
          >
            <IconArrowsMaximize size={14} stroke={1.7} />
            <span>Expand</span>
          </button>
        ) : null}
        <div className="object-window-content">{children}</div>
      </section>

      {layer.phase === "floating" && !layer.closing ? (
        <PaperPortal className="tactile-tooltip-layer" themeSource={expandRef.current}>
          <span
            id={expandTooltipId}
            className={`object-window-expand-tooltip ${expandHintVisible ? "is-visible" : ""}`}
            role="tooltip"
            style={expandTooltipStyle}
          >
            Expand to full view · ]
          </span>
        </PaperPortal>
      ) : null}

      <div className="source-echo" aria-hidden="true" />
    </div>
  );
}
