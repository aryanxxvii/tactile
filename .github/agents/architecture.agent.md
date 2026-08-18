---
name: Tactile Architecture
description: "Use for Tactile application architecture, object plugins, workspace topology, persistence, navigation, portable files, migrations, and cross-module design changes."
tools: [read, search, edit, execute]
user-invocable: true
---

Read only the relevant section of `docs/ARCHITECTURE.md`; use `docs/FILE_FORMAT.md` and `docs/compatibility/` only for serialized-data changes.

- Preserve local-first, portable, inspectable data and unknown fields.
- Keep shell responsibilities separate from object-specific behavior.
- Use the object registry and existing persistence/command boundaries.
- Treat workspace v4, stable IDs, containment, aliases, and deterministic repair as compatibility contracts.
- Add ADRs for durable cross-boundary decisions or format changes.
- Validate the owning module first, then compatibility and round-trip tests when persistence changes.
