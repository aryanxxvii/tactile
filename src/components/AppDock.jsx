import { IconArrowBackUp, IconArrowForwardUp, IconSettings } from "@tabler/icons-react";

function dockPath(path = []) {
  const entries = path.slice(1);
  if (entries.length <= 4) return entries;
  return [entries[0], entries[1], { id: "ellipsis", title: "…" }, entries.at(-2), entries.at(-1)];
}

export function AppDock({ path = [], onOpenSettings, onUndo, onRedo, canUndo, canRedo }) {
  const visiblePath = dockPath(path);

  return (
    <div className="app-dock" aria-label="Tactile app controls">
      <span className="app-dock-brand">
        <img className="app-dock-mark" src="/tactile-mark.svg" alt="" />
        <span>Tactile</span>
      </span>
      {visiblePath.length ? (
        <nav className="app-dock-path" aria-label="Object path">
          {visiblePath.map((item, index) => (
            <span className="app-dock-path-part" key={`${item.id}-${index}`}>
              <span className="app-dock-path-divider">/</span>
              <span>{item.title}</span>
            </span>
          ))}
        </nav>
      ) : null}
      <div className="app-dock-history">
        <button type="button" onClick={onUndo} disabled={!canUndo} data-tooltip="Undo · Ctrl+Z" aria-label="Undo"><IconArrowBackUp size={14} stroke={1.65} /></button>
        <button type="button" onClick={onRedo} disabled={!canRedo} data-tooltip="Redo · Ctrl+Y" aria-label="Redo"><IconArrowForwardUp size={14} stroke={1.65} /></button>
      </div>
      <button type="button" onClick={(event) => onOpenSettings?.(event.currentTarget)} data-tooltip="Appearance and settings">
        <IconSettings size={14} stroke={1.65} />
        <span>Settings</span>
      </button>
    </div>
  );
}
