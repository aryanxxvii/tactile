# Marketplace build and release

Tactile ships Tiles and Text. Code, HTML, SVG, Image, Video, Audio, PDF, and other optional cell objects are independently compiled marketplace packages under `marketplace/plugins/<name>/`.

## Package structure

Every package owns its renderer and runtime behavior:

```text
marketplace/plugins/image/
├── manifest.json
├── plugin.jsx
├── ImageObject.jsx
└── ImageObject.css
```

A package must not import another plugin. Shared APIs come from `tactile:host`, which is resolved by the marketplace compiler and supplied by Tactile at activation. The emitted browser ESM bundle has no bare imports or app-relative source imports.

`manifest.json` defines the stable package/type IDs, version, Tactile compatibility, permissions, entry source, supported file extensions, and optional package assets. PDF demonstrates a declared worker asset.

### Styles

Plugins own their visual implementation. Import CSS from `plugin.jsx` or a renderer module:

```js
import "./ImageObject.css";
```

The marketplace compiler converts the import into a package-local `installStyle(...)` call. Enabling the plugin installs the style and deactivation removes it. Do not place plugin selectors in `src/styles.css`; that would make an uninstalled plugin depend on the host build and leave dead CSS in the application.

Plugins may use documented shell primitives supplied by the host, including `object-surface`, `ObjectHeader`, `object-statusbar`, `cell-format-toolbar`, and `native-file-input`. Renderer-specific layout, controls, responsive rules, animation, and state selectors remain plugin-owned. Shared first-party plugin CSS may live under `marketplace/sdk/` when an SDK helper imports it, as `createFilePlugin` does; the compiler still embeds a separate copy in each consuming artifact, so packages have no runtime dependency on each other.

### Settings tabs

An enabled plugin may contribute a lazy Settings tab from its activated definition:

```js
return {
  // Required object-plugin fields...
  settings: {
    id: "runtimes",
    label: "Code runtimes",
    icon: IconTerminal2,
    order: 50,
    loadingLabel: "Cooking code runtimes",
    load: async () => (await import("./CodeRuntimeSettings.jsx")).CodeRuntimeSettings,
  },
};
```

The `id` must be stable lowercase letters, numbers, or hyphens. Tactile namespaces it with the package ID, validates the icon and loader, sorts contributed tabs deterministically, and lazily loads only the active panel. `loadingLabel` optionally supplies copy for the host-owned themed loading state. `SettingsPanel.jsx` does not import or special-case plugins.

Plugins may reference content owned by another installed object without importing that plugin. Store the source object's stable ID, resolve its current record through host-provided workspace data, and handle missing/disabled sources explicitly. For example, an HTML object may select an HTML-language Code cell as a live preview source; the Code and HTML objects remain separate portable records and edits are not copied between them.

The tab appears only while the plugin is installed and enabled. Disabling, updating, or uninstalling the plugin updates Settings immediately; if its panel is active, Settings returns to Plugins. The panel owns its UI and CSS and accesses approved profile/runtime services through `tactile:host`. Machine-specific preferences such as executable paths belong in profile-level storage, not portable workspace settings or object records.

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

## Development and production authority

`npm run dev` is intentionally local-first for plugin development:

1. The script builds all packages before starting Vite.
2. Vite serves `marketplace/dist` at `/marketplace/` with `Cache-Control: no-store`.
3. Changes under `marketplace/plugins/` or `marketplace/sdk/` rebuild the local catalog and reload the page after a successful build.
4. On startup, installed plugins are activated from the matching local catalog artifact instead of stale IndexedDB source. This override is in-memory and does not replace the persistent production cache.

The Code plugin must still be installed and enabled to expose its object renderer and contributed Code runtimes Settings tab. Development changes package authority; it does not auto-install optional plugins.

Production uses the GitHub-hosted catalog by default:

```text
https://raw.githubusercontent.com/aryanxxvii/tactile/main/marketplace/dist/catalog.json
```

Production preparation explicitly removes `dist/client/marketplace`; there is no bundled same-origin fallback. Catalog entries retain relative artifact paths, and every downloaded JavaScript or declared asset is checked against its catalog byte size and SHA-256 before activation. The native CSP allowlists only `raw.githubusercontent.com` for marketplace network access and allows the host-created blob used to import verified plugin JavaScript.

## Release in this GitHub repository

1. Change plugin source.
2. Bump its version in `manifest.json` when publishing behavior changes.
3. Run the selective build.
4. Test installation from local preview.
5. Commit both source and generated `marketplace/dist` files.
6. Push the branch. The marketplace workflow verifies that generated artifacts match source.

Marketplace lifecycle ownership is intentionally split:

- **Cell Objects** lists built-in and installed types, including disabled installed plugins, and owns Enable/Disable.
- **Marketplace** owns Install, Delete, and Update. Update appears only when `catalog.version` is newer than the installed semantic version.

When releasing an update, always bump `version` in the target `manifest.json`. Rebuilding changed source under the same version violates the immutable artifact contract and will not offer users an update.

The simplest remote test uses GitHub raw content. In the browser console, point Tactile at the pushed catalog and reload:

```js
localStorage.setItem(
  "tactile.marketplace.catalogUrl",
  "https://raw.githubusercontent.com/<owner>/<repo>/<branch>/marketplace/dist/catalog.json",
);
location.reload();
```

Clear the override to return to the production GitHub catalog:

```js
localStorage.removeItem("tactile.marketplace.catalogUrl");
location.reload();
```

Catalog artifact paths are relative, so they resolve against GitHub raw or the local development `/marketplace/` directory without rebuilding plugin bundles. Vite development ignores the localStorage catalog override to remain deterministic.

## Runtime guarantees

Tactile downloads plugin JavaScript and declared assets, verifies catalog sizes and SHA-256 hashes, stores them in profile-level IndexedDB, and activates the package through the host SDK. Enabled packages restore from cache after restart. Disable removes the type from creation surfaces; uninstall deletes the cached package. Workspace exports preserve plugin-owned object data but never embed executable bundles.

Initial packages are trusted first-party code. Permissions are declared now for compatibility with future enforcement, but external/untrusted publisher sandboxing is outside the current scope.

## Checklist for a new plugin

1. Copy the package shape used by `marketplace/plugins/image/` or the registry template.
2. Choose stable package and object type IDs.
3. Add `manifest.json`, `plugin.jsx`, and an independent renderer. Do not import from another plugin or `src/`.
4. Import approved services from `tactile:host` only.
5. Keep plugin CSS with the package and import it from plugin source; do not add plugin selectors to host CSS.
6. If needed, declare a lazy `settings` contribution and verify its enabled/disabled/uninstalled lifecycle.
7. Declare file extensions, MIME prefixes, permissions, and runtime assets in the manifest.
8. Add package-specific tests when behavior goes beyond the generic artifact/runtime contracts.
9. Run the selective build and focused tests.
10. Test Install, open/render, disable/re-enable from Cell Objects, Delete, restart restoration, and remote GitHub loading.
11. Commit source and generated artifacts together.
