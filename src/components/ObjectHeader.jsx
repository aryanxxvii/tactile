import { useEffect, useState } from "react";
import { IconChevronLeft } from "@tabler/icons-react";
import { generatedObjectTitle } from "../model.js";
import { objectTypeFor } from "../objects/objectTypes.js";
import { WorkspaceMenu } from "./WorkspaceMenu.jsx";

export function ObjectHeader({
  object,
  path,
  saveState,
  onChange,
  onBack,
  canGoBack,
  workspaceActions,
}) {
  const [titleEditing, setTitleEditing] = useState(false);
  const objectType = objectTypeFor(object.type);
  const ObjectIcon = objectType.icon;

  useEffect(() => {
    if (object.description) setTitleEditing(false);
  }, [object.description]);

  return (
    <header className="object-header">
      <div className="object-header-main">
        <div className="object-title-row">
          {canGoBack ? (
            <button type="button" className="object-header-parent" onClick={onBack} title="Return to parent ([)">
              <IconChevronLeft size={14} stroke={1.65} />
              Parent
            </button>
          ) : null}
          <span className="object-type-glyph" title={objectType.label} aria-hidden="true">
            <ObjectIcon size={15} stroke={1.55} />
          </span>
          <label className="object-title-field">
            <span className="visually-hidden">Object title</span>
            <input
              value={object.title}
              onChange={(event) => {
                setTitleEditing(true);
                onChange({ title: event.target.value });
              }}
              onFocus={() => setTitleEditing(true)}
              onBlur={(event) => {
                if (!event.target.value.trim()) onChange({ title: generatedObjectTitle(object.type) });
                setTitleEditing(false);
              }}
              spellCheck="false"
            />
          </label>
        </div>

        {object.description || titleEditing ? (
          <label className="object-description-field">
            <span className="visually-hidden">Object description</span>
            <input
              value={object.description || ""}
              onChange={(event) => onChange({ description: event.target.value })}
              placeholder="Optional description"
              spellCheck="false"
            />
          </label>
        ) : null}
      </div>

      <div className="object-header-actions">
        {workspaceActions ? (
          <WorkspaceMenu
            isHome={workspaceActions.homeObjectId === object.id}
            exportState={workspaceActions.exportState}
            onSetHome={() => workspaceActions.onSetHome(object.id)}
            onExport={workspaceActions.onExport}
            onImport={workspaceActions.onImport}
          />
        ) : null}
      </div>
    </header>
  );
}
