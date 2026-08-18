# Tactile marketplace

This directory is an independently publishable first-party plugin catalog. Tactile consumes only generated files under `marketplace/dist`; adding a plugin does not require rebuilding the Tactile application when the generated directory is deployed separately.

Each available plugin has its own directory, renderer, styles, manifest, and browser ESM entry exporting `activate()`. Packages must not import each other. Source imports approved APIs from `tactile:host`; the compiler resolves that virtual module and Tactile supplies one shared React/runtime SDK during activation. CSS imports are converted to lifecycle-owned style injection inside each independent artifact; plugin selectors do not belong in the host stylesheet.

Activated definitions may include a lazy `settings: { id, label, icon, order, load }` contribution. Tactile displays contributed tabs only while their plugin is enabled and removes them through the same observable registry lifecycle used for renderer registration. See `.agents/knowledge/marketplace.md` for the host/catalog contract.

Run `npm run marketplace:build` to compile every package. Run `npm run marketplace:build -- tactile.image` to compile only Image without invoking the Tactile build or unrelated plugin compilers. The compiler emits immutable versioned artifacts, declared assets, sizes, SHA-256 hashes, and `marketplace/dist/catalog.json`.

`npm run dev` builds and serves this local catalog, watches plugin/SDK source, and reloads after successful rebuilds. Installed plugins are activated from the fresh local artifact during development, so an old IndexedDB bundle cannot hide renderer, CSS, or Settings-tab changes. Production does not embed this directory; it loads the size/hash-verified catalog and artifacts from the repository's GitHub Raw `marketplace/dist` path.

Code, HTML, SVG, Image, Video, Audio, and PDF are independent first-party packages. See `marketplace/AGENTS.md` for package authoring, local testing, and publication instructions.

Installed plugins are enabled or disabled only in the Cell Objects section. Marketplace rows provide Install, Delete, and a version-driven Update action when the catalog contains a newer semantic version.

Generated `marketplace/dist` files are committed so GitHub raw content can act as a first-party static catalog during browser testing. The GitHub workflow recompiles all packages and rejects source/artifact drift.
