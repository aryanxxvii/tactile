import { lazy, Suspense } from "react";
import {
  getObjectTypeDefinition,
  listObjectTypeDefinitions,
  loadObjectRenderer,
} from "./registry/index.js";

function lazyObjectRenderer(type) {
  return lazy(async () => ({ default: await loadObjectRenderer(type) }));
}

// This map preserves the old synchronous lookup surface for callers that
// register a renderer directly, while built-in renderers load on demand.
export const OBJECT_RENDERERS = Object.fromEntries(
  listObjectTypeDefinitions().map((definition) => [definition.type, lazyObjectRenderer(definition.type)]),
);

export function registerObjectRenderer(type, renderer) {
  if (!type || typeof renderer !== "function") throw new Error("Object types need a key and renderer.");
  OBJECT_RENDERERS[type] = renderer;
}

export function ObjectRenderer({ object, ...props }) {
  const definition = getObjectTypeDefinition(object.type);
  const Renderer = OBJECT_RENDERERS[definition.type] || OBJECT_RENDERERS.document;
  return (
    <Suspense fallback={null}>
      <Renderer object={object} {...props} />
    </Suspense>
  );
}
