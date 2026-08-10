import { objectTypeFor } from "../objects/objectTypes.js";
import { IconArrowsMaximize } from "@tabler/icons-react";
import { useState } from "react";

export function SpatialLayer({ layer, children, onExpand, onClose, depth = 1 }) {
  const [expandHintVisible, setExpandHintVisible] = useState(false);
  const source = layer.sourceRect;
  const viewport = layer.viewport || { width: window.innerWidth, height: window.innerHeight };
  const SourceIcon = objectTypeFor(layer.sourceType).icon;
  const floatingScale = Math.max(0.84, 0.92 - Math.max(0, depth - 1) * 0.024);
  const style = source
    ? {
        "--source-x": `${source.left}px`,
        "--source-y": `${source.top}px`,
        "--source-width": `${source.width}px`,
        "--source-height": `${source.height}px`,
        "--source-scale-x": source.width / viewport.width,
        "--source-scale-y": source.height / viewport.height,
        "--floating-scale": floatingScale,
        "--floating-x": `${viewport.width * (1 - floatingScale) / 2}px`,
        "--floating-y": `${viewport.height * (1 - floatingScale) / 2}px`,
      }
    : undefined;
  const expandTooltipStyle = layer.phase === "floating" && !layer.closing
    ? {
        "--expand-tooltip-top": `${viewport.height * (1 - floatingScale) / 2 + (31 + 24) * floatingScale + 7}px`,
        "--expand-tooltip-right": `${viewport.width - (viewport.width * (1 - floatingScale) / 2 + viewport.width * floatingScale - 12 * floatingScale)}px`,
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
      <div className="transition-backdrop" aria-hidden="true" onPointerDown={() => onClose?.(layer.key)} onClick={() => onClose?.(layer.key)} />

      {!layer.closing ? (
        <div className="memory-contours" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      ) : null}

      <section className="object-window" aria-label={`${layer.sourceLabel || "Embedded object"} window`}>
        {layer.phase === "floating" && !layer.closing ? (
          <button
            className="object-window-expand"
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
        <span
          id={expandTooltipId}
          className={`object-window-expand-tooltip ${expandHintVisible ? "is-visible" : ""}`}
          role="tooltip"
          style={expandTooltipStyle}
        >
          Expand to full view · ]
        </span>
      ) : null}

      <div
        className="source-echo"
        data-address={layer.sourceAddress || ""}
        data-label={layer.sourceLabel || "Embedded object"}
        aria-hidden="true"
      >
        <SourceIcon size={12} stroke={1.7} />
        <span>{layer.sourceLabel}</span>
        <small>{layer.sourceAddress}</small>
      </div>
    </div>
  );
}
