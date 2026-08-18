# Marketplace knowledge

Load after `marketplace/AGENTS.md` when changing host/catalog architecture rather than one package.

Optional cell objects are independently compiled packages under `marketplace/plugins/<name>/`. Manifests define stable package/type IDs, SemVer, Tactile compatibility, permissions, entry source, extensions, and assets. The compiler resolves `tactile:host`, bundles browser ESM, injects package-owned CSS, and records immutable paths, sizes, and SHA-256 hashes in `marketplace/dist/catalog.json`.

Development builds/serves the local catalog with no-store and reloads after package/SDK changes. Production does not embed the catalog; it loads the verified catalog from the `main` branch GitHub Raw origin. Downloaded JavaScript/assets are size/hash checked before host-created blob activation and profile-level IndexedDB caching.

Installed and enabled are separate states. Marketplace owns install/update/delete; Cell Objects owns enable/disable. Workspace exports preserve plugin-owned data and requirements but never executable bytes.

Host API additions require compiler, host, security, compatibility, and plugin tests. External/untrusted publishers require sandboxing and enforced permissions before support.
