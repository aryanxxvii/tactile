import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  IconTextSize,
} from "@tabler/icons-react";
import { PaperPortal } from "./PaperPortal.jsx";

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

const TEXT_SIZES = [
  { value: undefined, label: "Standard", preview: "11.5" },
  { value: 10, label: "Compact", preview: "10" },
  { value: 13, label: "Large", preview: "13" },
  { value: 15, label: "Extra large", preview: "15" },
  { value: 17, label: "Display", preview: "17" },
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

function TextSizeGroup({ selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const current = TEXT_SIZES.find((item) => item.value === selected) || TEXT_SIZES[0];

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    window.addEventListener("pointerdown", closeOutside);
    return () => window.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return undefined;
    const updatePosition = () => {
      const anchorBox = triggerRef.current?.getBoundingClientRect();
      if (!anchorBox) return;
      const menuBox = menuRef.current?.getBoundingClientRect();
      const width = menuBox?.width || 164;
      const height = menuBox?.height || 190;
      const gap = 6;
      const gutter = 8;
      const canFitBelow = anchorBox.bottom + gap + height <= window.innerHeight - gutter;
      const canFitAbove = anchorBox.top - gap - height >= gutter;
      const placement = !canFitBelow && canFitAbove ? "above" : "below";
      const top = placement === "above" ? anchorBox.top - gap - height : anchorBox.bottom + gap;
      const left = Math.min(
        Math.max(gutter, anchorBox.left),
        Math.max(gutter, window.innerWidth - width - gutter),
      );
      setPosition({
        left,
        top: Math.max(gutter, Math.min(window.innerHeight - gutter - height, top)),
        placement,
      });
    };
    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return (
    <div className="cell-size-control" ref={rootRef}>
      <button
        ref={triggerRef}
        className="cell-size-trigger"
        type="button"
        aria-label="Text size"
        aria-haspopup="listbox"
        aria-expanded={open}
        data-tooltip="Text size"
        onClick={() => setOpen((value) => !value)}
      >
        <IconTextSize size={14} stroke={1.65} aria-hidden="true" />
        <span>{current.preview}</span>
      </button>
      {open && position ? (
        <PaperPortal className="tactile-format-layer" themeSource={rootRef.current}>
          <div
            ref={menuRef}
            className={`cell-size-menu is-${position.placement}`}
            role="listbox"
            aria-label="Text size"
            style={{ left: position.left, top: position.top }}
          >
            <div className="cell-size-menu-label">Text size</div>
            {TEXT_SIZES.map((item) => {
              const isSelected = item.value === selected || (!item.value && !selected);
              return (
                <button
                  key={item.label}
                  className={`cell-size-option ${isSelected ? "is-selected" : ""}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onSelect(item.value);
                    setOpen(false);
                  }}
                >
                  <span className="cell-size-preview" style={{ fontSize: `${item.value || 11.5}px` }}>Aa</span>
                  <span>{item.label}</span>
                  <code>{item.preview}</code>
                </button>
              );
            })}
          </div>
        </PaperPortal>
      ) : null}
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
      <TextSizeGroup selected={style.fontSize} onSelect={(value) => onChange?.({ fontSize: value })} />
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
