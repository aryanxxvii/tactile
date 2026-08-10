import { IconArrowsMinimize, IconTypography } from "@tabler/icons-react";

export function PrototypeControls({ activeTypeIdea, onReplay, onOpenTypeLab }) {
  return (
    <aside className="prototype-controls" aria-label="Paper prototype controls">
      <span className="prototype-mode">Paper</span>
      <button type="button" onClick={onReplay} title="Replay the In & Out transition">
        <IconArrowsMinimize size={14} stroke={1.65} />
        <span>In &amp; Out</span>
      </button>
      <button type="button" onClick={onOpenTypeLab} title="Compare 30 typography directions">
        <IconTypography size={14} stroke={1.65} />
        <span>Type Lab</span>
        <em>{activeTypeIdea.number}</em>
      </button>
    </aside>
  );
}
