# Portable format and compatibility

Load for serialization, migration, import/export, topology repair, or recovery changes.

## Current contracts

| Surface                 |    Version | Rule                                                   |
| ----------------------- | ---------: | ------------------------------------------------------ |
| Workspace JSON/index    |          4 | Reject invalid/newer versions; preserve unknown fields |
| ZIP/`.tactile` manifest |          4 | `manifest.json` points to `workspace.json`             |
| Embedded CSV link       | v4 grammar | `[[tactile:<type>:<object-id>\|<title>]]`              |
| Native private cache    |          2 | Rebuildable; never portable authority                  |
| Navigation route        |          1 | Runtime history, not containment metadata              |

Portable bundles keep indexes in JSON, sheet values in sparse CSV, text in Markdown, native resources as bytes, and themes/metadata in adjacent JSON. Missing references are errors; do not guess targets.

## Migration rules

1. Treat the source portable copy as immutable and create a hashed backup.
2. Add an explicit versioned migration/normalizer rule.
3. Preserve unknown fields and theme tokens.
4. Repair legacy topology only from deterministic evidence.
5. Keep `homeObjectId` as launch metadata.
6. Test round-trip, malformed input, unknown fields, repair, rollback, and cache rebuild.
7. Record durable format decisions in `.agents/decisions/` and release compatibility notes.

The implementation does not promise lossless migration from every historical version or downgrade support unless explicitly documented and tested.
