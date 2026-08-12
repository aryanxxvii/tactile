# Wave 1 B04 results

Run date: 2026-08-12
Packet commit: `4dfddbb`

## Result

B04 is complete. Existing object types now resolve through a typed/JSDoc-compatible descriptor registry without rewriting the portable format or eagerly loading inactive renderers.

## Deliverables

- `src/objects/registry/types.js` defines the `ObjectTypeDefinition`, renderer, asset-policy, and command-contribution contracts.
- `src/objects/registry/descriptors.js` registers sheet, markdown, document, PDF, image, video, HTML, and SVG descriptors.
- `src/objects/registry/compatibility.js` adapts existing creation, validation, migration, and serialization behavior.
- `src/objects/registry/index.js` provides definition lookup, registration, lazy renderer loading, and renderer promise de-duplication.
- `src/objects/objectRegistry.jsx` and `src/objects/objectTypes.js` resolve through the registry while preserving current call sites.
- In the central integration pass, visible embedded-cell types can be preloaded just in time and already-loaded renderers render synchronously. This keeps the registry lazy while preventing a blank child surface during In & Out handoff.

## Acceptance

- Registry contract tests: 3/3 pass.
- Unit and compatibility tests: 35/35 pass.
- TypeScript check: pass.
- Scoped lint and formatting: pass.
- Production build and Sites packaging: pass.
- Built renderer chunks remain lazy; renderer modules are not invoked while the registry is constructed.

No portable import/export rewrite was introduced.
