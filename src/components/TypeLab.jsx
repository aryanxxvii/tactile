import { IconCheck, IconX } from "@tabler/icons-react";
import { typeIdeaStyle } from "../typography/typeIdeas.js";

export function TypeLab({ ideas, selectedId, onSelect, onClose }) {
  return (
    <div className="type-lab" role="dialog" aria-modal="true" aria-labelledby="type-lab-title">
      <button className="type-lab-scrim" type="button" aria-label="Close Type Lab" onClick={onClose} />
      <section className="type-lab-panel">
        <header className="type-lab-header">
          <div>
            <span className="type-lab-kicker">Paper / typography study</span>
            <h2 id="type-lab-title">30 compact directions</h2>
            <p>Click any specimen to apply it to the live sheet. All fonts are bundled locally.</p>
          </div>
          <button className="type-lab-close" type="button" onClick={onClose} aria-label="Close Type Lab">
            <IconX size={17} stroke={1.7} />
          </button>
        </header>

        <div className="type-idea-grid">
          {ideas.map((idea) => {
            const selected = selectedId === idea.id;
            return (
              <button
                className={`type-idea ${selected ? "is-selected" : ""}`}
                style={typeIdeaStyle(idea)}
                type="button"
                key={idea.id}
                onClick={() => onSelect(idea.id)}
                aria-pressed={selected}
              >
                <span className="type-idea-topline">
                  <span className="type-idea-number">{idea.number}</span>
                  <span className="type-idea-category">{idea.category}</span>
                  {selected ? <IconCheck size={13} stroke={2} /> : null}
                </span>
                <strong>Operating model</strong>
                <span className="type-idea-description">Drivers, scenarios, and twelve-month outcomes.</span>
                <span className="type-idea-cell"><b>B4</b><i>Revenue</i><i>48</i><code>=B2*(1-B3)</code></span>
                <span className="type-idea-name">{idea.name}</span>
              </button>
            );
          })}
        </div>

        <footer className="type-lab-footer">
          <span>The selected direction is remembered in this browser.</span>
          <span><kbd>Esc</kbd> close</span>
        </footer>
      </section>
    </div>
  );
}
