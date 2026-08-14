import { useRef } from "react";
import { IconChevronLeft } from "@tabler/icons-react";
import { generatedObjectTitle } from "../model.js";
import { ObjectGlyph } from "./ObjectGlyph.jsx";
import { WorkspaceMenu } from "./WorkspaceMenu.jsx";
import { useLocalDraft } from "./localEditSession.js";
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
  const titleDraft = useLocalDraft(object.title, (title) => onChange({ title }));
  const titleInputRef = useRef(null);
  const commitTitle = () => {
    const next = titleDraft.draftRef.current.trim()
      ? titleDraft.draftRef.current
      : generatedObjectTitle(object.type);
    titleDraft.commitDraft(next);
  };

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
              ref={titleInputRef}
              value={titleDraft.draft}
              onChange={(event) => {
                titleDraft.updateDraft(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitTitle();
                  titleInputRef.current?.blur();
                }
              }}
              onBlur={commitTitle}
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
          />
        ) : null}
      </div>
    </header>
  );
}
