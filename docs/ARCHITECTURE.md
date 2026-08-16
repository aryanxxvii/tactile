# Tactile architecture direction

## Product shell

The shell owns local persistence, object navigation, home-object selection, commands, theming, undo history, and portable import/export. It does not own sheet, Markdown, Gantt, media, or canvas behavior.

Each object type registers:

- a stable type key
- label and monochrome icon
- lazy expanded renderer
- synchronous compact cell projection
- file serializer and parser
- default-title generator
- commands and context-menu contributions

This lets later types such as Gantt charts join the same navigation and file model without rewriting the workspace shell.

Built-ins and runtime marketplace packages use the same `defineObjectPlugin` contract. Runtime registration is observable, so an enabled install appears immediately in Settings and the empty-cell creation menu without restarting. The registry, provider, renderer adapter, built-in catalog, SDK contract, and copyable implementation template live together in `src/objects/registry/`; marketplace installation and enablement are profile-level state and are not written into portable workspaces.

## Marketplace boundary

The installed client bundles only Tiles and Text as user-managed object types. Bare links and legacy Document-to-Text migration remain core compatibility behavior. Unknown optional types render through `MissingPluginObject`; their records and assets are not coerced into another type.

`marketplace/` is independently buildable and publishable. `npm run marketplace:build` compiles all first-party manifests; `npm run marketplace:build -- <package-id>` compiles only one plugin without invoking the Tactile Vite build. It emits a static v1 catalog plus immutable versioned ESM bundles, declared assets, sizes, and SHA-256 hashes. Packages import approved APIs only through the compiler-resolved `tactile:host` module and do not import each other. Tactile supplies the shared React runtime and approved SDK functions. Publishing generated marketplace artifacts does not require rebuilding the Tactile client.

Browser installations are stored in profile-level IndexedDB, separate from workspace records. Installed bundles are verified before activation and enabled plugins are restored on restart. Portable workspaces never contain executable plugin bytes; they preserve opaque plugin-owned object fields and declare non-executable `pluginRequirements` metadata.

Counter, Code, PDF, Image, Video, Audio, HTML, and SVG are independently compiled packages and remain absent from core production chunks. PDF owns its separately verified worker asset; Video and Audio own plugin-local player styles. Native allowlisted download/cache commands remain required before desktop marketplace delivery is release-complete. Build and GitHub release instructions are in [marketplace.md](marketplace.md).

## Performance rules

- Sheets are sparse in memory and on disk.
- A 256 × 64 Tiles surface is virtualized; only the visible rows and columns plus a small overscan are mounted.
- Scroll work is coalesced through `requestAnimationFrame`.
- Cell edits update one sparse record rather than copying or serializing 16,384 empty cells.
- Persistence is debounced and performed through IndexedDB with a localStorage fallback.
- Font files and object assets are self-hosted; inactive font families are not fetched until they are rendered.
- In & Out animates transforms and opacity only. Object content is mounted once per layer and the source geometry is snapshotted before animation.

## Data boundaries

- `workspace`: identity, home object, object index, themes, and settings.
- `sheet object`: sparse cells plus optional spreadsheet metadata.
- `markdown object`: Markdown source string.
- `file object`: native binary asset metadata plus an IndexedDB/blob record.
- `view state`: selection, scroll, open layers, and transient menus. View state is not mixed into exported content unless explicitly useful.

## Command model

All user actions should eventually be commands with IDs, labels, keybindings, availability predicates, and reversible payloads. Context menus, keyboard shortcuts, command search, and future plugins invoke the same commands. This avoids separate behavior for mouse and keyboard paths and makes undo/redo reliable.
