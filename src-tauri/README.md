# Tactile native shell

This directory contains the Wave 4 E01 Tauri 2 shell. It embeds the existing Vite output from `../dist/client`; the
React application and the Sites build remain owned by the repository root.

## Commands

From the repository root:

```powershell
pwsh -File src-tauri/scripts/dev.ps1
pwsh -File src-tauri/scripts/build.ps1
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

On macOS or Linux, the equivalent wrappers are `sh src-tauri/scripts/dev.sh` and
`sh src-tauri/scripts/build.sh`.

The wrappers use the pinned Tauri CLI through `npx` so this scaffold does not modify the root `package.json` or
`package-lock.json`. The central integration owner can add a shared `tauri` package script once native tooling is
owned by the root manifest.

## Security boundary

- `capabilities/main.json` applies only to the `main` window and grants no Tauri or plugin permissions.
- It has no `remote` URL scope, so remote content cannot inherit native capabilities.
- The production CSP contains no network or WebSocket sources. The development CSP allows only the loopback Vite
  server and its HMR WebSocket.
- Tauri's global JavaScript API is disabled with `withGlobalTauri: false`.
- The shell enables prototype freezing and does not enable the asset protocol.

## Window title

The React client already sets `document.title` to `Tactile — {object title}`. The Rust shell mirrors document-title
changes to the native window and falls back to `Tactile — Home` for an empty title.

