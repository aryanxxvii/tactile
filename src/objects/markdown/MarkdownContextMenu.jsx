import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  IconBold,
  IconBrush,
  IconClipboard,
  IconCode,
  IconCopy,
  IconEraser,
  IconHighlight,
  IconItalic,
  IconLink,
  IconList,
  IconListNumbers,
  IconMinus,
  IconPhoto,
  IconQuote,
  IconStrikethrough,
  IconTable,
  IconTrash,
  IconUnderline,
} from "@tabler/icons-react";
import { PaperPortal } from "../../components/PaperPortal.jsx";
import { focusFirstMenuItem, handleMenuKeyDown } from "../../components/controls/menuKeyboard.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function MenuItem({ icon: Icon, label, shortcut, disabled = false, onSelect }) {
  return (
    <button
      className="files-context-menu-item"
      type="button"
      role="menuitem"
      aria-label={label}
      disabled={disabled}
      onClick={onSelect}
    >
      <Icon size={14} stroke={1.65} aria-hidden="true" />
      <span>{label}</span>
      {shortcut ? <kbd>{shortcut}</kbd> : null}
    </button>
  );
}

function ColorRow({ label, icon: Icon, colors, onSelect }) {
  return (
    <div className="files-context-menu-item markdown-context-menu-color-row" role="group" aria-label={label}>
      <Icon size={14} stroke={1.65} aria-hidden="true" />
      <span>{label}</span>
      <div className="cell-color-swatches">
        {colors.map((color) => (
          <button
            key={color.value}
            className="cell-color-swatch"
            type="button"
            role="menuitem"
            aria-label={`${label}: ${color.name}`}
            data-tooltip={color.name}
            onClick={() => onSelect(color.value)}
          >
            <span style={{ backgroundColor: color.value }} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function MarkdownContextMenu({ menu, onClose, onAction, textColors, highlightColors }) {
  const menuRef = useRef(null);
  const [position, setPosition] = useState(null);

  useEffect(() => {
    if (!menu) return undefined;
    let cancelled = false;
    let frame = 0;
    const focusMenu = () => {
      if (cancelled) return;
      if (menuRef.current) {
        focusFirstMenuItem(menuRef.current);
        if (document.activeElement?.closest?.('[role="menu"]') === menuRef.current) return;
      }
      frame = window.requestAnimationFrame(focusMenu);
    };
    const closeOutside = (event) => {
      if (!menuRef.current?.contains(event.target)) onClose();
    };
    window.addEventListener("pointerdown", closeOutside);
    frame = window.requestAnimationFrame(focusMenu);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointerdown", closeOutside);
    };
  }, [menu, onClose]);

  useLayoutEffect(() => {
    if (!menu) {
      setPosition(null);
      return undefined;
    }
    const updatePosition = () => {
      const element = menuRef.current;
      if (!element) return;
      const box = element.getBoundingClientRect();
      const anchor = menu.anchorRect;
      const gutter = 8;
      const gap = 7;
      const width = box.width || 276;
      const height = Math.min(element.scrollHeight || box.height, window.innerHeight - gutter * 2);
      const left = clamp(anchor?.left ?? menu.x, gutter, Math.max(gutter, window.innerWidth - width - gutter));
      const below = (anchor?.bottom ?? menu.y) + gap;
      const above = (anchor?.top ?? menu.y) - gap - height;
      const top = below + height <= window.innerHeight - gutter
        ? below
        : above >= gutter
          ? above
          : clamp(below, gutter, Math.max(gutter, window.innerHeight - height - gutter));
      setPosition({ left, top });
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
  }, [menu]);

  if (!menu) return null;

  const invoke = (action, value) => async () => {
    await onAction?.(action, value);
    onClose();
  };
  const fallbackLeft = clamp(menu.anchorRect?.left ?? menu.x, 8, Math.max(8, window.innerWidth - 284));
  const fallbackTop = clamp(menu.anchorRect?.bottom ?? menu.y, 8, Math.max(8, window.innerHeight - 8));

  return (
    <PaperPortal className="tactile-context-menu-layer" themeSource={menu.sourceElement}>
      <div
        ref={menuRef}
        className="files-context-menu markdown-context-menu"
        role="menu"
        tabIndex={-1}
        aria-label="Markdown selection commands"
        style={{
          left: position?.left ?? fallbackLeft,
          top: position?.top ?? fallbackTop,
          visibility: position ? "visible" : "hidden",
        }}
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={(event) => handleMenuKeyDown(event, {
          root: menuRef.current,
          onClose,
          restoreFocus: menu.sourceElement,
        })}
      >
        <div className="files-context-menu-heading">
          <span>Markdown</span>
          <small>{menu.hasSelection ? "Selected text" : "Place cursor"}</small>
        </div>

        <MenuItem icon={IconTrash} label="Clear content" shortcut="Del" disabled={!menu.hasSelection} onSelect={invoke("clear")} />
        <MenuItem icon={IconCopy} label="Copy" shortcut="Ctrl C" disabled={!menu.hasSelection} onSelect={invoke("copy")} />
        <MenuItem icon={IconClipboard} label="Paste" shortcut="Ctrl V" onSelect={invoke("paste")} />
        <div className="files-context-menu-divider" role="separator" />

        <div className="files-context-menu-heading"><span>Format</span></div>
        <MenuItem icon={IconBold} label="Bold" shortcut="Ctrl B" onSelect={invoke("bold")} />
        <MenuItem icon={IconItalic} label="Italic" shortcut="Ctrl I" onSelect={invoke("italic")} />
        <MenuItem icon={IconUnderline} label="Underline" shortcut="Ctrl U" onSelect={invoke("underline")} />
        <MenuItem icon={IconStrikethrough} label="Strikethrough" shortcut="Ctrl ⇧ X" onSelect={invoke("strike")} />
        <MenuItem icon={IconCode} label="Inline code" onSelect={invoke("inline-code")} />
        <ColorRow label="Text color" icon={IconBrush} colors={textColors} onSelect={invoke("text-color")} />
        <ColorRow label="Background color" icon={IconHighlight} colors={highlightColors} onSelect={invoke("highlight-color")} />
        <div className="files-context-menu-divider" role="separator" />

        <div className="files-context-menu-heading"><span>Insert</span></div>
        <MenuItem icon={IconLink} label="Add link" shortcut="Ctrl K" onSelect={invoke("link")} />
        <MenuItem icon={IconList} label="Bulleted list" onSelect={invoke("bullet")} />
        <MenuItem icon={IconListNumbers} label="Numbered list" onSelect={invoke("numbered")} />
        <MenuItem icon={IconQuote} label="Quote" onSelect={invoke("quote")} />
        <MenuItem icon={IconTable} label="Insert table" onSelect={invoke("table")} />
        <MenuItem icon={IconPhoto} label="Add image" onSelect={invoke("image")} />
        <MenuItem icon={IconMinus} label="Add separator" onSelect={invoke("separator")} />
        <MenuItem icon={IconEraser} label="Code block" onSelect={invoke("code-block")} />
      </div>
    </PaperPortal>
  );
}
