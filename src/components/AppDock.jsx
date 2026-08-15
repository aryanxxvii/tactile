import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconFolderOpen,
  IconSettings,
} from "@tabler/icons-react";
import { PaperPortal } from "./PaperPortal.jsx";

const PATH_CLOSE_DELAY = 360;
const PATH_TRANSITION_MS = 180;

function collapsedDockPath(path = []) {
  const entries = path.slice(1);
  if (entries.length <= 4) return { visible: entries, omitted: [] };
  return {
    visible: [entries[0], entries[1], { id: "ellipsis", title: "\u2026" }, entries.at(-2), entries.at(-1)],
    omitted: entries.slice(2, -2),
  };
}

function dockPathSignature(path = []) {
  return path.map((item, index) => `${item.id}:${item.title}:${index}`).join("\u0001");
}

function sameDockPathItem(left, right) {
  return left?.id === right?.id && left?.title === right?.title;
}

function DockPathButton({ item, onNavigate, current = false, overflow = false, controls, expanded = false, buttonRef }) {
  return (
    <button
      className={`app-dock-path-button ${overflow ? "is-overflow" : ""}`}
      type="button"
      aria-label={overflow ? "Show full object path" : `Go to ${item.title}`}
      aria-current={current ? "location" : undefined}
      aria-controls={controls}
      aria-expanded={overflow ? expanded : undefined}
      onClick={() => onNavigate?.(item)}
      data-path-object-id={item.id}
      ref={buttonRef}
    >
      <span className="app-dock-path-button-text">{item.title}</span>
    </button>
  );
}

function FullPathPopover({ id, path, anchorRect, themeSource, onNavigate, onPointerEnter, onPointerLeave }) {
  const popoverRef = useRef(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [marqueeDistances, setMarqueeDistances] = useState({});
  const parentPath = useMemo(() => path.slice(1).reverse(), [path]);

  useLayoutEffect(() => {
    if (!anchorRect) return undefined;
    let frame = 0;
    const updatePosition = () => {
      const popoverBox = popoverRef.current?.getBoundingClientRect();
      if (!popoverBox) {
        frame = window.requestAnimationFrame(updatePosition);
        return;
      }
      const gutter = 8;
      const left = Math.min(
        Math.max(anchorRect.left + anchorRect.width / 2, gutter + popoverBox.width / 2),
        window.innerWidth - gutter - popoverBox.width / 2,
      );
      const top = Math.max(gutter, anchorRect.top - popoverBox.height - 5);
      setPosition({ left, top });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRect]);

  useLayoutEffect(() => {
    const measureLabels = () => {
      const next = {};
      popoverRef.current?.querySelectorAll("[data-ancestry-label]").forEach((label) => {
        const distance = label.scrollWidth - label.clientWidth;
        if (distance > 1) next[label.dataset.ancestryLabel] = distance;
      });
      setMarqueeDistances((current) => {
        const currentKeys = Object.keys(current);
        const nextKeys = Object.keys(next);
        if (currentKeys.length === nextKeys.length && nextKeys.every((key) => current[key] === next[key])) return current;
        return next;
      });
    };
    measureLabels();
    const observer = typeof ResizeObserver === "undefined" || !popoverRef.current
      ? null
      : new ResizeObserver(measureLabels);
    if (observer && popoverRef.current) observer.observe(popoverRef.current);
    window.addEventListener("resize", measureLabels);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measureLabels);
    };
  }, [parentPath]);

  return (
    <PaperPortal className="app-dock-path-portal" themeSource={themeSource}>
      <div
        ref={popoverRef}
        id={id}
        className="app-dock-path-popover"
        role="menu"
        aria-label="Full object path"
        style={{ left: position.left, top: position.top }}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        <div className="app-dock-path-popover-row">
          {parentPath.map((item, index) => (
            <span className="app-dock-path-popover-part" key={`${item.id}-${index}`}>
              <button
                className={`${index === 0 ? "is-current" : ""} ${marqueeDistances[`${item.id}-${index}`] ? "is-marquee" : ""}`.trim()}
                type="button"
                role="menuitem"
                onClick={() => onNavigate?.(item)}
                aria-label={`Go to ${item.title}`}
                aria-current={index === 0 ? "location" : undefined}
                data-path-object-id={item.id}
                style={marqueeDistances[`${item.id}-${index}`]
                  ? { "--marquee-distance": `${marqueeDistances[`${item.id}-${index}`]}px` }
                  : undefined}
              >
                <span className="app-dock-path-popover-label" data-ancestry-label={`${item.id}-${index}`}>
                  {item.title}
                </span>
              </button>
            </span>
          ))}
        </div>
      </div>
    </PaperPortal>
  );
}

function DockPath({ path = [], onNavigatePath }) {
  const { visible: visiblePath, omitted } = useMemo(() => collapsedDockPath(path), [path]);
  const pathKey = useMemo(() => dockPathSignature(visiblePath), [visiblePath]);
  const previousPathRef = useRef(visiblePath);
  const previousPathKeyRef = useRef(pathKey);
  const transitionIdRef = useRef(0);
  const [transition, setTransition] = useState(null);
  const [pathPopoverOpen, setPathPopoverOpen] = useState(false);
  const [pathAnchor, setPathAnchor] = useState(null);
  const closeTimerRef = useRef(null);
  const overflowButtonRef = useRef(null);
  const pathPopoverId = useId();

  useEffect(() => () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
  }, []);

  useLayoutEffect(() => {
    if (previousPathKeyRef.current === pathKey) return undefined;
    const id = transitionIdRef.current + 1;
    transitionIdRef.current = id;
    const from = previousPathRef.current;
    const to = visiblePath;
    previousPathRef.current = to;
    previousPathKeyRef.current = pathKey;
    setPathPopoverOpen(false);
    setPathAnchor(null);
    setTransition({ id, from, to });
    const timer = window.setTimeout(() => {
      setTransition((current) => current?.id === id ? null : current);
    }, PATH_TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [pathKey, visiblePath]);

const openPathPopover = () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    const rect = overflowButtonRef.current?.getBoundingClientRect();
    if (rect) setPathAnchor({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    setPathPopoverOpen(true);
  };
  const closePathPopover = () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setPathPopoverOpen(false);
      setPathAnchor(null);
    }, PATH_CLOSE_DELAY);
  };
  const keepPopoverOpen = () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
  };
  const navigatePath = (item) => {
    onNavigatePath?.(item);
    setPathPopoverOpen(false);
    setPathAnchor(null);
  };

const renderPanel = (items, { entering = false, leaving = false, current = !leaving } = {}) => {
    return (
      <div
        className={`app-dock-path-panel ${entering ? "is-entering" : ""} ${leaving ? "is-leaving" : ""}`.trim()}
        style={{ width: "max-content", justifySelf: "start" }}
        aria-hidden={leaving ? "true" : undefined}
        inert={leaving ? true : undefined}
      >
        {items.map((item, index) => (
          <span className="app-dock-path-part" key={`${item.id}-${index}`}>
            <span className="app-dock-path-divider">/</span>
            {item.id === "ellipsis" ? (
              <span
                className="app-dock-path-overflow"
                onPointerEnter={leaving ? undefined : openPathPopover}
                onPointerLeave={leaving ? undefined : closePathPopover}
                onFocus={leaving ? undefined : openPathPopover}
                onBlur={leaving ? undefined : (event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) closePathPopover();
                }}
              >
                <DockPathButton
                  item={item}
                  overflow
                  onNavigate={leaving ? undefined : openPathPopover}
                  controls={pathPopoverId}
                  expanded={!leaving && pathPopoverOpen}
                  buttonRef={leaving ? undefined : overflowButtonRef}
                />
              </span>
            ) : (
              <DockPathButton
                item={item}
                onNavigate={leaving ? undefined : navigatePath}
                current={current && index === items.length - 1}
              />
            )}
          </span>
        ))}
      </div>
    );
  };

  if (!visiblePath.length && !transition?.from.length) return null;

  const transitionParts = transition ? (() => {
    let sharedLength = 0;
    while (sharedLength < transition.from.length
      && sharedLength < transition.to.length
      && sameDockPathItem(transition.from[sharedLength], transition.to[sharedLength])) {
      sharedLength += 1;
    }
    return {
      shared: transition.from.slice(0, sharedLength),
      from: transition.from.slice(sharedLength),
      to: transition.to.slice(sharedLength),
    };
  })() : null;

  return (
    <nav
      className={`app-dock-path ${transition ? "is-transitioning" : ""}`.trim()}
      style={{ flex: "0 1 auto", minWidth: 0, width: "fit-content", paddingLeft: "6px", display: "inline-flex", alignItems: "center" }}
      aria-label="Object path"
    >
      {transition ? (
        <>
          {transitionParts.shared.length ? renderPanel(transitionParts.shared, {
            current: !transitionParts.to.length,
          }) : null}
          <div style={{ display: "inline-grid", width: "max-content" }}>
            {transitionParts.from.length ? renderPanel(transitionParts.from, { leaving: true }) : null}
            {transitionParts.to.length ? renderPanel(transitionParts.to, { entering: true }) : null}
          </div>
        </>
) : renderPanel(visiblePath)}
      {pathPopoverOpen && omitted.length ? (
        <FullPathPopover
          id={pathPopoverId}
          path={path}
          anchorRect={pathAnchor}
          themeSource={overflowButtonRef.current}
          onNavigate={navigatePath}
          onPointerEnter={keepPopoverOpen}
          onPointerLeave={closePathPopover}
        />
      ) : null}
    </nav>
  );
}

export function AppDock({
  path = [],
  onNavigatePath,
  onOpenFiles,
  filesOpen,
  onOpenSettings,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) {
  const { visible: visiblePath } = useMemo(() => collapsedDockPath(path), [path]);
  const pathKey = useMemo(() => dockPathSignature(visiblePath), [visiblePath]);
  const [pathPresent, setPathPresent] = useState(visiblePath.length > 0);

  useLayoutEffect(() => {
    if (visiblePath.length) {
      setPathPresent(true);
      return undefined;
    }
    const timer = window.setTimeout(() => setPathPresent(false), PATH_TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [pathKey, visiblePath.length]);

  return (
    <div
      className={`app-dock ${pathPresent ? "has-path" : "no-path"}`}
      style={{ justifyContent: "flex-start" }}
      aria-label="Tactile app controls"
    >
      <span className="app-dock-brand">
        <img className="app-dock-mark" src="/tactile-mark.svg" alt="" />
        <span>Tactile</span>
      </span>
      <button
        className={`app-dock-files ${filesOpen ? "is-active" : ""}`}
        type="button"
        onClick={(event) => onOpenFiles?.(event.currentTarget)}
        data-tooltip="Browse files · Ctrl+P"
        aria-label="Browse files"
        aria-expanded={filesOpen}
      >
        <IconFolderOpen size={14} stroke={1.65} />
        <span>Files</span>
      </button>
      {pathPresent ? <DockPath path={path} onNavigatePath={onNavigatePath} /> : null}
      <div className="app-dock-history">
        <button type="button" onClick={onUndo} disabled={!canUndo} data-tooltip="Undo · Ctrl+Z" aria-label="Undo"><IconArrowBackUp size={14} stroke={1.65} /></button>
        <button type="button" onClick={onRedo} disabled={!canRedo} data-tooltip="Redo · Ctrl+Y" aria-label="Redo"><IconArrowForwardUp size={14} stroke={1.65} /></button>
      </div>
      <button className="app-dock-settings" type="button" onClick={(event) => onOpenSettings?.(event.currentTarget)} data-tooltip="Appearance and settings">
        <IconSettings size={14} stroke={1.65} />
        <span>Settings</span>
      </button>
    </div>
  );
}
