# Architecture knowledge

Load only for cross-module ownership, persistence, topology, or portability changes. Source and tests remain authoritative.

## Boundary map

```text
React shell
  -> command/transaction engine -> workspace model
  -> object registry -> sheet, Markdown, and file renderers
  -> persistence port
       -> browser IndexedDB adapter
       -> Tauri adapter -> typed IPC -> native cache/SQLite/WAL
  -> portable JSON/CSV/Markdown/assets
```

The shell owns workspace identity, navigation, start-object metadata, commands, themes, undo, and persistence coordination. Object renderers own type behavior. Runtime and built-in objects use the same registry contract.

## Durable invariants

- Sheets are sparse and virtualized; the 256 x 64 surface is a display default, not serialized emptiness.
- Embedded objects have stable object/link IDs, containment or alias relations, parent identity, and source cell.
- `homeObjectId` selects launch behavior; it does not rewrite containment.
- Portable workspace/object normalization is v4. Native cache schema is private and rebuildable.
- Browser/native persistence uses forward deltas and revision acknowledgements; inverse patches stay in the engine.
- Portable files are the user recovery authority. Native SQLite/WAL is an optimization, not the only copy.
- Unknown fields and future/plugin state round-trip without coercion.

## Primary implementation

- Composition: `src/App.jsx`, `src/hooks/`, `src/shell/`
- Domain/topology: `src/core/`, `src/model.js`
- Registry/objects: `src/objects/registry/`, `src/objects/`
- Browser persistence: `src/platform/browser/`, `src/storage.js`
- Native contracts/cache: `src/platform/tauri/`, `src-tauri/src/`
- Portable import/export: `src/export.js`, `src/compat/`, `src-tauri/src/portable/`

Create or supersede an ADR when changing a durable boundary, serialized contract, trust assumption, or recovery guarantee.
