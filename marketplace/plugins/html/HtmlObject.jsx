import { IconCode, IconFileUpload, IconFolderOpen, IconLock } from "@tabler/icons-react";
import { ObjectHeader, React, resolveTauriInvoke, useEffect, useMemo, useRef, useState } from "tactile:host";
import "./HtmlObject.css";

function dataUrlText(dataUrl) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(String(dataUrl || ""));
  if (!match) return "";
  try {
    return match[2] ? atob(match[3]) : decodeURIComponent(match[3]);
  } catch {
    return "";
  }
}

export function HtmlObject({
  object,
  path,
  saveState,
  onUpdateObject,
  onBack,
  canGoBack,
  workspaceActions,
  workspaceObjects,
  assets,
  onReplaceFile,
  onReparentObject,
}) {
  const asset = object.assetId ? assets?.[object.assetId] : null;
  const codeSources = useMemo(
    () =>
      Object.values(workspaceObjects || {})
        .filter(
          (candidate) =>
            candidate?.type === "code" && (candidate.language === "html" || candidate.id === object.sourceObjectId),
        )
        .sort((left, right) => String(left.title || "").localeCompare(String(right.title || ""))),
    [object.sourceObjectId, workspaceObjects],
  );
  const linkedSource = object.sourceObjectId ? workspaceObjects?.[object.sourceObjectId] : null;
  const source = useMemo(
    () =>
      linkedSource?.type === "code" ? String(linkedSource.content || "") : object.source || dataUrlText(asset?.dataUrl),
    [asset?.dataUrl, linkedSource, object.source],
  );
  const inputRef = useRef(null);
  const [nativeUrl, setNativeUrl] = useState("");
  useEffect(() => {
    const invoke = resolveTauriInvoke();
    if (!invoke || !source) {
      setNativeUrl("");
      return undefined;
    }
    let active = true;
    invoke("workspace_serve_html", { content: source })
      .then((url) => active && setNativeUrl(String(url || "")))
      .catch(() => active && setNativeUrl(""));
    return () => {
      active = false;
    };
  }, [source]);
  return (
    <article className="object-surface file-object" data-object-type="html">
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
      <main className="file-workspace">
        <input
          ref={inputRef}
          className="native-file-input"
          type="file"
          accept=".html,.htm,text/html"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onReplaceFile?.(file);
          }}
        />
        <div className="file-toolbar html-toolbar">
          <span className="file-ownership">
            <IconLock size={13} /> On this device
          </span>
          <label className="html-source-control">
            <IconCode size={13} stroke={1.55} />
            <span>Source</span>
            <select
              value={object.sourceObjectId || ""}
              aria-label="HTML source cell"
              onChange={(event) => onUpdateObject({ sourceObjectId: event.target.value || null })}
            >
              <option value="">Local HTML file</option>
              {object.sourceObjectId && !linkedSource ? (
                <option value={object.sourceObjectId}>Unavailable code source</option>
              ) : null}
              {codeSources.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {[candidate.parent?.sourceAddress, candidate.title || "Untitled HTML code"]
                    .filter(Boolean)
                    .join(" · ")}
                </option>
              ))}
            </select>
          </label>
          <span className="file-meta">
            {linkedSource ? linkedSource.title || "HTML code" : asset?.fileName || "HTML"}
          </span>
          <span className="file-toolbar-spacer" />
          <button type="button" onClick={() => inputRef.current?.click()}>
            <IconFileUpload size={13} /> {asset || object.source ? "Replace" : "Choose file"}
          </button>
        </div>
        <div className="file-stage">
          {source ? (
            <iframe
              src={nativeUrl || undefined}
              srcDoc={nativeUrl ? undefined : source}
              title={object.title}
              sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts"
            />
          ) : (
            <div className="file-empty-state">
              <h2>{object.sourceObjectId ? "Code source unavailable" : "Local content unavailable"}</h2>
              <p>
                {object.sourceObjectId
                  ? "Select another HTML Code cell or choose a local HTML file."
                  : "Choose a local HTML file or select an HTML Code cell as the live source."}
              </p>
              <button type="button" onClick={() => inputRef.current?.click()}>
                <IconFolderOpen size={14} /> Choose HTML
              </button>
            </div>
          )}
        </div>
      </main>
    </article>
  );
}
