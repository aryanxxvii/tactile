import { useEffect, useId, useRef, useState } from "react";
import { IconCheck, IconPalette } from "@tabler/icons-react";

const palette = [
  "#181816", "#4b4944", "#77736b", "#a7a198", "#d8d3ca", "#fbfaf6",
  "#8f352b", "#b34d35", "#cf765b", "#e6a58f", "#7d5264", "#a16f85",
  "#395c70", "#476d82", "#6d91a3", "#657143", "#7f8c58", "#a5ad79",
  "#715a3e", "#967653", "#b69369", "#5c4d73", "#786690", "#9a87b0",
];

function validHex(value) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

export function ColorControl({ label, value, disabled, onChange }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const optionRefs = useRef([]);
  const popoverId = useId();

  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeEscape = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
      }
    };
    window.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  const movePaletteFocus = (event) => {
    const activeIndex = optionRefs.current.indexOf(document.activeElement);
    let nextIndex = activeIndex;
    if (event.key === "ArrowRight") nextIndex += 1;
    else if (event.key === "ArrowLeft") nextIndex -= 1;
    else if (event.key === "ArrowDown") nextIndex += 6;
    else if (event.key === "ArrowUp") nextIndex -= 6;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = palette.length - 1;
    else return;
    event.preventDefault();
    event.stopPropagation();
    const normalized = Math.max(0, Math.min(palette.length - 1, nextIndex));
    optionRefs.current[normalized]?.focus();
  };

  return (
    <div className="color-control" ref={rootRef}>
      <button
        ref={triggerRef}
        className="color-control-trigger"
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        aria-label={`${label}: ${value}`}
        aria-haspopup="dialog"
        aria-controls={open ? popoverId : undefined}
        aria-expanded={open}
      >
        <i style={{ background: validHex(value) ? value : "transparent" }} />
        <span>{label}</span>
        <code>{value}</code>
      </button>
      {open ? (
        <div id={popoverId} className="color-control-popover" role="dialog" aria-label={`${label} color`}>
          <div className="color-popover-heading"><IconPalette size={14} stroke={1.6} /><span>{label}</span></div>
          <div className="color-palette" role="listbox" aria-label="Color palette" onKeyDown={movePaletteFocus}>
            {palette.map((color, index) => (
              <button
                ref={(element) => { optionRefs.current[index] = element; }}
                type="button"
                role="option"
                aria-label={color}
                aria-selected={value.toLowerCase() === color.toLowerCase()}
                key={color}
                style={{ background: color }}
                onClick={() => { onChange(color); setDraft(color); }}
              >
                {value.toLowerCase() === color.toLowerCase() ? <IconCheck size={12} stroke={2.3} /> : null}
              </button>
            ))}
          </div>
          <label className="hex-color-field">
            <span>Hex</span>
            <input
              value={draft}
              aria-label={`${label} hexadecimal color`}
              aria-invalid={!validHex(draft)}
              onChange={(event) => {
                const next = event.target.value;
                setDraft(next);
                if (validHex(next)) onChange(next);
              }}
              onBlur={() => { if (!validHex(draft)) setDraft(value); }}
              spellCheck="false"
              maxLength={7}
            />
            <i style={{ background: validHex(draft) ? draft : value }} />
          </label>
        </div>
      ) : null}
    </div>
  );
}
