import { IconArrowBackUp, IconArrowForwardUp, IconSettings } from "@tabler/icons-react";

export function AppDock({ onOpenSettings, onUndo, onRedo, canUndo, canRedo }) {
  return (
    <div className="app-dock" aria-label="Tactile app controls">
      <span className="app-dock-brand">
        <img className="app-dock-mark" src="/tactile-mark.svg" alt="" />
        <span>Tactile</span>
      </span>
      <div className="app-dock-history">
        <button type="button" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo"><IconArrowBackUp size={14} stroke={1.65} /></button>
        <button type="button" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)" aria-label="Redo"><IconArrowForwardUp size={14} stroke={1.65} /></button>
      </div>
      <button type="button" onClick={(event) => onOpenSettings?.(event.currentTarget)} title="Appearance and settings">
        <IconSettings size={14} stroke={1.65} />
        <span>Settings</span>
      </button>
    </div>
  );
}
