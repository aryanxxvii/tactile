# Tactile marketplace

This directory is an independently publishable first-party plugin catalog. Tactile consumes only generated files under `marketplace/dist`; adding a plugin does not require rebuilding the Tactile application when the generated directory is deployed separately.

Each available plugin has its own directory, renderer, manifest, and browser ESM entry exporting `activate()`. Packages must not import each other. Source imports approved APIs from `tactile:host`; the compiler resolves that virtual module and Tactile supplies one shared React/runtime SDK during activation.

Run `npm run marketplace:build` to compile every package. Run `npm run marketplace:build -- tactile.image` to compile only Image without invoking the Tactile build or unrelated plugin compilers. The compiler emits immutable versioned artifacts, declared assets, sizes, SHA-256 hashes, and `marketplace/dist/catalog.json`.

Code, HTML, SVG, Image, Video, Audio, and PDF are independent first-party packages. See `docs/marketplace.md` for package authoring, local testing, and GitHub publication instructions.

Installed plugins are enabled or disabled only in the Cell Objects section. Marketplace rows provide Install, Delete, and a version-driven Update action when the catalog contains a newer semantic version.

Generated `marketplace/dist` files are committed so GitHub raw content can act as a first-party static catalog during browser testing. The GitHub workflow recompiles all packages and rejects source/artifact drift.
