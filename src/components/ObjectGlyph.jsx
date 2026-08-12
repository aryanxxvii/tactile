import { IconFile } from "@tabler/icons-react";
import { objectTypeFor } from "../objects/objectTypes.js";

export const OBJECT_ICON_COLORS = Object.freeze([
  { id: "", label: "Default", color: "var(--muted)" },
  { id: "rust", label: "Rust", color: "var(--accent)" },
  { id: "blue", label: "Blue", color: "#416b86" },
  { id: "green", label: "Green", color: "#367c5a" },
  { id: "violet", label: "Violet", color: "#79618f" },
  { id: "amber", label: "Amber", color: "#a9792d" },
  { id: "slate", label: "Slate", color: "#81786d" },
]);

const ICON_COLOR_VALUES = new Map(OBJECT_ICON_COLORS.map(({ id, color }) => [id, color]));

export function iconColorValue(value) {
  return ICON_COLOR_VALUES.get(String(value || "")) || "";
}

export function iconEmojiValue(value) {
  return String(value || "").trim().slice(0, 8);
}

export function ObjectGlyph({ item, className = "", size = 14, stroke = 1.6, style, ...rest }) {
  const emoji = iconEmojiValue(item?.iconEmoji);
  if (emoji) {
    return (
      <span
        className={`object-glyph-emoji ${className}`.trim()}
        style={{ fontSize: Math.max(13, Number(size) || 14), ...style }}
        aria-hidden="true"
        {...rest}
      >
        {emoji}
      </span>
    );
  }

  const definition = objectTypeFor(item?.type);
  const Icon = definition.icon || IconFile;
  const color = iconColorValue(item?.iconColor);
  return (
    <Icon
      className={className}
      size={size}
      stroke={stroke}
      style={{ ...(color ? { color } : {}), ...style }}
      aria-hidden="true"
      {...rest}
    />
  );
}
