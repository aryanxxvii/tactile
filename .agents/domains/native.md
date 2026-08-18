# Native domain

Owns Tauri, Rust, SQLite/private cache, IPC contracts, native dialogs, filesystem boundaries, CSP/capabilities, installers, and platform integration.

- Keep least-privilege capabilities and validate every privileged boundary.
- Do not expose raw paths, workspace data, or signing secrets.
- Portable files remain the recovery authority; native SQLite/WAL is private and rebuildable.
- App versions derive from `version.json`; direct Cargo builds validate but do not repair drift.
- Distinguish updater signatures from Windows/macOS code signing and notarization.

Read `src-tauri/AGENTS.md` for local commands. Load `knowledge/security.md` only when trust or untrusted-input handling changes.
