# Compatibility and migration

This page is the handoff contract for durable data. It records current behavior and explicitly separates portable interoperability from private implementation caches.

## Current version matrix

| Surface | Current version | Scope | Compatibility behavior |
| --- | ---: | --- | --- |
| Portable workspace JSON | 4 | JSON snapshots and the workspace index | The browser normalizer writes v4. Native validation rejects missing/invalid versions and newer versions. |
| Portable ZIP manifest/index | 4 | `.tactile`/ZIP package boundary | Native import/export requires v4 `manifest.json` and `workspace.json`; the entry index is `workspace.json`. |
| Embedded CSV link | Current v4 grammar | `[[tactile:<type>:<object-id>\|<title>]]` | The object ID is stable; the title is human-readable fallback. Titles are escaped by the CSV/link codec. |
| Native cache | 2 | Private `checkpoint.bin`/`journal.wal` optimization | Not portable. It can be rebuilt from portable files and must not be treated as the canonical user copy. |
| Navigation route | 1 | Runtime/browser history | Carries object, parent-cell, and floating/full mode; it is not a replacement for portable containment metadata. |
| Object model | 4 normalizer | Browser domain records | Legacy `document` is normalized to Markdown-compatible behavior; missing embedded link IDs and parent links are repaired deterministically. |

## Import/export rules

- A sparse sheet displays at least 256 rows by 64 columns but exports only its used range. Empty cells do not become one file or one serialized record each.
- JSON/ZIP workspaces keep object metadata in JSON, sheet values in CSV, Markdown in Markdown, and native assets as bytes. Themes and metadata can carry unknown fields.
- Embedded objects are separate records/files and are referenced from compact cells. A missing reference is an import error, not an invitation to guess a target.
- Portable v4 validation checks object IDs, home/start references, cell counts, asset declarations, file paths, size limits, and archive resources.
- A package declaring a newer version must fail clearly. A downgrade is not promised unless a future migration record explicitly defines it.

## Migration rules

1. Treat the source portable copy as immutable and create a hashed backup.
2. Add a versioned migration or normalizer rule; do not silently reinterpret a field in place.
3. Preserve unknown fields and unknown theme tokens so newer/plugin data can round-trip.
4. Repair legacy address-only topology only when the deterministic parent/cell/object evidence is sufficient; report dangling or cyclic links for owner review.
5. Keep `homeObjectId` as launch metadata. Do not re-root containment when changing the start object.
6. Run round-trip, malformed-input, unknown-field, link-repair, rollback, and cache-rebuild checks.
7. Record the decision in an ADR and update the release compatibility notes.

## Known limits and open work

The browser normalizer and native v4 portable boundary are current implementation evidence, not a promise that every older historical workspace is losslessly migratable. A user-facing migration report, explicit downgrade strategy, full integration of the native SQLite/WAL service, and cross-platform native verification remain release work. Legal, security, and release owners must approve any compatibility promise made to users.
