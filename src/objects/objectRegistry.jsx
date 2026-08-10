import { DocumentObject } from "./document/DocumentObject.jsx";
import { FileObject } from "./file/FileObject.jsx";
import { MarkdownObject } from "./markdown/MarkdownObject.jsx";
import { SheetObject } from "./sheet/SheetObject.jsx";

export const OBJECT_RENDERERS = {
  sheet: SheetObject,
  markdown: MarkdownObject,
  document: DocumentObject,
  pdf: FileObject,
  image: FileObject,
  video: FileObject,
  html: FileObject,
  svg: FileObject,
};

export function registerObjectRenderer(type, renderer) {
  if (!type || typeof renderer !== "function") throw new Error("Object types need a key and renderer.");
  OBJECT_RENDERERS[type] = renderer;
}

export function ObjectRenderer({ object, ...props }) {
  const Renderer = OBJECT_RENDERERS[object.type] || MarkdownObject;
  return <Renderer object={object} {...props} />;
}
