# Marketplace build and release

Tactile ships Tiles and Text. Code, HTML, SVG, Image, Video, Audio, PDF, and other optional cell objects are independently compiled marketplace packages under `marketplace/plugins/<name>/`.

## Package structure

Every package owns its renderer and runtime behavior:

```text
marketplace/plugins/image/
├── manifest.json
├── plugin.jsx
└── ImageObject.jsx
```

A package must not import another plugin. Shared APIs come from `tactile:host`, which is resolved by the marketplace compiler and supplied by Tactile at activation. The emitted browser ESM bundle has no bare imports or app-relative source imports.

`manifest.json` defines the stable package/type IDs, version, Tactile compatibility, permissions, entry source, supported file extensions, and optional package assets. PDF demonstrates a declared worker asset.

## Compile

Compile all packages and regenerate the catalog:

```bash
npm run marketplace:build
```

Compile only one package:

```bash
npm run marketplace:build -- tactile.image
```

The selective command does not invoke Vite, compile Tactile, or rebuild unrelated packages. It replaces only that package/version artifact and updates its catalog entry. Outputs are written to:

```text
marketplace/dist/catalog.json
marketplace/dist/plugins/<package-id>/<version>/plugin.js
```

Declared assets are emitted beside `plugin.js`. The compiler minifies each package, computes byte sizes and SHA-256 hashes, and records them in `catalog.json`.

## Release in this GitHub repository

1. Change plugin source.
2. Bump its version in `manifest.json` when publishing behavior changes.
3. Run the selective build.
4. Test installation from local preview.
5. Commit both source and generated `marketplace/dist` files.
6. Push the branch. The marketplace workflow verifies that generated artifacts match source.

The simplest remote test uses GitHub raw content. In the browser console, point Tactile at the pushed catalog and reload:

```js
localStorage.setItem(
  "tactile.marketplace.catalogUrl",
  "https://raw.githubusercontent.com/<owner>/<repo>/<branch>/marketplace/dist/catalog.json",
);
location.reload();
```

Clear the override to return to the bundled/same-origin catalog:

```js
localStorage.removeItem("tactile.marketplace.catalogUrl");
location.reload();
```

Catalog artifact paths are relative, so they resolve against GitHub raw, GitHub Pages, a release CDN, or the local `/marketplace/` directory without rebuilding plugin bundles.

Direct GitHub raw testing currently applies to the browser build. The desktop WebView still has a local-only production CSP; release-grade native delivery requires the planned allowlisted Tauri fetch/cache command rather than broadly granting web content arbitrary network access.

## Runtime guarantees

Tactile downloads plugin JavaScript and declared assets, verifies catalog sizes and SHA-256 hashes, stores them in profile-level IndexedDB, and activates the package through the host SDK. Enabled packages restore from cache after restart. Disable removes the type from creation surfaces; uninstall deletes the cached package. Workspace exports preserve plugin-owned object data but never embed executable bundles.

Initial packages are trusted first-party code. Permissions are declared now for compatibility with future enforcement, but external/untrusted publisher sandboxing is outside the current scope.
