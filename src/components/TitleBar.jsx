import { useEffect, useRef, useState } from "react";
import { IconCopy, IconMinus, IconSquare, IconX } from "@tabler/icons-react";
import { resolveTauriInvoke } from "../platform/tauri/runtime.ts";

const RESIZE_HANDLES = [
  { direction: "northWest", className: "resize-handle-nw" },
  { direction: "north", className: "resize-handle-n" },
  { direction: "northEast", className: "resize-handle-ne" },
  { direction: "east", className: "resize-handle-e" },
  { direction: "southEast", className: "resize-handle-se" },
  { direction: "south", className: "resize-handle-s" },
  { direction: "southWest", className: "resize-handle-sw" },
  { direction: "west", className: "resize-handle-w" },
];

function useDocumentTitle() {
  const [title, setTitle] = useState(() => (typeof document !== "undefined" ? document.title : ""));
  useEffect(() => {
    const sync = () => setTitle(document.title);
    const target = document.querySelector("title");
    const observer = target
      ? new MutationObserver(sync)
      : null;
    observer?.observe(target, { childList: true, characterData: true, subtree: true });
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  return title;
}

const DRAG_THRESHOLD = 4;

/**
 * Starts a native window drag only after the pointer has moved past a small
 * threshold while the left button is held. Starting the OS move loop directly
 * on `mousedown` captures the pointer and swallows the second press of a
 * double-click, so the title bar's double-click-to-maximize would never fire.
 * Deferring until movement keeps quick clicks (and double-clicks) untouched
 * while still dragging normally.
 */
function beginDrag(invoke, event) {
  if (event.button !== 0) return;
  event.preventDefault();
  const startX = event.screenX;
  const startY = event.screenY;
  let started = false;

  const onMove = (moveEvent) => {
    if (started) return;
    const dx = moveEvent.screenX - startX;
    const dy = moveEvent.screenY - startY;
    if (Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
      started = true;
      cleanup();
      invoke?.("window_start_drag").catch(() => {});
    }
  };
  const onUp = () => {
    if (!started) cleanup();
  };
  const cleanup = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

function beginResize(invoke, direction, event) {
  if (event.button !== 0) return;
  event.preventDefault();
  invoke?.("window_start_resize", { direction }).catch(() => {});
}

/**
 * Native-only replacement for the OS title bar. Rendered only inside the Tauri
 * shell; it drives the frameless window through custom commands (move, resize,
 * minimize, maximize, close) so the app never depends on @tauri-apps/api.
 */
export function TitleBar() {
  const invokeRef = useRef(null);
  const [maximized, setMaximized] = useState(false);
  const title = useDocumentTitle();

  useEffect(() => {
    invokeRef.current = resolveTauriInvoke();
    import("./TitleBar.css").catch(() => {});
  }, []);

  const call = (command, payload) => {
    const invoke = invokeRef.current;
    if (!invoke) return Promise.resolve();
    return invoke(command, payload).catch(() => {});
  };

  const updateMaximizeState = () => {
    const invoke = invokeRef.current;
    invoke?.("window_is_maximized").then((value) => setMaximized(Boolean(value))).catch(() => {});
  };

  useEffect(() => {
    const invoke = invokeRef.current;
    if (!invoke) return undefined;
    updateMaximizeState();
    const timer = window.setInterval(updateMaximizeState, 400);
    window.addEventListener("resize", updateMaximizeState);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", updateMaximizeState);
    };
  }, []);

  return (
    <header className="title-bar" aria-label="Window title bar" data-maximized={maximized ? "true" : undefined}>
      <div
        className="title-bar-drag"
        onMouseDown={(event) => beginDrag(invokeRef.current, event)}
        onDoubleClick={(event) => {
          if (event.button !== 0) return;
          call("window_toggle_maximize");
        }}
      >
        <img className="title-bar-mark" src="/tactile-mark.svg" alt="" />
        <span className="title-bar-name">Tactile</span>
        <span className="title-bar-title">{title.replace(/^Tactile —\s*/, "")}</span>
      </div>

      <div className="title-bar-controls" aria-label="Window controls">
        <button type="button" onClick={() => call("window_minimize")} aria-label="Minimize" data-tooltip="Minimize">
          <IconMinus size={13} stroke={1.6} />
        </button>
        <button type="button" onClick={() => call("window_toggle_maximize")} aria-label={maximized ? "Restore" : "Maximize"} data-tooltip={maximized ? "Restore" : "Maximize"}>
          {maximized ? <IconCopy size={11} stroke={1.6} /> : <IconSquare size={11} stroke={1.6} />}
        </button>
        <button type="button" className="title-bar-close" onClick={() => call("window_close")} aria-label="Close" data-tooltip="Close">
          <IconX size={14} stroke={1.6} />
        </button>
      </div>

      {RESIZE_HANDLES.map(({ direction, className }) => (
        <div
          key={direction}
          className={`title-bar-resize ${className}`}
          data-resize={direction}
          onMouseDown={(event) => beginResize(invokeRef.current, direction, event)}
        />
      ))}
    </header>
  );
}