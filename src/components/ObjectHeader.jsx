import { IconChevronLeft } from "@tabler/icons-react";
import { generatedObjectTitle } from "../model.js";
import { ObjectGlyph } from "./ObjectGlyph.jsx";
import { WorkspaceMenu } from "./WorkspaceMenu.jsx";
import {
  dragPayloadForObject,
  isObjectDragEvent,
  readObjectDragData,
  writeObjectDragData,
} from "../shell/objectDrag.js";

export function ObjectHeader({
  object,
  path,
  saveState,
  onChange,
  onBack,
  canGoBack,
  workspaceActions,
  onReparentObject,
}) {
  const canReceiveObject = object.type === "sheet";

  return (
    <header
      className="object-header"
      draggable
      onDragStart={(event) => {
        if (event.target.closest("input, button")) {
          event.preventDefault();
          return;
        }
        writeObjectDragData(event, dragPayloadForObject(object.id, path, object));
      }}
      onDragOver={(event) => {
        if (!canReceiveObject || !isObjectDragEvent(event)) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        if (!canReceiveObject) return;
        event.preventDefault();
        event.stopPropagation();
        const payload = readObjectDragData(event);
        if (payload) onReparentObject?.(payload, { parentObjectId: object.id });
      }}
    >
      <div className="object-header-main">
        <div className="object-title-row">
          {canGoBack ? (
            <button type="button" className="object-header-parent" onClick={() => onBack?.()} data-tooltip="Return to parent · [">
              <IconChevronLeft size={14} stroke={1.65} />
              Parent
            </button>
          ) : null}
          <span className="object-type-glyph" aria-hidden="true">
            <ObjectGlyph item={object} size={15} stroke={1.55} />
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
