import { IconBrackets, IconFileText } from "@tabler/icons-react";
import { ObjectHeader } from "../../components/ObjectHeader.jsx";

export function DocumentObject({ object, path, saveState, onUpdateObject, onBack, canGoBack, workspaceActions, onReparentObject }) {
  return (
    <article className="object-surface document-object" data-object-type="document">
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
        <div className="document-margin-note">
          <IconFileText size={16} stroke={1.55} />
          <span>Plain local document</span>
        </div>
        <div className="document-copy">
          {(object.blocks || []).map((block, index) => {
            if (block.type === "heading") return <h2 key={index}>{block.text}</h2>;
            if (block.type === "quote") return <blockquote key={index}>{block.text}</blockquote>;
            if (block.type === "kicker") return <p className="document-kicker" key={index}>{block.text}</p>;
            return <p key={index}>{block.text}</p>;
          })}
        </div>
      </main>

      <footer className="object-statusbar">
        <span className="status-spacer" />
        <span className="status-item keyboard-hint"><IconBrackets size={14} stroke={1.6} /> <kbd>[</kbd> out</span>
      </footer>
    </article>
  );
}
