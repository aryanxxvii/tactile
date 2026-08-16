import { IconFileUpload, IconFolderOpen, IconLock } from "@tabler/icons-react";
import { ObjectHeader, React, resolveTauriInvoke, useEffect, useMemo, useRef, useState } from "tactile:host";

function dataUrlText(dataUrl) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(String(dataUrl || ""));
  if (!match) return "";
  try { return match[2] ? atob(match[3]) : decodeURIComponent(match[3]); } catch { return ""; }
}

export function HtmlObject({ object, path, saveState, onUpdateObject, onBack, canGoBack, workspaceActions, assets, onReplaceFile, onReparentObject }) {
  const asset = object.assetId ? assets?.[object.assetId] : null;
  const source = useMemo(() => object.source || dataUrlText(asset?.dataUrl), [asset?.dataUrl, object.source]);
  const inputRef = useRef(null);
  const [nativeUrl, setNativeUrl] = useState("");
  useEffect(() => {
    const invoke = resolveTauriInvoke();
    if (!invoke || !source) { setNativeUrl(""); return undefined; }
    let active = true;
    invoke("workspace_serve_html", { content: source }).then((url) => active && setNativeUrl(String(url || ""))).catch(() => active && setNativeUrl(""));
    return () => { active = false; };
  }, [source]);
  return <article className="object-surface file-object" data-object-type="html">
    <ObjectHeader object={object} path={path} saveState={saveState} onChange={onUpdateObject} onBack={onBack} canGoBack={canGoBack} workspaceActions={workspaceActions} onReparentObject={onReparentObject} />
    <main className="file-workspace">
      <input ref={inputRef} className="native-file-input" type="file" accept=".html,.htm,text/html" tabIndex={-1} aria-hidden="true" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onReplaceFile?.(file); }} />
      <div className="file-toolbar"><span className="file-ownership"><IconLock size={13} /> On this device</span><span className="file-meta">{asset?.fileName || "HTML"}</span><span className="file-toolbar-spacer" /><button type="button" onClick={() => inputRef.current?.click()}><IconFileUpload size={13} /> Replace</button></div>
      <div className="file-stage">{source ? <iframe src={nativeUrl || undefined} srcDoc={nativeUrl ? undefined : source} title={object.title} sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts" /> : <div className="file-empty-state"><h2>Local content unavailable</h2><p>Choose the HTML file again to reconnect it.</p><button type="button" onClick={() => inputRef.current?.click()}><IconFolderOpen size={14} /> Choose HTML</button></div>}</div>
    </main>
  </article>;
}
