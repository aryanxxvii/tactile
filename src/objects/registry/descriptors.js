import {
  IconCode,
  IconExternalLink,
  IconFileTypePdf,
  IconLayoutGrid,
  IconMovie,
  IconPhoto,
  IconTextCaption,
  IconVectorBezier,
} from "@tabler/icons-react";
import {
  createObjectCompat,
  deserializeObjectCompat,
  migrateObjectCompat,
  serializeObjectCompat,
  validateObjectCompat,
} from "./compatibility.js";

const noAssetPolicy = Object.freeze({
  kind: "none",
  acceptsBinary: false,
});

const fileAssetPolicy = Object.freeze({
  kind: "external-asset",
  acceptsBinary: true,
  extensions: Object.freeze(["pdf", "png", "jpg", "jpeg", "gif", "webp", "mp4", "webm", "html", "svg"]),
  mimePrefixes: Object.freeze(["application/", "image/", "video/", "text/"]),
});

const noCommands = () => [];

function renderer(modulePath, load) {
  return Object.freeze({ modulePath, load });
}

function descriptor({ type, label, icon, renderer: rendererDefinition, assetPolicy = noAssetPolicy }) {
  return Object.freeze({
    type,
    label,
    icon,
    renderer: rendererDefinition,
    create: (options = {}) => createObjectCompat(type, options),
    validate: (object) => validateObjectCompat(type, object),
    migrate: (object, fallbackId) => migrateObjectCompat(type, object, fallbackId),
    serialize: serializeObjectCompat,
    deserialize: deserializeObjectCompat,
    assetPolicy,
    commands: noCommands,
  });
}

/**
 * Renderer loaders are functions rather than imported components. They are
 * intentionally not invoked by registry construction, so inactive object
 * renderers remain out of the initial module graph at runtime.
 */
export const OBJECT_TYPE_DEFINITIONS = Object.freeze({
  sheet: descriptor({
    type: "sheet",
    label: "Sheet",
    icon: IconLayoutGrid,
    renderer: renderer("../sheet/SheetObject.jsx", () => import("../sheet/SheetObject.jsx").then((module) => module.SheetObject)),
  }),
  markdown: descriptor({
    type: "markdown",
    label: "Text",
    icon: IconTextCaption,
    renderer: renderer("../markdown/MarkdownObject.jsx", () => import("../markdown/MarkdownObject.jsx").then((module) => module.MarkdownObject)),
  }),
  code: descriptor({
    type: "code",
    label: "Code",
    icon: IconCode,
    renderer: renderer("../code/CodeObject.jsx", () => import("../code/CodeObject.jsx").then((module) => module.CodeObject)),
  }),
  document: descriptor({
    type: "document",
    label: "Document",
    icon: IconTextCaption,
    renderer: renderer("../document/DocumentObject.jsx", () => import("../document/DocumentObject.jsx").then((module) => module.DocumentObject)),
  }),
  pdf: descriptor({
    type: "pdf",
    label: "PDF",
    icon: IconFileTypePdf,
    renderer: renderer("../file/FileObject.jsx", () => import("../file/FileObject.jsx").then((module) => module.FileObject)),
    assetPolicy: fileAssetPolicy,
  }),
  image: descriptor({
    type: "image",
    label: "Image",
    icon: IconPhoto,
    renderer: renderer("../file/FileObject.jsx", () => import("../file/FileObject.jsx").then((module) => module.FileObject)),
    assetPolicy: fileAssetPolicy,
  }),
  video: descriptor({
    type: "video",
    label: "Video",
    icon: IconMovie,
    renderer: renderer("../file/FileObject.jsx", () => import("../file/FileObject.jsx").then((module) => module.FileObject)),
    assetPolicy: fileAssetPolicy,
  }),
  html: descriptor({
    type: "html",
    label: "HTML",
    icon: IconCode,
    renderer: renderer("../file/FileObject.jsx", () => import("../file/FileObject.jsx").then((module) => module.FileObject)),
    assetPolicy: fileAssetPolicy,
  }),
  svg: descriptor({
    type: "svg",
    label: "SVG",
    icon: IconVectorBezier,
    renderer: renderer("../file/FileObject.jsx", () => import("../file/FileObject.jsx").then((module) => module.FileObject)),
    assetPolicy: fileAssetPolicy,
  }),
  link: descriptor({
    type: "link",
    label: "Link",
    icon: IconExternalLink,
    renderer: renderer("../link/LinkObject.jsx", () => import("../link/LinkObject.jsx").then((module) => module.LinkObject)),
    assetPolicy: noAssetPolicy,
  }),
});
