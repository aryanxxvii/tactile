import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  IconArrowBarDown,
  IconArrowBarRight,
  IconClipboard,
  IconCopy,
  IconArrowsSort,
  IconChevronRight,
  IconFilter,
  IconFilterOff,
  IconPictureInPictureTop,
  IconPaperclip,
  IconColumnRemove,
  IconLayersLinked,
  IconRowRemove,
  IconSortAscending,
  IconSortDescending,
  IconTrash,
  IconWindowMaximize,
  IconUnlink,
  IconTableOptions,
} from "@tabler/icons-react";
import { focusFirstMenuItem, handleMenuKeyDown } from "../../components/controls/menuKeyboard.js";
import { PaperPortal } from "../../components/PaperPortal.jsx";
import { objectTypeFor } from "../objectTypes.js";

const SheetIcon = objectTypeFor("sheet").icon;
const TextIcon = objectTypeFor("markdown").icon;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function MenuItem({ icon: Icon, label, shortcut, disabled, onSelect }) {
  return (
    <button
      className="cell-menu-item"
      type="button"
      role="menuitem"
      aria-label={label}
      disabled={disabled}
      onClick={onSelect}
    >
      <Icon size={14} stroke={1.55} aria-hidden="true" />
      <span>{label}</span>
      {shortcut ? <kbd>{shortcut}</kbd> : null}
    </button>
  );
}

function MenuSubmenu({ icon: Icon, label, children }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [placement, setPlacement] = useState({ side: "right", top: -5 });

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    window.addEventListener("pointerdown", closeOutside);
    return () => window.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const updatePlacement = () => {
      const root = rootRef.current;
      const parent = root?.closest(".cell-context-menu");
      const trigger = triggerRef.current;
      const submenu = menuRef.current;
      if (!root || !parent || !trigger || !submenu) return;
      const rootBox = root.getBoundingClientRect();
      const triggerBox = trigger.getBoundingClientRect();
      const width = submenu.offsetWidth;
      const height = submenu.offsetHeight;
      const gutter = 8;
      const gap = 6;
      const canFitRight = rootBox.right + gap + width <= window.innerWidth - gutter;
      const canFitLeft = rootBox.left - gap - width >= gutter;
      const side = canFitRight || !canFitLeft ? "right" : "left";
      const preferredTop = triggerBox.top - rootBox.top - 5;
      const minTop = gutter - rootBox.top;
      const maxTop = window.innerHeight - gutter - height - rootBox.top;
      setPlacement({
        side,
        top: clamp(preferredTop, Math.min(minTop, maxTop), Math.max(minTop, maxTop)),
      });
    };
    updatePlacement();
    const frame = window.requestAnimationFrame(updatePlacement);
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [open]);

  const openMenu = () => {
    setOpen(true);
    window.requestAnimationFrame(() => focusFirstMenuItem(menuRef.current));
  };

  return (
    <div className="cell-menu-submenu-root" ref={rootRef}>
      <button
        ref={triggerRef}
        className="cell-menu-item cell-menu-submenu-trigger"
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            openMenu();
          }
        }}
      >
        <Icon size={14} stroke={1.55} aria-hidden="true" />
        <span>{label}</span>
        <IconChevronRight size={12} stroke={1.7} aria-hidden="true" />
      </button>
      {open ? (
        <div
          ref={menuRef}
          className={`cell-menu-submenu is-${placement.side}`}
          role="menu"
          aria-label={label}
          style={placement.side === "left"
            ? { top: placement.top, right: "calc(100% + 6px)", left: "auto" }
            : { top: placement.top, left: "calc(100% + 6px)", right: "auto" }}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
              triggerRef.current?.focus();
              return;
            }
            handleMenuKeyDown(event, {
              root: menuRef.current,
              onClose: () => setOpen(false),
              restoreFocus: triggerRef.current,
            });
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function CellContextMenu({
  menu,
  onClose,
  onCreate,
  onCopy,
  onPaste,
  onClear,
  onInsertRow,
  onInsertColumn,
  onDeleteRow,
  onDeleteColumn,
  onAttachFile,
  onOpenFloating,
  onOpenFull,
  canCopy = true,
  canPaste = true,
  canClear,
  canSort,
  onSort,
  canGroupRows,
  canUngroupRows,
  onGroupRows,
  onUngroupRows,
  canGroupColumns,
  canUngroupColumns,
  onGroupColumns,
  onUngroupColumns,
  canFilter,
  hasFilters,
  onFilterValue,
  onClearFilters,
}) {
  const menuRef = useRef(null);
  const [position, setPosition] = useState(null);

  useEffect(() => {
    if (!menu) return undefined;
    let cancelled = false;
    let focusFrame = 0;
    let focusAttempts = 0;
    const focusMenu = () => {
      if (cancelled) return;
      if (menuRef.current) {
        menuRef.current.focus({ preventScroll: true });
        if (document.activeElement === menuRef.current || focusAttempts >= 8) return;
      }
      focusAttempts += 1;
      focusFrame = window.requestAnimationFrame(focusMenu);
    };
    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) onClose();
    };
    window.addEventListener("pointerdown", handlePointerDown);
    focusFrame = window.requestAnimationFrame(focusMenu);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("pointerdown", handlePointerDown);
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
      const gap = 8;
      const width = box.width || 216;
      const height = Math.min(element.scrollHeight || box.height, window.innerHeight - gutter * 2);
      const anchorLeft = anchor?.left ?? menu.x;
      const anchorTop = anchor?.top ?? menu.y;
      const anchorBottom = anchor?.bottom ?? menu.y;
      const left = clamp(anchorLeft, gutter, Math.max(gutter, window.innerWidth - width - gutter));
      const below = anchorBottom + gap;
      const above = anchorTop - gap - height;
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
  const invoke = (callback) => async () => {
    await callback?.();
    onClose();
  };
  const embeddedType = menu.cell.embed ? objectTypeFor(menu.cell.embed.type) : null;
  const fallbackLeft = clamp(menu.anchorRect?.left ?? menu.x, 8, Math.max(8, window.innerWidth - 224 - 8));
  const fallbackTop = clamp(menu.anchorRect?.bottom ?? menu.y, 8, Math.max(8, window.innerHeight - 8));

  return (
    <PaperPortal className="tactile-context-menu-layer" themeSource={menu.sourceElement}>
      <div
        ref={menuRef}
        className="cell-context-menu"
        role="menu"
        tabIndex={-1}
        aria-label={`Commands for ${menu.cell.address}`}
        style={{
          left: position?.left ?? fallbackLeft,
          top: position?.top ?? fallbackTop,
          visibility: position ? "visible" : "hidden",
        }}
        onKeyDown={(event) => handleMenuKeyDown(event, {
          root: menuRef.current,
          onClose,
          restoreFocus: menu.sourceElement,
        })}
      >
        <div className="cell-menu-heading">
          <span>{menu.cell.address}</span>
          <small>{embeddedType ? embeddedType.label : "Put something inside"}</small>
        </div>
        {menu.cell.embed ? (
          <>
            <MenuItem icon={IconPictureInPictureTop} label="Open floating" shortcut="]" onSelect={invoke(onOpenFloating)} />
            <MenuItem icon={IconWindowMaximize} label="Open full" onSelect={invoke(onOpenFull)} />
          </>
        ) : (
          <>
            <MenuItem icon={SheetIcon} label="In: Tiles" shortcut="]" onSelect={invoke(() => onCreate("sheet"))} />
            <MenuItem icon={TextIcon} label="In: Text" onSelect={invoke(() => onCreate("markdown"))} />
            <MenuItem icon={IconPaperclip} label="In: Local file…" onSelect={invoke(onAttachFile)} />
          </>
        )}
        <div className="cell-menu-separator" role="separator" />
        <MenuItem icon={IconCopy} label="Copy" shortcut="Ctrl C" disabled={!canCopy} onSelect={invoke(onCopy)} />
        <MenuItem icon={IconClipboard} label="Paste" shortcut="Ctrl V" disabled={!canPaste} onSelect={invoke(onPaste)} />
        <MenuItem icon={IconTrash} label="Clear contents" shortcut="Del" disabled={!canClear} onSelect={invoke(onClear)} />
        <div className="cell-menu-separator" role="separator" />
        <MenuSubmenu icon={IconArrowsSort} label="Sort & filter">
          <MenuItem icon={IconSortAscending} label="Sort selected rows · ascending" disabled={!canSort} onSelect={invoke(() => onSort("asc"))} />
          <MenuItem icon={IconSortDescending} label="Sort selected rows · descending" disabled={!canSort} onSelect={invoke(() => onSort("desc"))} />
          <div className="cell-menu-separator" role="separator" />
          <MenuItem icon={IconFilter} label="Filter rows to this value" disabled={!canFilter} onSelect={invoke(onFilterValue)} />
          <MenuItem icon={IconFilterOff} label="Clear all filters" disabled={!hasFilters} onSelect={invoke(onClearFilters)} />
        </MenuSubmenu>
        <MenuSubmenu icon={IconTableOptions} label="Rows & columns">
          <MenuItem icon={IconLayersLinked} label="Group selected rows" disabled={!canGroupRows} onSelect={invoke(onGroupRows)} />
          <MenuItem icon={IconUnlink} label="Ungroup rows" disabled={!canUngroupRows} onSelect={invoke(onUngroupRows)} />
          <MenuItem icon={IconLayersLinked} label="Group selected columns" disabled={!canGroupColumns} onSelect={invoke(onGroupColumns)} />
          <MenuItem icon={IconUnlink} label="Ungroup columns" disabled={!canUngroupColumns} onSelect={invoke(onUngroupColumns)} />
          <div className="cell-menu-separator" role="separator" />
          <MenuItem icon={IconArrowBarDown} label="Insert row above" onSelect={invoke(onInsertRow)} />
          <MenuItem icon={IconArrowBarRight} label="Insert column left" onSelect={invoke(onInsertColumn)} />
          <MenuItem icon={IconRowRemove} label="Delete row" onSelect={invoke(onDeleteRow)} />
          <MenuItem icon={IconColumnRemove} label="Delete column" onSelect={invoke(onDeleteColumn)} />
        </MenuSubmenu>
      </div>
    </PaperPortal>
  );
}
