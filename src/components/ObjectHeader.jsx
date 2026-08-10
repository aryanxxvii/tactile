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
  const objectType = objectTypeFor(object.type);
  const ObjectIcon = objectType.icon;

  return (
    <header className="object-header">
      <div className="object-header-main">
        <div className="object-title-row">
          {canGoBack ? (
            <button type="button" className="object-header-parent" onClick={onBack} data-tooltip="Return to parent · [">
              <IconChevronLeft size={14} stroke={1.65} />
              Parent
            </button>
          ) : null}
          <span className="object-type-glyph" aria-hidden="true">
            <ObjectIcon size={15} stroke={1.55} />
          </span>
          <label className="object-title-field">
            <span className="visually-hidden">Object title</span>
            <input
              value={object.title}
              onChange={(event) => {
                onChange({ title: event.target.value });
              }}
              onBlur={(event) => {
                if (!event.target.value.trim()) onChange({ title: generatedObjectTitle(object.type) });
              }}
              spellCheck="false"
            />
          </label>
        </div>
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
