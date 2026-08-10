import { useEffect, useId, useRef, useState } from "react";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";

export function SelectMenu({ value, options, onChange, ariaLabel, disabled = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const optionRefs = useRef([]);
  const listboxId = useId();
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selected = options[selectedIndex] || options[0];

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    window.addEventListener("pointerdown", closeOutside);
    window.requestAnimationFrame(() => {
      const preferred = optionRefs.current[selectedIndex];
      const firstEnabled = optionRefs.current.find((option) => option && !option.disabled);
      (preferred?.disabled ? firstEnabled : preferred)?.focus();
    });
    return () => window.removeEventListener("pointerdown", closeOutside);
  }, [open, selectedIndex]);

  const closeAndRestore = () => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const selectOption = (option) => {
    if (option.disabled) return;
    onChange(option.value);
    closeAndRestore();
  };

  const handleListKeyDown = (event) => {
    const enabledOptions = optionRefs.current.filter((option) => option && !option.disabled);
    const activeIndex = enabledOptions.indexOf(document.activeElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const next = (activeIndex + direction + enabledOptions.length) % enabledOptions.length;
      enabledOptions[next]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      event.stopPropagation();
      enabledOptions[event.key === "Home" ? 0 : enabledOptions.length - 1]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeAndRestore();
    } else if (event.key === "Tab") {
      setOpen(false);
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const query = event.key.toLocaleLowerCase();
      const start = Math.max(0, activeIndex + 1);
      const ordered = [...enabledOptions.slice(start), ...enabledOptions.slice(0, start)];
      const match = ordered.find((option) => option.textContent?.trim().toLocaleLowerCase().startsWith(query));
      if (match) {
        event.preventDefault();
        event.stopPropagation();
        match.focus();
      }
    }
  };

  return (
    <div className="tactile-select" ref={rootRef}>
      <button
        ref={triggerRef}
        className="tactile-select-trigger"
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(true);
          }
        }}
      >
        <span>{selected?.label || "Select"}</span>
        <IconChevronDown size={13} stroke={1.65} />
      </button>
      {open ? (
        <div id={listboxId} className="tactile-select-popover" role="listbox" aria-label={ariaLabel} onKeyDown={handleListKeyDown}>
          {options.map((option, index) => (
            <button
              ref={(element) => { optionRefs.current[index] = element; }}
              className={option.value === value ? "is-selected" : ""}
              type="button"
              role="option"
              aria-selected={option.value === value}
              disabled={option.disabled}
              key={option.value}
              onClick={() => selectOption(option)}
            >
              <span>{option.label}</span>
              {option.detail ? <small>{option.detail}</small> : null}
              {option.value === value ? <IconCheck size={13} stroke={1.8} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
