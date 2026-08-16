import { IconDownload, IconFileUpload, IconFolderOpen, IconLock } from "@tabler/icons-react";
import { ObjectHeader, React, useRef } from "tactile:host";
import { VideoPlayer } from "./VideoPlayer.jsx";

export function VideoObject({ object, path, saveState, onUpdateObject, onBack, canGoBack, workspaceActions, assets, onReplaceFile, onReparentObject }) {
  const asset = object.assetId ? assets?.[object.assetId] : null;
  const inputRef = useRef(null);
  return <article className="object-surface file-object" data-object-type="video">
    <ObjectHeader object={object} path={path} saveState={saveState} onChange={onUpdateObject} onBack={onBack} canGoBack={canGoBack} workspaceActions={workspaceActions} onReparentObject={onReparentObject} />
    <main className="file-workspace">
      <input ref={inputRef} className="native-file-input" type="file" accept="video/*" tabIndex={-1} aria-hidden="true" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onReplaceFile?.(file); }} />
      <div className="file-toolbar"><span className="file-ownership"><IconLock size={13} /> On this device</span><span className="file-meta">{asset?.fileName || "Video"}</span><span className="file-toolbar-spacer" /><button type="button" onClick={() => inputRef.current?.click()}><IconFileUpload size={13} /> Replace</button>{asset?.dataUrl ? <a href={asset.dataUrl} download={asset.fileName || object.title}><IconDownload size={13} /> Download</a> : null}</div>
      <div className="file-stage">{asset?.dataUrl ? <VideoPlayer src={asset.dataUrl} title={object.title} /> : <div className="file-empty-state"><h2>Local content unavailable</h2><p>Choose the video again to reconnect it.</p><button type="button" onClick={() => inputRef.current?.click()}><IconFolderOpen size={14} /> Choose video</button></div>}</div>
    </main>
  </article>;
}
