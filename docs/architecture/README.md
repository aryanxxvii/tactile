# Tactile architecture

This is the current implementation map for handoff. It describes boundaries and durable invariants; it does not turn the existing recovery scaffold into a production storage guarantee.

## Boundary map

```text
React shell
  -> command/transaction engine -> normalized workspace/domain model
  -> object registry -> sheet, Markdown/document, and file-object renderers
  -> persistence port
       -> browser adapter (local browser persistence)
       -> Tauri adapter -> typed IPC contracts -> native shell
                                      -> private cache / WAL / checkpoint
                                      -> portable JSON/CSV/ZIP and asset streams
```

The shell owns workspace identity, object navigation, start-object metadata, commands, theme selection, undo history, and persistence coordination. Object renderers own their type-specific behavior. The registry is the extension seam for future types such as Gantt charts; a new type should not rewrite the shell or portable link grammar.

## Durable model

- A sheet is the stable spatial map. It displays at least 256 rows by 64 columns but serializes only its used data.
- A cell is an ordinary value/formula or an embedded-object reference. Embedded objects have stable IDs and can nest.
- Embedded references carry a stable link ID, relation (`containment` or `alias`), child object ID, type, parent object ID, and source cell/address. Cells remain the visible source of truth; object parent metadata makes the relation inspectable.
- `homeObjectId` identifies the default launch target. It does not re-root containment. `homePath` remains a compatibility route field.
- The current portable workspace and object normalizer use version 4. The native cache has a separate private schema version 2.
- Browser/native persistence communicates forward-only deltas and revision acknowledgements. Inverse patches stay in the engine and do not cross the native boundary.

## Portable boundary

Portable data is file-oriented: JSON indexes describe workspace objects, sheets are CSV, Markdown remains Markdown, and binary resources retain their native bytes. ZIP import/export validates paths, limits, references, and resources before staged extraction. Unknown fields are preserved by the native v4 portable path.

The portable format is an interoperability contract. The private native cache is a rebuildable optimization and must not become the only copy of user data. See [the format notes](../FILE_FORMAT.md) and [the compatibility guide](../compatibility/README.md).

## Native boundary and known gap

The native tree now contains both the original dependency-free record/WAL recovery scaffold and a private `rusqlite`-backed `SqliteStorage` service. The SQLite service enables WAL mode, full synchronous writes, foreign keys, transactional records, revision metadata, acknowledgements, and checkpoints, and has a focused reopen test. It is exposed from the native library but is not yet evidenced as wired through every Tauri persistence command or as certified across the supported native platform matrix. Treat integration and cross-platform smoke evidence as release work; keep the portable copy as the user recovery boundary.

Tauri commands are named in `src/platform/tauri/contracts.ts`. The adapter validates workspace snapshots, revisions, export envelopes, asset bytes, and handle identity before returning data to the engine.

## Change guidance

When a decision changes a boundary, serialized field, trust assumption, or recovery guarantee, write an ADR using [the template](../adr/0000-adr-template.md). Include the invariant being protected, migration/rollback behavior, test evidence, and owner sign-off prerequisites.
