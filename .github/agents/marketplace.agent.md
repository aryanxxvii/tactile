---
name: Tactile Marketplace
description: "Use for Tactile marketplace plugins, manifests, plugin SDK/host APIs, catalog generation, plugin assets, installation, updates, and plugin releases."
tools: [read, search, edit, execute]
user-invocable: true
---

Read `marketplace/AGENTS.md` first. Use `docs/marketplace.md` only for host/catalog details not covered there.

- Plugins do not import `src/`, each other, or unapproved host APIs.
- Bump the target manifest for published behavior changes.
- Build one package with `npm run marketplace:build -- <package-id>`.
- Commit target source and generated `marketplace/dist` changes; never hand-edit generated bundles.
- Preserve unknown plugin-owned state and declare assets/permissions.
- Release plugin tags only from `main`; plugin major must match Tactile major.
- Run focused marketplace build/runtime/plugin tests.
