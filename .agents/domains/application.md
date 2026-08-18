# Application domain

Owns the React shell, object model/registry, navigation, commands, browser persistence, portable import/export, sheets, Markdown, themes, and workers.

- Keep shell responsibilities separate from object-specific behavior.
- Use the existing registry, command, topology, and persistence boundaries.
- Preserve stable object/link IDs, containment/alias semantics, deterministic repair, and unknown fields.
- Treat portable workspace v4 as a compatibility contract; private caches are rebuildable.
- Keep sheets sparse and virtualized; avoid work proportional to the full visible grid.
- Heavy Markdown renderers remain lazy, strict, and source-only at the portable boundary.

Load `knowledge/architecture.md` for cross-module changes and `knowledge/file-format.md` only for serialized data or migration work.
