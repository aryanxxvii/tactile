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

Built-ins and runtime marketplace packages use the same `defineObjectPlugin` contract. Runtime registration is observable, so an enabled install appears immediately in Settings and the empty-cell creation menu without restarting. The registry, provider, renderer adapter, built-in catalog, SDK contract, and copyable implementation template live together in `src/objects/registry/`; installation and enablement are app-session state and are not written into portable workspaces.

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
