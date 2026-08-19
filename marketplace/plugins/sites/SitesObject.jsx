import { IconExternalLink, IconReload } from "@tabler/icons-react";
import {
  ObjectGlyph,
  ObjectHeader,
  React,
  useLocalDraft,
  useMemo,
  useState,
} from "tactile:host";
import { useSitePreview } from "./useSitePreview.js";
import "./SitesObject.css";

export function SitesObject({
  object,
  path,
  saveState,
  onUpdateObject,
  onBack,
  canGoBack,
  workspaceActions,
  onReparentObject,
  onOpenExternal,
}) {
  const url = object.url || "";
  const host = useMemo(() => {
    try {
      return new URL(url).hostname || url;
    } catch {
      return url;
    }
  }, [url]);

  const [loaded, setLoaded] = useState(false);
  const urlDraft = useLocalDraft(url, (next) => {
    const trimmed = String(next || "").trim();
    if (trimmed) onUpdateObject?.({ url: trimmed });
  });

  const commitUrl = () => {
    const trimmed = String(urlDraft.draftRef.current || "").trim();
    if (trimmed) urlDraft.commitDraft(trimmed);
    else urlDraft.cancelDraft();
  };

  const { src, loading, error, reload } = useSitePreview({ url });

  return (
    <article className="object-surface sites-object" data-object-type="sites">
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

      <main className="sites-workspace">
        <div className="sites-toolbar" aria-label="Site controls">
          <button
            type="button"
            className="sites-action"
            onClick={reload}
            disabled={!url || loading}
            data-tooltip="Reload site"
          >
            <IconReload size={13} stroke={1.6} /> Reload
          </button>
          <label className="sites-url-field">
            <span className="visually-hidden">Site address</span>
            <input
              value={urlDraft.draft}
              placeholder="https://example.com"
              spellCheck="false"
              onChange={(event) => urlDraft.updateDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitUrl();
                  event.currentTarget.blur();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  urlDraft.cancelDraft();
                  event.currentTarget.blur();
                }
              }}
              onBlur={commitUrl}
            />
          </label>
          <button
            type="button"
            className="sites-action sites-external"
            onClick={() => onOpenExternal?.(url)}
            disabled={!url}
            data-tooltip="Open in your system browser"
          >
            <IconExternalLink size={13} stroke={1.6} /> Open in browser
          </button>
        </div>

        <div className="sites-stage">
          {url ? (
            src ? (
              <>
                {loading && !loaded ? <div className="sites-loading" aria-hidden="true" /> : null}
                <iframe
                  key={src}
                  title={object.title}
                  src={src}
                  referrerPolicy="no-referrer"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; geolocation; microphone; camera"
                  onLoad={() => setLoaded(true)}
                />
              </>
            ) : (
              <div className="sites-empty-state">
                <ObjectGlyph item={object} size={29} stroke={1.3} />
                <h2>{loading ? "Loading…" : error ? "Unable to open this address" : "No address yet"}</h2>
                <p>
                  {error
                    ? error
                    : "Enter an http or https address above to open it inside Tactile."}
                </p>
              </div>
            )
          ) : (
            <div className="sites-empty-state">
              <ObjectGlyph item={object} size={29} stroke={1.3} />
              <h2>No address yet</h2>
              <p>Enter an http or https address above to open it inside Tactile.</p>
            </div>
          )}
        </div>
      </main>

      <footer className="object-statusbar">
        <span className="status-spacer" />
        <span className="status-item">
          <ObjectGlyph item={object} size={14} stroke={1.55} /> Sites{host ? ` · ${host}` : ""}
        </span>
        <span className="status-divider">·</span>
        <span className="status-item keyboard-hint">
          <IconExternalLink size={14} stroke={1.6} /> <kbd>[</kbd> out
        </span>
      </footer>
    </article>
  );
}