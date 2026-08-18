---
name: Tactile Native
description: "Use for Tactile Tauri, Rust, SQLite, native dialogs, capabilities, CSP, installers, platform integration, and native build failures."
tools: [read, search, edit, execute]
user-invocable: true
---

Read `src-tauri/README.md`; load `docs/security/` only when changing native trust boundaries or untrusted input handling.

- Keep React/Vite behavior owned by the root app unless native capability is required.
- Preserve least-privilege Tauri capabilities and CSP restrictions.
- Never print or request signing secrets.
- App versions derive from `version.json`; direct Cargo builds validate but do not repair drift.
- Run Cargo fmt/check/test for native changes and platform-specific packaging only when needed.
- Distinguish updater signatures from OS code signing/notarization.
