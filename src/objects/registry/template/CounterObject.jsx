import { IconBrackets, IconMinus, IconPlus } from "@tabler/icons-react";
import { ObjectHeader } from "../../../components/ObjectHeader.jsx";

export function CounterObject({
  object,
  path,
  saveState,
  onUpdateObject,
  onBack,
  canGoBack,
  workspaceActions,
  onReparentObject,
}) {
  const count = Number(object.count) || 0;
  return (
    <article className="object-surface document-object" data-object-type={object.type}>
      <ObjectHeader
        object={object}
        path={path}
        saveState={saveState}
        onChange={onUpdateObject}
        onBack={onBack}
        canGoBack={canGoBack}
        workspaceActions={workspaceActions}
        onReparentObject={onReparentObject}
      />
      <main className="document-page">
        <div className="document-copy">
          <h2>{count}</h2>
          <p>{object.description || "A minimal installable cell-object example."}</p>
          <div className="files-actions" role="group" aria-label="Counter controls">
            <button type="button" aria-label="Decrease counter" onClick={() => onUpdateObject({ count: count - 1 })}>
              <IconMinus size={15} /> Decrease
            </button>
            <button type="button" aria-label="Increase counter" onClick={() => onUpdateObject({ count: count + 1 })}>
              <IconPlus size={15} /> Increase
            </button>
          </div>
        </div>
      </main>
      <footer className="object-statusbar">
        <span className="status-spacer" />
        <span className="status-item keyboard-hint"><IconBrackets size={14} /> <kbd>[</kbd> out</span>
      </footer>
    </article>
  );
}