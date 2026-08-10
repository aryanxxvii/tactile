import { useEffect, useId, useRef, useState } from "react";
import {
  IconCheck,
  IconDots,
  IconDownload,
  IconHome,
  IconUpload,
} from "@tabler/icons-react";
import { focusFirstMenuItem, handleMenuKeyDown } from "./controls/menuKeyboard.js";

function WorkspaceMenuItem({ icon: Icon, label, detail, disabled, onClick }) {
  return (
    <button className="workspace-menu-item" type="button" role="menuitem" disabled={disabled} onClick={onClick}>
      <Icon size={14} stroke={1.55} />
      <span>{label}</span>
      {detail ? <small>{detail}</small> : null}
    </button>
  );
}

export function WorkspaceMenu({ isHome, exportState, onSetHome, onExport, onImport }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    window.addEventListener("pointerdown", closeOutside);
    window.requestAnimationFrame(() => focusFirstMenuItem(menuRef.current));
    return () => {
      window.removeEventListener("pointerdown", closeOutside);
    };
  }, [open]);

  const invoke = (callback) => async () => {
    setOpen(false);
    await callback?.();
  };

  return (
    <div className="workspace-menu-root" ref={rootRef}>
      <button
        ref={triggerRef}
        className="workspace-menu-trigger"
        type="button"
        aria-label="Workspace menu"
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <IconDots size={15} stroke={1.8} />
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          className="workspace-menu"
          role="menu"
          aria-label="Workspace commands"
          onKeyDown={(event) => handleMenuKeyDown(event, {
            root: menuRef.current,
            onClose: () => setOpen(false),
            restoreFocus: triggerRef.current,
          })}
        >
          <div className="workspace-menu-label">Local workspace</div>
          <WorkspaceMenuItem
            icon={isHome ? IconCheck : IconHome}
            label={isHome ? "Current home" : "Make this home"}
            detail={isHome ? "opens first" : undefined}
            disabled={isHome}
            onClick={invoke(onSetHome)}
          />
          <div className="workspace-menu-divider" />
          <WorkspaceMenuItem
            icon={IconDownload}
            label={exportState === "exporting" ? "Packing files…" : "Export workspace"}
            detail=".tactile"
            disabled={exportState === "exporting"}
            onClick={invoke(onExport)}
          />
          <WorkspaceMenuItem icon={IconUpload} label="Import workspace" detail="local file" onClick={invoke(onImport)} />
          <p>Sheets stay CSV. Text and media stay separate files.</p>
        </div>
      ) : null}
    </div>
  );
}
