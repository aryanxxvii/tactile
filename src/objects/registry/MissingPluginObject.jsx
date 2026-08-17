import { IconPlugOff, IconSettings } from "@tabler/icons-react";
import { ObjectHeader } from "../../components/ObjectHeader.jsx";

export function MissingPluginObject({
  object,
  path,
  saveState,
  onUpdateObject,
  onBack,
  canGoBack,
  workspaceActions,
  onReparentObject,
  onOpenSettings,
}) {
  return (
    <article className="object-surface document-object" data-object-type="missing-plugin">
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
          <IconPlugOff size={16} stroke={1.55} />
          <span>Optional cell object</span>
        </div>
        <div className="document-copy">
          <h2>Plugin required</h2>
          <p><strong>{object.type}</strong> is not installed. Its object data and local assets remain unchanged.</p>
          <div className="files-actions">
            <button type="button" onClick={onOpenSettings}><IconSettings size={15} /> Open Plugins</button>
          </div>
        </div>
      </main>
    </article>
  );
}