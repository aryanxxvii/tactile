import {
  IconCode,
  IconFileTypePdf,
  IconLayoutGrid,
  IconMovie,
  IconPhoto,
  IconTextCaption,
  IconVectorBezier,
} from "@tabler/icons-react";

export const OBJECT_TYPES = {
  sheet: {
    label: "Sheet",
    icon: IconLayoutGrid,
  },
  document: {
    label: "Document",
    icon: IconTextCaption,
  },
  markdown: {
    label: "Text",
    icon: IconTextCaption,
  },
  pdf: { label: "PDF", icon: IconFileTypePdf },
  image: { label: "Image", icon: IconPhoto },
  video: { label: "Video", icon: IconMovie },
  html: { label: "HTML", icon: IconCode },
  svg: { label: "SVG", icon: IconVectorBezier },
};

export function objectTypeFor(type) {
  return OBJECT_TYPES[type] || OBJECT_TYPES.document;
}
