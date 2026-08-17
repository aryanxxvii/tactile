# Marketplace agent instructions

These instructions apply to every file under `marketplace/`.

## Package ownership

- Each cell-object type lives in `marketplace/plugins/<type>/` with its own `manifest.json`, `plugin.jsx`, renderer source, styles, and declared assets.
- A plugin must not import another plugin or any file from `src/`.
- Import approved host APIs only from `tactile:host`. Additions to that API require corresponding host, compiler, security, and compatibility tests.
- Keep plugin-owned state on its object record and preserve unknown fields through `migrate`, `serialize`, and `deserialize`.
- Keep compact `cell.project` logic synchronous and inexpensive.

## Version and build workflow

1. Change only the target package where possible.
2. Bump its semantic `version` in `manifest.json` for every published behavior or artifact change. The Marketplace displays Update only when the catalog version is newer than the locally installed version.
3. Compile only that package:

   ```bash
   npm run marketplace:build -- tactile.<type>
   ```

4. Run focused validation:

   ```bash
   node --test tests/marketplace-build.test.mjs tests/marketplace.test.mjs tests/plugins.test.mjs
   ```

5. Commit package source plus all changed generated files under `marketplace/dist/`.

Do not run or require a full Tactile build for a plugin-only release. Run `npm run build` only when the host SDK, loader, core app, or shared build infrastructure changes.

## Release invariants

- Generated bundles are browser ESM with no unresolved bare imports, `tactile:host` strings, app-relative imports, or cross-plugin imports.
- Catalog size and SHA-256 values must match every emitted bundle and declared asset.
- Artifact paths remain relative to `catalog.json` so local hosting, GitHub raw, Pages, and a future CDN use identical output.
- Never hand-edit `marketplace/dist/`; regenerate it.
- PDF owns its worker asset. Audio and Video own their injected CSS. Other plugins must declare any additional runtime assets in their manifest.
- Marketplace controls install, update, and delete. Enable/disable belongs only in Settings > Plugins > Cell Objects.
- Do not add external publisher or untrusted-code support without sandboxing, permission enforcement, signing, and an updated threat model.
