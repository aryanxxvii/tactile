# Cell object plugin template

Copy this directory when starting a cell-object plugin. The template has the two required runtime halves:

- `cell.project`: synchronous, inexpensive logic that returns the compact value shown inside a grid cell.
- `renderer.load`: a lazy import of the expanded React UI shown when the object is opened.

It also defines creation, validation, migration, and portable serialization boundaries. Keep plugin-owned state on the object record; the Counter example uses `count`.

## Install at runtime

The marketplace loader obtains a descriptor exported by the downloaded package and passes it to the session provider:

```js
const uninstall = plugins.install(downloadedModule.default);
```

Registration is observable. The enabled plugin appears immediately in Settings > Plugins and as `In: <label>` in an empty cell's menu. Calling `uninstall()` removes it from those creation surfaces without a restart. Existing records remain intact and use the compatibility fallback until the plugin is installed again.

## Contract rules

1. Use a globally stable, package-qualified `type`; never reuse another plugin's key.
2. Keep `cell.project` pure and fast because it runs while virtualized cells render.
3. Lazy-load the expanded UI through `renderer.load`.
4. Preserve unknown/plugin-owned fields through `migrate`, `serialize`, and `deserialize`.
5. Validate imported records before trusting them.
6. Return an uninstall function from the marketplace installation flow and retain it for the current app session.

The template is not installed by default. It is executable test material and a starting structure for future marketplace packages.