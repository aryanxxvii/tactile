# Marketplace agent instructions

These instructions apply to every file under `marketplace/`.

## Package ownership

- Each cell-object type lives in `marketplace/plugins/<type>/` with its own `manifest.json`, `plugin.jsx`, renderer source, styles, and declared assets.
- A plugin must not import another plugin or any file from `src/`.
- Import approved host APIs only from `tactile:host`. Additions to that API require corresponding host, compiler, security, and compatibility tests.
- Import plugin CSS from the plugin entry or one of its renderer modules. The marketplace compiler converts each CSS import into a package-owned `installStyle(...)` call that is removed when the plugin is deactivated.
- Never add plugin-specific selectors to `src/styles.css`. Plugins may rely on documented host primitives such as `object-surface`, `ObjectHeader`, `object-statusbar`, `cell-format-toolbar`, and `native-file-input`; all other visual classes belong to the plugin.
- Shared plugin SDK CSS may live under `marketplace/sdk/` and be imported by an SDK helper. Every consuming plugin must still compile that CSS into its own independent artifact; plugins never load styles from another plugin at runtime.
- Keep plugin-owned state on its object record and preserve unknown fields through `migrate`, `serialize`, and `deserialize`.
- Cross-plugin content references store stable object IDs, not copied content or source imports. Resolve them from host-provided workspace records, react to source changes, and render a recoverable missing-source state when the referenced plugin/object is unavailable. HTML uses this pattern to preview an HTML-language Code object while both objects retain their own type and cell.
- Keep compact `cell.project` logic synchronous and inexpensive.

## Settings contributions

- A plugin may contribute one lazy Settings tab with `settings: { id, label, icon, order, loadingLabel?, load }` on its activated definition. The optional loading label customizes the host-owned themed Suspense experience; the loading component and animation remain generic host UI.
- Use a stable lowercase `id` containing only letters, numbers, and hyphens. The host namespaces it with the package ID, orders contributions by `order`, label, and key, and rejects duplicate keys.
- `load` must resolve to a React component. Keep the panel and its styles in the plugin and obtain approved services through `tactile:host`; do not import or branch on the plugin from `SettingsPanel.jsx`.
- A contributed tab is visible only while its plugin is installed and enabled. Disable, update, and uninstall are live registry events; Settings falls back to its Plugins tab if the active contribution disappears.
- Store machine-local or profile-level preferences outside portable workspace objects. Hiding or uninstalling a tab must not silently erase those preferences unless deletion is an explicit user action.

## Version and build workflow

`npm run dev` is the local plugin preview path. It builds `marketplace/dist` before Vite starts, serves that directory at `/marketplace/` with `no-store`, watches `marketplace/plugins/` and `marketplace/sdk/`, rebuilds on source changes, and reloads after a successful build. Development activation prefers the current local artifact over an installed IndexedDB bundle without overwriting the persistent production cache.

Production does not embed `marketplace/dist` in the client. It defaults to the verified catalog at `https://raw.githubusercontent.com/aryanxxvii/tactile/main/marketplace/dist/catalog.json`; relative artifact URLs remain on that allowlisted origin.

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
- Every plugin owns its injected CSS. PDF also owns its worker asset. Plugins must declare additional runtime assets in their manifest.
- Marketplace controls install, update, and delete. Enable/disable belongs only in Settings > Plugins > Cell Objects.
- Do not add external publisher or untrusted-code support without sandboxing, permission enforcement, signing, and an updated threat model.
