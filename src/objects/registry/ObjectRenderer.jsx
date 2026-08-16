import { lazy, Suspense } from "react";
import {
  getObjectTypeDefinition,
  listObjectTypeDefinitions,
  loadObjectRenderer,
} from "./index.js";

const loadedRenderers = new Map();
const lazyRenderers = new Map();

function lazyObjectRenderer(type) {
  if (lazyRenderers.has(type)) return lazyRenderers.get(type);
  const Renderer = lazy(async () => {
    const Renderer = await loadObjectRenderer(type);
    loadedRenderers.set(type, Renderer);
    return { default: Renderer };
  });
  lazyRenderers.set(type, Renderer);
  return Renderer;
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
  const LoadedRenderer = loadedRenderers.get(definition.type);
  if (LoadedRenderer) return <LoadedRenderer object={object} {...props} />;
  const Renderer = OBJECT_RENDERERS[definition.type] || lazyObjectRenderer(definition.type);
  return (
    <Suspense fallback={null}>
      <Renderer object={object} {...props} />
    </Suspense>
  );
}

export function preloadObjectRenderer(type) {
  const definition = getObjectTypeDefinition(type);
  return loadObjectRenderer(type)
    .then((Renderer) => {
      loadedRenderers.set(definition.type, Renderer);
      return Renderer;
    })
    .catch(() => null);
}
