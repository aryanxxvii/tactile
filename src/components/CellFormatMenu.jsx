import { useEffect, useRef, useState } from "react";
import {
  IconAdjustmentsHorizontal,
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconBold,
  IconEraser,
  IconHash,
  IconHighlight,
  IconPercentage,
  IconPlusMinus,
} from "@tabler/icons-react";
import { focusFirstMenuItem, handleMenuKeyDown } from "./controls/menuKeyboard.js";

function FormatItem({ icon: Icon, label, selected, onSelect }) {
  return (
    <button
      className={selected ? "cell-format-item is-selected" : "cell-format-item"}
      type="button"
      role="menuitem"
      onClick={onSelect}
    >
      <Icon size={14} stroke={1.6} />
      <span>{label}</span>
    </button>
  );
}

export function CellFormatMenu({ style = {}, onChange, onConditionalChange, hasConditionalFormat }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    window.addEventListener("pointerdown", closeOutside);
    window.requestAnimationFrame(() => focusFirstMenuItem(menuRef.current));
    return () => window.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  const invoke = (patch) => () => {
    onChange?.(patch);
    setOpen(false);
  };

  return (
    <div className="cell-format-root" ref={rootRef}>
      <button
        ref={triggerRef}
        className="cell-format-trigger"
        type="button"
        aria-label="Format selected cells"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Format selected cells"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <IconAdjustmentsHorizontal size={14} stroke={1.65} />
        <span>Format</span>
      </button>
      {open ? (
        <div
          ref={menuRef}
          className="cell-format-menu"
          role="menu"
          aria-label="Cell formatting"
          onKeyDown={(event) => handleMenuKeyDown(event, {
            root: menuRef.current,
            onClose: () => setOpen(false),
            restoreFocus: triggerRef.current,
          })}
        >
          <div className="cell-format-label">Text</div>
          <FormatItem icon={IconBold} label={style.bold ? "Remove bold" : "Bold"} selected={Boolean(style.bold)} onSelect={invoke({ bold: !style.bold })} />
          <div className="cell-format-label">Highlight</div>
          <div className="cell-format-inline" aria-label="Cell highlight">
            <FormatItem icon={IconEraser} label="None" selected={!style.highlight} onSelect={invoke({ highlight: undefined })} />
            <FormatItem icon={IconHighlight} label="Warm" selected={style.highlight === "warm"} onSelect={invoke({ highlight: "warm" })} />
            <FormatItem icon={IconHighlight} label="Cool" selected={style.highlight === "cool"} onSelect={invoke({ highlight: "cool" })} />
          </div>
          <div className="cell-format-inline" aria-label="Alignment">
            <FormatItem icon={IconAlignLeft} label="Left" selected={style.align === "left"} onSelect={invoke({ align: "left" })} />
            <FormatItem icon={IconAlignCenter} label="Center" selected={style.align === "center"} onSelect={invoke({ align: "center" })} />
            <FormatItem icon={IconAlignRight} label="Right" selected={style.align === "right"} onSelect={invoke({ align: "right" })} />
          </div>
          <div className="cell-format-separator" />
          <div className="cell-format-label">Number</div>
          <FormatItem icon={IconHash} label="Number · 2 decimals" selected={style.numberFormat === "number"} onSelect={invoke({ numberFormat: "number" })} />
          <FormatItem icon={IconPercentage} label="Percent" selected={style.numberFormat === "percent"} onSelect={invoke({ numberFormat: "percent" })} />
          <div className="cell-format-separator" />
          <div className="cell-format-label">Conditional</div>
          <FormatItem icon={IconPlusMinus} label="Color values by sign" selected={hasConditionalFormat} onSelect={() => { onConditionalChange?.("sign"); setOpen(false); }} />
          {hasConditionalFormat ? <FormatItem icon={IconEraser} label="Clear conditional rule" onSelect={() => { onConditionalChange?.(null); setOpen(false); }} /> : null}
          <div className="cell-format-separator" />
          <FormatItem icon={IconEraser} label="Clear formatting" onSelect={invoke(null)} />
        </div>
      ) : null}
    </div>
  );
}
