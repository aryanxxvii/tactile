import { useMemo } from "react";
import {
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconBold,
  IconEraser,
  IconHash,
  IconHighlight,
  IconPercentage,
  IconPlusMinus,
  IconTextColor,
} from "@tabler/icons-react";

const FILL_COLORS = [
  { value: undefined, label: "No fill", color: "transparent", icon: IconEraser },
  { value: "yellow", label: "Soft yellow", color: "#f4e7a1" },
  { value: "peach", label: "Peach", color: "#f2d3a5" },
  { value: "mint", label: "Mint", color: "#c9e4d2" },
  { value: "blue", label: "Powder blue", color: "#c9dbe0" },
  { value: "lavender", label: "Lavender", color: "#ddd4eb" },
  { value: "rose", label: "Rose", color: "#edced0" },
];

const TEXT_COLORS = [
  { value: undefined, label: "Default ink", color: "#2c2925", icon: IconEraser },
  { value: "accent", label: "Rust", color: "#b84c31" },
  { value: "positive", label: "Green", color: "#367c5a" },
  { value: "negative", label: "Red", color: "#a33a30" },
  { value: "blue", label: "Blue", color: "#416b86" },
  { value: "muted", label: "Muted", color: "#81786d" },
];

function FormatButton({ icon: Icon, label, selected, onSelect }) {
  return (
    <button
      className={selected ? "cell-format-button is-selected" : "cell-format-button"}
      type="button"
      aria-label={label}
      aria-pressed={selected}
      data-tooltip={label}
      onClick={onSelect}
    >
      <Icon size={14} stroke={1.6} />
    </button>
  );
}

function ColorGroup({ label, icon: GroupIcon, colors, selected, onSelect }) {
  return (
    <div className="cell-color-group" role="group" aria-label={label}>
      <GroupIcon size={13} stroke={1.7} aria-hidden="true" />
      <div className="cell-color-swatches">
        {colors.map(({ value, label: colorLabel, color, icon: Icon }) => (
          <button
            key={value || "none"}
            className={`cell-color-swatch ${selected === value ? "is-selected" : ""} ${!value ? "is-clear" : ""}`}
            type="button"
            aria-label={colorLabel}
            aria-pressed={selected === value}
            data-tooltip={colorLabel}
            onClick={() => onSelect(value)}
          >
            {Icon ? <Icon size={11} stroke={1.7} aria-hidden="true" /> : null}
            {value ? <span style={{ backgroundColor: color }} aria-hidden="true" /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CellFormatMenu({ style = {}, onChange, onConditionalChange, hasConditionalFormat }) {
  const currentFill = useMemo(() => style.highlight || undefined, [style.highlight]);

  return (
    <div className="cell-format-toolbar" aria-label="Cell formatting">
      <div className="cell-format-group" role="group" aria-label="Text style">
        <FormatButton icon={IconBold} label={style.bold ? "Remove bold" : "Bold"} selected={Boolean(style.bold)} onSelect={() => onChange?.({ bold: !style.bold })} />
      </div>
      <ColorGroup label="Fill color" icon={IconHighlight} colors={FILL_COLORS} selected={currentFill} onSelect={(value) => onChange?.({ highlight: value })} />
      <ColorGroup label="Text color" icon={IconTextColor} colors={TEXT_COLORS} selected={style.textColor} onSelect={(value) => onChange?.({ textColor: value })} />
      <div className="cell-format-group" role="group" aria-label="Alignment">
        <FormatButton icon={IconAlignLeft} label="Align left" selected={style.align === "left"} onSelect={() => onChange?.({ align: "left" })} />
        <FormatButton icon={IconAlignCenter} label="Align center" selected={style.align === "center"} onSelect={() => onChange?.({ align: "center" })} />
        <FormatButton icon={IconAlignRight} label="Align right" selected={style.align === "right"} onSelect={() => onChange?.({ align: "right" })} />
      </div>
      <div className="cell-format-group" role="group" aria-label="Number format">
        <FormatButton icon={IconHash} label="Number with two decimals" selected={style.numberFormat === "number"} onSelect={() => onChange?.({ numberFormat: style.numberFormat === "number" ? undefined : "number" })} />
        <FormatButton icon={IconPercentage} label="Percent" selected={style.numberFormat === "percent"} onSelect={() => onChange?.({ numberFormat: style.numberFormat === "percent" ? undefined : "percent" })} />
      </div>
      <div className="cell-format-group" role="group" aria-label="Conditional formatting">
        <FormatButton icon={IconPlusMinus} label={hasConditionalFormat ? "Remove color rules" : "Color values by sign"} selected={hasConditionalFormat} onSelect={() => onConditionalChange?.(hasConditionalFormat ? null : "sign")} />
        <FormatButton icon={IconEraser} label="Clear formatting" onSelect={() => onChange?.(null)} />
      </div>
    </div>
  );
}
