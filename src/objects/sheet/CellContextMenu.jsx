import { useEffect, useRef, useState } from "react";
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
import { objectTypeFor } from "../objectTypes.js";

const SheetIcon = objectTypeFor("sheet").icon;
const TextIcon = objectTypeFor("markdown").icon;

function MenuItem({ icon: Icon, label, shortcut, disabled, onSelect }) {
  return (
    <button
      className="cell-menu-item"
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      title={label}
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

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    window.addEventListener("pointerdown", closeOutside);
    return () => window.removeEventListener("pointerdown", closeOutside);
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
          className="cell-menu-submenu"
          role="menu"
          aria-label={label}
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

  useEffect(() => {
    if (!menu) return undefined;
    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) onClose();
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.requestAnimationFrame(() => focusFirstMenuItem(menuRef.current));
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [menu, onClose]);

  if (!menu) return null;
  const invoke = (callback) => async () => {
    await callback?.();
    onClose();
  };
  const left = Math.min(menu.x, window.innerWidth - 224);
  const top = Math.min(menu.y, window.innerHeight - (menu.cell.embed ? 468 : 438));
  const embeddedType = menu.cell.embed ? objectTypeFor(menu.cell.embed.type) : null;

  return (
    <div
      ref={menuRef}
      className={`cell-context-menu ${left > window.innerWidth - 470 ? "submenu-left" : "submenu-right"}`}
      role="menu"
      aria-label={`Commands for ${menu.cell.address}`}
      style={{ left: Math.max(8, left), top: Math.max(8, top) }}
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
      <MenuItem icon={IconCopy} label="Copy" shortcut="Ctrl C" onSelect={invoke(onCopy)} />
      <MenuItem icon={IconClipboard} label="Paste" shortcut="Ctrl V" onSelect={invoke(onPaste)} />
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
  );
}
