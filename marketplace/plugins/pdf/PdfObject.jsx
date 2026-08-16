import { IconFileUpload, IconLock } from "@tabler/icons-react";
import { ObjectHeader, React, useRef } from "tactile:host";
import { PdfViewer } from "./PdfViewer.jsx";

export function PdfObject({ object, path, saveState, onUpdateObject, onBack, canGoBack, workspaceActions, assets, onReplaceFile, onReparentObject }) {
  const asset = object.assetId ? assets?.[object.assetId] : null;
  const inputRef = useRef(null);
  return <article className="object-surface file-object" data-object-type="pdf">
    <ObjectHeader object={object} path={path} saveState={saveState} onChange={onUpdateObject} onBack={onBack} canGoBack={canGoBack} workspaceActions={workspaceActions} onReparentObject={onReparentObject} />
    <main className="file-workspace">
      <input ref={inputRef} className="native-file-input" type="file" accept=".pdf,application/pdf" tabIndex={-1} aria-hidden="true" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onReplaceFile?.(file); }} />
      <div className="file-toolbar"><span className="file-ownership"><IconLock size={13} /> On this device</span><span className="file-meta">{asset?.fileName || "PDF"}</span><span className="file-toolbar-spacer" /><button type="button" onClick={() => inputRef.current?.click()}><IconFileUpload size={13} /> Replace</button></div>
      <div className="file-stage"><PdfViewer asset={asset} title={object.title} onChooseFile={() => inputRef.current?.click()} /></div>
    </main>
  </article>;
}
