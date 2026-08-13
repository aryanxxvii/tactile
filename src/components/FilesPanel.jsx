import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconCopy,
  IconHome,
  IconPalette,
  IconPencil,
  IconPin,
  IconPinned,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { OBJECT_ICON_COLORS, ObjectGlyph, iconEmojiValue } from "./ObjectGlyph.jsx";
import { PaperPortal } from "./PaperPortal.jsx";
import { searchFilesIndex, validateObjectTitle } from "../shell/filesIndex.js";
import { FILES_MAX_WIDTH, FILES_MIN_WIDTH } from "../shell/useShellState.js";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "tiles", label: "Tiles" },
  { id: "text", label: "Text" },
  { id: "files", label: "Files" },
];

const EMOJI_PRESETS = ["⭐", "📌", "💡", "📝", "📁", "✅"];

function IconCustomizer({ entry, onChange, onClose, popoverRef }) {
  const [mode, setMode] = useState(() => (iconEmojiValue(entry.iconEmoji) ? "emoji" : "default"));
  const [draft, setDraft] = useState(() => iconEmojiValue(entry.iconEmoji));
  const hasCustomization = Boolean(iconEmojiValue(entry.iconEmoji) || entry.iconColor);

  useEffect(() => {
    setMode(iconEmojiValue(entry.iconEmoji) ? "emoji" : "default");
    setDraft(iconEmojiValue(entry.iconEmoji));
  }, [entry.objectId, entry.iconEmoji]);

  const applyEmoji = () => {
    const emoji = iconEmojiValue(draft);
    if (!emoji) return;
    onChange?.({ iconEmoji: emoji });
  };

  return (
    <div
      ref={popoverRef}
      className="files-icon-popover"
      role="dialog"
      aria-label={`Customize icon for ${entry.title}`}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose?.();
        } else if (event.key === "Enter" && mode === "emoji" && event.target.tagName === "INPUT") {
          event.preventDefault();
          applyEmoji();
        }
      }}
    >
      <div className="files-icon-popover-heading">
        <ObjectGlyph item={entry} size={15} />
        <strong>Object icon</strong>
      </div>
      <div className="files-icon-mode" role="group" aria-label="Icon style">
        <button
          type="button"
          className={mode === "default" ? "is-active" : ""}
          aria-pressed={mode === "default"}
          onClick={() => {
            setMode("default");
            onChange?.({ iconEmoji: "" });
          }}
        >
          Default
        </button>
        <button
          type="button"
          className={mode === "emoji" ? "is-active" : ""}
          aria-pressed={mode === "emoji"}
          onClick={() => setMode("emoji")}
        >
          Emoji
        </button>
      </div>

      {mode === "default" ? (
        <div className="files-icon-colors" role="listbox" aria-label="Icon color">
          {OBJECT_ICON_COLORS.map((color) => (
            <button
              key={color.id || "default"}
              type="button"
              className={!iconEmojiValue(entry.iconEmoji) && (entry.iconColor || "") === color.id ? "is-selected" : ""}
              aria-label={color.label}
              aria-selected={!iconEmojiValue(entry.iconEmoji) && (entry.iconColor || "") === color.id}
              role="option"
              onClick={() => onChange?.({ iconEmoji: "", iconColor: color.id })}
            >
              <span className={!color.id ? "is-default" : ""} style={{ background: color.color }} aria-hidden="true" />
              {!iconEmojiValue(entry.iconEmoji) && (entry.iconColor || "") === color.id ? <IconCheck size={11} stroke={2.2} /> : null}
            </button>
          ))}
        </div>
      ) : (
        <div className="files-icon-emoji-editor">
          <div className="files-icon-emoji-field">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="e.g. 🧠"
              aria-label="Custom emoji"
              autoComplete="off"
              spellCheck="false"
            />
            <button type="button" onClick={applyEmoji} disabled={!iconEmojiValue(draft)}>
              Use
            </button>
          </div>
          <div className="files-emoji-presets" aria-label="Suggested emoji">
            {EMOJI_PRESETS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`Use ${emoji} emoji`}
                onClick={() => {
                  setDraft(emoji);
                  onChange?.({ iconEmoji: emoji });
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {hasCustomization ? (
        <button
          className="files-icon-reset"
          type="button"
          onClick={() => {
            setMode("default");
            setDraft("");
            onChange?.({ iconEmoji: "", iconColor: "" });
          }}
        >
          Reset icon
        </button>
      ) : null}
    </div>
  );
}

function parentRouteFor(location) {
  if (!location?.segments?.length) return null;
  const pathTitles = location.pathTitles?.slice(0, -1) || [];
  return {
    ...location,
    segments: location.segments.slice(0, -1),
    pathTitles,
    pathLabel: pathTitles.join(" / "),
  };
}

function FilesRenamePopover({ entry, index, x, y, themeSource, onClose, onCommit }) {
  const popoverRef = useRef(null);
  const inputRef = useRef(null);
  const [draft, setDraft] = useState(() => entry.title);
  const [error, setError] = useState(null);
  const [position, setPosition] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const updatePosition = () => {
      const popoverBox = popoverRef.current?.getBoundingClientRect();
      if (!popoverBox) return;
      const left = Math.min(Math.max(8, x), Math.max(8, window.innerWidth - popoverBox.width - 8));
      const top = Math.min(Math.max(8, y), Math.max(8, window.innerHeight - popoverBox.height - 8));
      setPosition({ left, top });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [x, y]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const closeOutside = (event) => {
      if (!popoverRef.current?.contains(event.target)) onClose?.();
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [onClose]);

  const submit = (event) => {
    event.preventDefault();
    const result = validateObjectTitle(index, entry.objectId, draft);
    if (!result.valid) {
      setError(result);
      inputRef.current?.focus();
      return;
    }
    onCommit?.(result.title);
  };

  return (
    <PaperPortal className="tactile-context-menu-layer" themeSource={themeSource}>
      <div
        ref={popoverRef}
        className="files-rename-popover"
        role="dialog"
        aria-labelledby="files-rename-title"
        style={{ left: position.left, top: position.top }}
        onContextMenu={(event) => event.preventDefault()}
      >
        <form className="files-rename-form" onSubmit={submit}>
          <div className="files-rename-heading">
            <IconPencil size={14} stroke={1.7} aria-hidden="true" />
            <strong id="files-rename-title">Rename object</strong>
          </div>
          <label className="files-rename-field">
            <span>Object name</span>
            <input
              ref={inputRef}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  onClose?.();
                }
              }}
              aria-label="Object name"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "files-rename-error" : undefined}
              spellCheck="false"
              autoComplete="off"
            />
          </label>
          {error ? (
            <small id="files-rename-error" className="files-rename-error" role="alert">
              {error.message}
            </small>
          ) : null}
          <div className="files-rename-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className="is-primary">Rename</button>
          </div>
        </form>
      </div>
    </PaperPortal>
  );
}

function FilesContextMenu({ menu, menuRef, themeSource, onClose, onOpen, onRename, onSetHome, onToggle, onCustomize, onCopyPath }) {
  const parentRoute = parentRouteFor(menu.location);
  const [position, setPosition] = useState({ left: menu.x, top: menu.y });

  useLayoutEffect(() => {
    const updatePosition = () => {
      const menuBox = menuRef.current?.getBoundingClientRect();
      if (!menuBox) return;
      const left = Math.min(Math.max(8, menu.x), Math.max(8, window.innerWidth - menuBox.width - 8));
      const top = Math.min(Math.max(8, menu.y), Math.max(8, window.innerHeight - menuBox.height - 8));
      setPosition({ left, top });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [menu.x, menu.y, menuRef]);

  const handleKeyDown = (event) => {
    const items = [...event.currentTarget.querySelectorAll('[role="menuitem"]:not(:disabled)')];
    const activeIndex = items.indexOf(document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose?.();
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      const nextIndex = event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : activeIndex < 0
            ? 0
            : (activeIndex + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[nextIndex]?.focus();
    }
  };

  return (
    <PaperPortal className="tactile-context-menu-layer" themeSource={themeSource}>
    <div
      ref={menuRef}
      className="files-context-menu"
      role="menu"
      aria-label={`Actions for ${menu.entry.title}`}
      style={{ left: position.left, top: position.top }}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={handleKeyDown}
    >
      <div className="files-context-menu-heading">
        <ObjectGlyph item={menu.entry} size={14} stroke={1.6} />
        <span>{menu.entry.title}</span>
      </div>
      <button className="files-context-menu-item" type="button" role="menuitem" aria-label="Open" onClick={() => onOpen()} data-context-action="open">
        <IconChevronRight size={14} stroke={1.7} />
        <span>Open</span>
        <kbd>↵</kbd>
      </button>
      <button className="files-context-menu-item" type="button" role="menuitem" aria-label="Rename" onClick={onRename} data-context-action="rename">
        <IconPencil size={14} stroke={1.7} />
        <span>Rename</span>
      </button>
      <button
        className="files-context-menu-item"
        type="button"
        role="menuitem"
        aria-label="Set as start"
        onClick={onSetHome}
        disabled={menu.entry.isStart}
        data-context-action="set-start"
      >
        <IconHome size={14} stroke={1.7} />
        <span>Set as start</span>
        {menu.entry.isStart ? <small>Current</small> : null}
      </button>
      {parentRoute ? (
        <button className="files-context-menu-item" type="button" role="menuitem" aria-label="Open parent" onClick={() => onOpen(parentRoute)} data-context-action="open-parent">
          <IconChevronDown size={14} stroke={1.7} />
          <span>Open parent</span>
        </button>
      ) : null}
      {menu.hasChildren ? (
        <button className="files-context-menu-item" type="button" role="menuitem" aria-label={menu.expanded ? "Collapse children" : "Expand children"} onClick={onToggle} data-context-action="toggle-children">
          {menu.expanded ? <IconChevronDown size={14} stroke={1.7} /> : <IconChevronRight size={14} stroke={1.7} />}
          <span>{menu.expanded ? "Collapse children" : "Expand children"}</span>
        </button>
      ) : null}
      <div className="files-context-menu-divider" />
      <button className="files-context-menu-item" type="button" role="menuitem" aria-label="Customize icon" onClick={onCustomize} data-context-action="customize-icon">
        <IconPalette size={14} stroke={1.7} />
        <span>Customize icon</span>
      </button>
      <button className="files-context-menu-item" type="button" role="menuitem" aria-label="Copy path" onClick={onCopyPath} data-context-action="copy-path">
        <IconCopy size={14} stroke={1.7} />
        <span>Copy path</span>
      </button>
    </div>
    </PaperPortal>
  );
}

function TreeRow({
  entry,
  depth,
  isAlias = false,
  hasChildren = false,
  expanded = false,
  active = false,
  onToggle,
  onOpen,
  customizerOpen = false,
  onCustomize,
  onUpdateIcon,
  onCloseCustomizer,
  popoverRef,
  onContextMenu,
}) {
  return (
    <div
      className={`files-tree-row ${active ? "is-active" : ""} ${isAlias ? "is-alias" : ""} ${depth === 0 ? "is-root" : ""} ${customizerOpen ? "has-icon-popover" : ""}`}
      style={{ "--files-depth": depth }}
      data-object-id={entry.objectId}
      role="treeitem"
      aria-haspopup="menu"
      aria-current={active ? "page" : undefined}
      aria-expanded={hasChildren ? expanded : undefined}
      tabIndex={active ? 0 : -1}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" && hasChildren && !expanded) {
          event.preventDefault();
          onToggle?.();
        } else if (event.key === "ArrowLeft" && hasChildren && expanded) {
          event.preventDefault();
          onToggle?.();
        } else if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
          event.preventDefault();
          onContextMenu?.(event);
        } else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen?.();
        }
      }}
      onContextMenu={onContextMenu}
    >
      {Array.from({ length: depth }, (_, guideDepth) => (
        <span
          className="files-tree-guide"
          key={guideDepth}
          style={{ "--files-guide-depth": guideDepth }}
          aria-hidden="true"
        />
      ))}
      <button
        className="files-tree-disclosure"
        type="button"
        tabIndex={-1}
        aria-label={hasChildren ? (expanded ? `Collapse ${entry.title}` : `Expand ${entry.title}`) : undefined}
        disabled={!hasChildren}
        onClick={(event) => {
          event.stopPropagation();
          onToggle?.();
        }}
      >
        {hasChildren ? (expanded ? <IconChevronDown size={13} stroke={1.7} /> : <IconChevronRight size={13} stroke={1.7} />) : null}
      </button>
      <button
        className="files-tree-icon-button"
        type="button"
        aria-label={`Open ${entry.title}`}
        onClick={(event) => {
          event.stopPropagation();
          onOpen?.();
        }}
      >
        <ObjectGlyph item={entry} className="files-tree-icon" size={14} stroke={1.6} />
      </button>
      <button className="files-tree-open" type="button" onClick={onOpen} aria-label={`Open ${entry.title}`}>
        <span className="files-tree-title">{entry.title}</span>
        {entry.isStart ? <IconHome className="files-home-icon" size={12} stroke={1.7} aria-label="Start" /> : null}
        <span className="files-tree-kind">{isAlias ? "Alias" : entry.typeLabel}</span>
      </button>
      <button
        className="files-tree-customize"
        type="button"
        aria-label={`Customize icon for ${entry.title}`}
        aria-expanded={customizerOpen}
        onClick={(event) => {
          event.stopPropagation();
          onCustomize?.();
        }}
      >
        <IconPalette size={13} stroke={1.65} />
      </button>
      {customizerOpen ? (
        <IconCustomizer entry={entry} onChange={onUpdateIcon} onClose={onCloseCustomizer} popoverRef={popoverRef} />
      ) : null}
    </div>
  );
}

function flattenTree(index, expanded, activeObjectId) {
  const rows = [];
  const visit = (objectId, depth, location = null) => {
    const entry = index.entryByObjectId.get(objectId);
    if (!entry) return;
    const isAlias = Boolean(location?.isAlias);
    rows.push({
      key: location?.linkId || objectId,
      entry,
      depth,
      isAlias,
      location: location?.route || entry.canonical,
      hasChildren: !isAlias && (index.canonicalChildren.get(objectId)?.length || 0) > 0,
      expanded: expanded.has(objectId),
      active: objectId === activeObjectId,
    });
    if (isAlias || !expanded.has(objectId)) return;
    (index.canonicalChildren.get(objectId) || []).forEach((childId) => visit(childId, depth + 1));
    (index.aliasesByParent.get(objectId) || []).forEach((edge) => {
      const aliasEntry = index.entryByObjectId.get(edge.objectId);
      if (!aliasEntry) return;
      visit(edge.objectId, depth + 1, {
        isAlias: true,
        linkId: edge.linkId,
        route: aliasEntry.locations.find((location) => location?.segments?.at(-1)?.linkId === edge.linkId),
      });
    });
  };
  index.roots.forEach((rootId) => visit(rootId, 0));
  return rows;
}

export function FilesPanel({
  index,
  activeObjectId,
  pinned = false,
  width = 360,
  onOpenRoute,
  onUpdateObject,
  onSetHome,
  onNotice,
  onTogglePinned,
  onResize,
  onResizeStateChange,
  onClose,
}) {
  const panelRef = useRef(null);
  const searchRef = useRef(null);
  const contextMenuRef = useRef(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [expanded, setExpanded] = useState(() => new Set(index?.roots?.slice(0, 1) || []));
  const [selectedId, setSelectedId] = useState(activeObjectId || index?.roots?.[0] || "");
  const [customizingKey, setCustomizingKey] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [renameState, setRenameState] = useState(null);
  const [resizing, setResizing] = useState(false);
  const customizerRef = useRef(null);
  const resizeRef = useRef(null);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    if (activeObjectId) setSelectedId(activeObjectId);
  }, [activeObjectId]);

  useEffect(() => {
    if (!activeObjectId || !index?.entryByObjectId?.has(activeObjectId)) return;
    const activeEntry = index.entryByObjectId.get(activeObjectId);
    const next = new Set(expanded);
    activeEntry?.canonical?.segments?.forEach((segment) => next.add(segment.sourceObjectId));
    next.add(activeEntry?.canonical?.rootObjectId);
    setExpanded(next);
  }, [activeObjectId, index]);

  useEffect(() => {
    if (!customizingKey) return undefined;
    const handlePointerDown = (event) => {
      if (!customizerRef.current?.contains(event.target)) setCustomizingKey(null);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [customizingKey]);

  useEffect(() => {
    if (!contextMenu) return undefined;
    const handlePointerDown = (event) => {
      if (!contextMenuRef.current?.contains(event.target)) setContextMenu(null);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu) return;
    contextMenuRef.current?.querySelector('[role="menuitem"]:not(:disabled)')?.focus();
  }, [contextMenu]);

  useEffect(() => {
    if (!resizing) return undefined;
    const handlePointerMove = (event) => {
      const start = resizeRef.current;
      if (!start) return;
      onResize?.(start.width + event.clientX - start.x);
    };
    const stopResizing = () => {
      resizeRef.current = null;
      setResizing(false);
      onResizeStateChange?.(false);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing);
    window.addEventListener("pointercancel", stopResizing);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("pointercancel", stopResizing);
    };
  }, [onResize, onResizeStateChange, resizing]);

  const results = useMemo(
    () => searchFilesIndex(index, deferredQuery, category, 100),
    [category, deferredQuery, index],
  );
  const treeRows = useMemo(
    () => flattenTree(index, expanded, selectedId),
    [expanded, index, selectedId],
  );
  const searching = Boolean(deferredQuery.trim());
  const openRoute = (route) => {
    if (!route) return;
    setContextMenu(null);
    setRenameState(null);
    onOpenRoute?.(route);
    if (!pinned) onClose?.();
  };

  const openContextMenu = (event, row) => {
    event.preventDefault();
    event.stopPropagation();
    const panelBox = panelRef.current?.getBoundingClientRect();
    if (!panelBox) return;
    const sourceBox = event.currentTarget?.getBoundingClientRect?.();
    const clientX = Number.isFinite(event.clientX)
      ? event.clientX
      : (sourceBox?.left || panelBox.left) + Math.min(sourceBox?.width || 16, 24);
    const clientY = Number.isFinite(event.clientY)
      ? event.clientY
      : (sourceBox?.bottom || panelBox.top + 24);
    setSelectedId(row.entry.objectId);
    setCustomizingKey(null);
    setRenameState(null);
    setContextMenu({
      ...row,
      x: clientX,
      y: clientY,
    });
  };

  const handleSetHome = () => {
    if (!contextMenu || contextMenu.entry.isStart) return;
    const current = contextMenu;
    setContextMenu(null);
    onSetHome?.(current.entry.objectId, current.location);
  };

  const handleContextRename = () => {
    if (!contextMenu) return;
    const current = contextMenu;
    setContextMenu(null);
    setCustomizingKey(null);
    setRenameState({
      objectId: current.entry.objectId,
      title: current.entry.title,
      x: current.x,
      y: current.y,
    });
  };

  const handleContextCustomize = () => {
    if (!contextMenu) return;
    const key = contextMenu.customizerKey;
    setContextMenu(null);
    setCustomizingKey(key);
  };

  const handleContextCopyPath = async () => {
    if (!contextMenu) return;
    const current = contextMenu;
    const path = current.location?.pathLabel || current.entry.title;
    setContextMenu(null);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(path);
      onNotice?.("Object path copied");
    } catch {
      onNotice?.("Could not copy the object path");
    }
  };

  const handlePanelKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (renameState) {
        setRenameState(null);
        return;
      }
      if (contextMenu) {
        setContextMenu(null);
        return;
      }
      onClose?.();
      return;
    }
    if (!searching || !["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) return;
    const options = [...event.currentTarget.querySelectorAll('[role="option"]')];
    if (!options.length) return;
    const activeIndex = options.indexOf(document.activeElement);
    if (event.key === "Enter") {
      event.preventDefault();
      options[activeIndex >= 0 ? activeIndex : 0].click();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex = activeIndex < 0
        ? 0
        : (activeIndex + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
      const next = options[nextIndex];
      setSelectedId(next.getAttribute("data-object-id") || "");
      next.focus();
    }
  };

  const toggleExpanded = (objectId) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(objectId)) next.delete(objectId);
      else next.add(objectId);
      return next;
    });
  };

  const beginResize = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    resizeRef.current = { x: event.clientX, width };
    setResizing(true);
    onResizeStateChange?.(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const adjustWidth = (delta) => onResize?.(width + delta);

  const handleResizeKeyDown = (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      adjustWidth(-16);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      adjustWidth(16);
    } else if (event.key === "Home") {
      event.preventDefault();
      onResize?.(FILES_MIN_WIDTH);
    } else if (event.key === "End") {
      event.preventDefault();
      onResize?.(FILES_MAX_WIDTH);
    }
  };

  return (
    <div className={`files-layer ${pinned ? "is-pinned" : ""}`} role="presentation">
      <button
        className={`files-scrim ${pinned ? "is-hidden" : ""}`}
        type="button"
        aria-label="Close Files"
        aria-hidden={pinned ? "true" : undefined}
        tabIndex={pinned ? -1 : undefined}
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        className={`files-panel ${resizing ? "is-resizing" : ""}`}
        role={pinned ? "complementary" : "dialog"}
        aria-modal={pinned ? undefined : "true"}
        aria-labelledby="files-panel-title"
        onKeyDown={handlePanelKeyDown}
      >
        <div
          className={`files-resize-handle ${resizing ? "is-active" : ""}`}
          role="separator"
          aria-label="Resize Files sidebar"
          aria-orientation="vertical"
          aria-valuemin={FILES_MIN_WIDTH}
          aria-valuemax={FILES_MAX_WIDTH}
          aria-valuenow={Math.round(width)}
          tabIndex={0}
          onPointerDown={beginResize}
          onKeyDown={handleResizeKeyDown}
        />
        <header className="files-panel-header">
          <div>
            <span className="files-panel-kicker">Workspace</span>
            <h2 id="files-panel-title">Files</h2>
          </div>
          <button
            className={`files-pin ${pinned ? "is-active" : ""}`}
            type="button"
            onClick={onTogglePinned}
            aria-label={pinned ? "Unpin Files sidebar" : "Pin Files sidebar"}
            aria-pressed={pinned}
            data-tooltip={pinned ? "Unpin Files sidebar" : "Pin Files as sidebar"}
          >
            {pinned ? <IconPinned size={15} stroke={1.7} /> : <IconPin size={15} stroke={1.7} />}
          </button>
          <button className="files-close" type="button" onClick={onClose} aria-label="Close Files" data-tooltip="Close Files · Esc">
            <IconX size={15} stroke={1.7} />
          </button>
        </header>

        <div className="files-search-shell" role="search">
          <IconSearch size={14} stroke={1.65} aria-hidden="true" />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a file or object"
            aria-label="Search files"
            autoComplete="off"
            spellCheck="false"
          />
          {query ? (
            <button type="button" aria-label="Clear file search" onClick={() => setQuery("")}>
              <IconX size={13} stroke={1.7} />
            </button>
          ) : <kbd>Ctrl P</kbd>}
        </div>

        <div className="files-filter-row" role="group" aria-label="File type filter">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={category === filter.id ? "is-active" : ""}
              aria-pressed={category === filter.id}
              onClick={() => setCategory(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="files-panel-body" aria-live="polite">
          {searching ? (
            <div className="files-results" role="listbox" aria-label="File search results">
              <div className="files-result-count">{results.length} result{results.length === 1 ? "" : "s"}</div>
              {results.map((entry) => (
                <div className={`files-result-group ${customizingKey === `result:${entry.objectId}` ? "has-icon-popover" : ""}`} key={entry.objectId}>
                  <button
                    className={`files-result-row ${entry.objectId === selectedId ? "is-active" : ""}`}
                    type="button"
                    role="option"
                    aria-haspopup="menu"
                    data-object-id={entry.objectId}
                    aria-selected={entry.objectId === selectedId}
                    onContextMenu={(event) => openContextMenu(event, {
                      key: `result:${entry.objectId}`,
                      customizerKey: `result:${entry.objectId}`,
                      entry,
                      depth: 0,
                      isAlias: false,
                      location: entry.canonical,
                      hasChildren: (index.canonicalChildren.get(entry.objectId)?.length || 0) > 0,
                      expanded: expanded.has(entry.objectId),
                    })}
                    onClick={() => {
                      setSelectedId(entry.objectId);
                      openRoute(entry.canonical);
                    }}
                  >
                    <ObjectGlyph item={entry} size={14} stroke={1.6} />
                    <span className="files-result-main">
                      <strong>{entry.title}</strong>
                      <small>{entry.canonical?.pathLabel || entry.typeLabel}</small>
                    </span>
                    {entry.isStart ? <IconHome size={12} stroke={1.7} aria-label="Start" /> : null}
                  </button>
                  <button
                    className="files-result-customize"
                    type="button"
                    aria-label={`Customize icon for ${entry.title}`}
                    aria-expanded={customizingKey === `result:${entry.objectId}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setCustomizingKey((current) => (current === `result:${entry.objectId}` ? null : `result:${entry.objectId}`));
                    }}
                  >
                    <IconPalette size={13} stroke={1.65} />
                  </button>
                  {customizingKey === `result:${entry.objectId}` ? (
                    <IconCustomizer
                      entry={entry}
                      onChange={(patch) => onUpdateObject?.(entry.objectId, patch)}
                      onClose={() => setCustomizingKey(null)}
                      popoverRef={customizerRef}
                    />
                  ) : null}
                  {entry.aliases.length ? (
                    <div className="files-alias-links">
                      {entry.aliases.map((location, aliasIndex) => (
                        <button type="button" key={`${entry.objectId}-alias-${aliasIndex}`} onClick={() => openRoute(location)}>
                          <span>↳</span> {location.pathLabel}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
              {!results.length ? <p className="files-empty-state">No files match “{query}”.</p> : null}
            </div>
          ) : (
            <div className="files-tree" role="tree" aria-label="Workspace files">
              <div className="files-section-label">All objects</div>
              {treeRows.map((row) => (
                <TreeRow
                  key={row.key}
                  entry={row.entry}
                  depth={row.depth}
                  isAlias={row.isAlias}
                  hasChildren={row.hasChildren}
                  expanded={row.expanded}
                  active={row.active}
                  customizerOpen={customizingKey === `tree:${row.key}`}
                  onToggle={() => toggleExpanded(row.entry.objectId)}
                  onCustomize={() => setCustomizingKey((current) => (current === `tree:${row.key}` ? null : `tree:${row.key}`))}
                  onUpdateIcon={(patch) => onUpdateObject?.(row.entry.objectId, patch)}
                  onCloseCustomizer={() => setCustomizingKey(null)}
                  popoverRef={customizerRef}
                  onContextMenu={(event) => openContextMenu(event, {
                    ...row,
                    customizerKey: `tree:${row.key}`,
                  })}
                  onOpen={() => {
                    setSelectedId(row.entry.objectId);
                    openRoute(row.location);
                  }}
                />
              ))}
              {!treeRows.length ? <p className="files-empty-state">No objects are available yet.</p> : null}
            </div>
          )}
        </div>
        <footer className="files-panel-footer">
          <span>Open any object directly</span>
          <span className="files-panel-footer-hint"><kbd>↑↓</kbd> move <kbd>↵</kbd> open</span>
        </footer>
        {contextMenu ? (
          <FilesContextMenu
            menu={contextMenu}
            menuRef={contextMenuRef}
            themeSource={panelRef.current}
            onClose={() => setContextMenu(null)}
            onOpen={(route) => openRoute(route || contextMenu.location)}
            onRename={handleContextRename}
            onSetHome={handleSetHome}
            onToggle={() => {
              toggleExpanded(contextMenu.entry.objectId);
              setContextMenu(null);
            }}
            onCustomize={handleContextCustomize}
            onCopyPath={handleContextCopyPath}
          />
        ) : null}
        {renameState ? (
          <FilesRenamePopover
            entry={index.entryByObjectId.get(renameState.objectId) || { objectId: renameState.objectId, title: renameState.title }}
            index={index}
            x={renameState.x}
            y={renameState.y}
            themeSource={panelRef.current}
            onClose={() => setRenameState(null)}
            onCommit={(title) => {
              onUpdateObject?.(renameState.objectId, { title });
              setRenameState(null);
            }}
          />
        ) : null}
      </aside>
    </div>
  );
}
