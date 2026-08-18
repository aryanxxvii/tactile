# Security and recovery knowledge

Load only for untrusted input, native privilege, plugin execution, dependency supply chain, backup, or release-security work.

## Trust boundaries

- Workspace JSON/CSV/Markdown/assets are untrusted user-controlled input.
- Browser/WebView rendering must not gain native authority.
- Native IPC validates workspace, revision, path, asset, and response identity.
- Production network access is restricted to the approved marketplace origin.
- Portable files remain sufficient to rebuild private cache state.
- Diagnostics must not disclose raw paths, workspace data, or secrets.

## Required controls

- Validate archive paths, counts, sizes, compression ratio, IDs, references, and resources before extraction/commit.
- Stage imports and leave the source/recoverable backup unchanged on failure.
- Keep Tauri capabilities/CSP least-privilege; re-review every new command/origin.
- Lock dependencies, regenerate SBOM/inventory, audit advisories, and review license obligations.
- Verify release checksums/updater signatures; distinguish them from OS signing/notarization.

Known release risks include incomplete cross-platform native durability evidence, native marketplace delivery gaps, and owner-dependent signing/legal controls. Do not claim certification without evidence.
