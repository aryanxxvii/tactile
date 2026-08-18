# Marketplace domain

Owns plugin manifests/source, host SDK/compiler APIs, catalog generation, package assets, installation/cache/update behavior, and plugin releases.

- Read `marketplace/AGENTS.md` before editing this subtree.
- Plugins import only approved `tactile:host` APIs and never import `src/` or each other.
- Package code, styles, state, permissions, and assets remain package-owned.
- Never hand-edit `marketplace/dist`; regenerate and commit source plus generated artifacts.
- Published behavior changes require a target manifest version bump.
- Plugin major versions match Tactile major; releases originate from `main`.

Use `npm run marketplace:build -- <package-id>` and focused marketplace tests.
