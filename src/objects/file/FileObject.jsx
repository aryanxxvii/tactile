import { useEffect, useMemo, useRef, useState } from "react";
import {
  IconBrackets,
  IconDownload,
  IconFileUpload,
  IconFolderOpen,
  IconLock,
} from "@tabler/icons-react";
import { ObjectHeader } from "../../components/ObjectHeader.jsx";
import { ObjectGlyph } from "../../components/ObjectGlyph.jsx";
import { objectTypeFor } from "../objectTypes.js";
import { PdfViewer } from "./PdfViewer.jsx";

function dataUrlBytes(dataUrl) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(String(dataUrl || ""));
  if (!match) return new Uint8Array(0);
  if (match[2]) {
    const binary = atob(match[3]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }
  return new TextEncoder().encode(decodeURIComponent(match[3]));
}

function dataUrlText(dataUrl) {
  const bytes = dataUrlBytes(dataUrl);
  if (!bytes.length) return "";
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return "";
  }
}

function dataUrlBlob(dataUrl, fallbackMime = "application/octet-stream") {
  if (typeof dataUrl !== "string") return null;
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) return null;
  const mime = match[1] || fallbackMime;
  try {
    if (match[2]) {
      const binary = atob(match[3]);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      return new Blob([bytes], { type: mime });
    }
    return new Blob([decodeURIComponent(match[3])], { type: mime });
  } catch {
    return null;
  }
}

export function FileObject({ object, path, saveState, onUpdateObject, onBack, canGoBack, workspaceActions, assets, onReplaceFile, onReparentObject }) {
  const asset = object.assetId ? assets?.[object.assetId] : null;
  const definition = objectTypeFor(object.type);
  const ObjectIcon = (props) => <ObjectGlyph item={object} {...props} />;
  const fileInputRef = useRef(null);
  const [assetUrl, setAssetUrl] = useState("");
  const htmlSource = useMemo(
    () => object.type === "html" ? (object.source || dataUrlText(asset?.dataUrl)) : "",
    [asset?.dataUrl, object.source, object.type],
  );

  useEffect(() => {
    const blob = dataUrlBlob(asset?.dataUrl, asset?.mime);
    if (!blob || typeof URL?.createObjectURL !== "function") {
      setAssetUrl("");
      return undefined;
    }
    const url = URL.createObjectURL(blob);
    setAssetUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      setAssetUrl("");
    };
  }, [asset?.dataUrl, asset?.mime]);

  const previewUrl = assetUrl || asset?.dataUrl || "";

  return (
    <article className="object-surface file-object" data-object-type={object.type}>
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
          ref={fileInputRef}
          className="native-file-input"
          type="file"
          accept=".pdf,.md,.markdown,.html,.htm,.svg,image/*,video/*,application/pdf,text/html,text/markdown"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onReplaceFile?.(file);
          }}
        />
        <div className="file-toolbar" aria-label="Local file controls">
          <span className="file-ownership"><IconLock size={13} stroke={1.65} /> On this device</span>
          <span className="file-meta">{asset?.fileName || definition.label}{asset?.size ? ` · ${Math.max(1, Math.round(asset.size / 1024))} KB` : ""}</span>
          <span className="file-toolbar-spacer" />
          <button type="button" onClick={() => fileInputRef.current?.click()}><IconFileUpload size={13} stroke={1.6} /> Replace</button>
          {asset?.dataUrl ? (
            <a href={asset.dataUrl} download={asset.fileName || object.title}><IconDownload size={13} stroke={1.6} /> Download</a>
          ) : null}
        </div>
        <div className="file-stage">
          {object.type === "image" || object.type === "svg" ? (
            previewUrl ? <img src={previewUrl} alt={object.title} /> : null
          ) : null}
          {object.type === "video" && previewUrl ? (
            <video src={previewUrl} controls preload="metadata" aria-label={object.title} />
          ) : null}
          {object.type === "pdf" && asset?.dataUrl ? (
            <PdfViewer asset={asset} fileName={asset.fileName || object.title} title={object.title} onChooseFile={() => fileInputRef.current?.click()} />
          ) : null}
          {object.type === "html" && htmlSource ? (
            <iframe srcDoc={htmlSource} title={object.title} sandbox="allow-forms allow-modals allow-popups allow-scripts" />
          ) : null}
          {!asset?.dataUrl && !htmlSource ? (
            <div className="file-empty-state">
              <ObjectIcon size={29} stroke={1.3} />
              <h2>Local content unavailable</h2>
              <p>The object metadata survived, but this copy does not include the original binary. Choose the file again to reconnect it.</p>
              <button type="button" onClick={() => fileInputRef.current?.click()}><IconFolderOpen size={14} stroke={1.6} /> Choose local file</button>
            </div>
          ) : null}
        </div>
      </main>

      <footer className="object-statusbar">
        <span className="status-spacer" />
        <span className="status-item"><ObjectIcon size={14} stroke={1.55} /> {definition.label}{asset?.size ? ` · ${Math.max(1, Math.round(asset.size / 1024))} KB` : ""}</span>
        <span className="status-divider">·</span>
        <span className="status-item keyboard-hint"><IconBrackets size={14} stroke={1.6} /> <kbd>[</kbd> out</span>
      </footer>
    </article>
  );
}
