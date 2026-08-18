# Native subtree instructions

These rules apply under `src-tauri/` in addition to root guidance.

- Read `.agents/domains/native.md` and the nearest owning Rust module/test.
- Preserve least-privilege Tauri capabilities, CSP, and typed IPC validation.
- Keep portable files authoritative; private SQLite/WAL/cache data must be rebuildable.
- Edit only root `version.json`; direct Cargo builds validate version drift.
- Never expose signing secrets, raw private paths, or workspace contents in logs.

Validate with Cargo fmt, then focused check/test. Run platform packaging only for packaging changes.
