# Wave 4 native platform evidence

Date: 2026-08-14

## Packet evidence

| Packet | Result | Evidence |
| --- | --- | --- |
| E01 | Implemented | Tauri 2 shell, strict production/loopback development CSP, zero-permission main capability, native title synchronization, and scaffold security tests. |
| E02 | Implemented as a recovery scaffold | Record-oriented WAL, acknowledged transactions, atomic checkpoints, torn-tail recovery, migration rollback, portable cache rebuild, and typed path-safe errors. The current implementation is dependency-free and does not yet provide the workflow's required `rusqlite` WAL database. |
| E03 | Implemented | Streaming v4 JSON/CSV/ZIP import/export, ZIP safety limits, unknown-field preservation, direct metadata lookup, staged extraction, cancellation/progress, and native asset streaming. |
| E04 | Implemented | Typed Tauri IPC contracts, compact deltas, stale-ack rejection, runtime detection/factory, native asset handles, and dialog boundary tests. |

## Checks run

- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check` — passed.
- `cargo check --manifest-path src-tauri/Cargo.toml` — passed.
- `cargo test --manifest-path src-tauri/Cargo.toml` — passed: 3 library, 5 portable, 4 scaffold, and 4 recovery tests.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` — passed.
- `npm run test:unit` — passed: 77/77.
- `npm run typecheck` — passed.
- `npm run lint` — passed with 0 errors and existing warnings only.
- `npm run build` — passed; Sites artifacts were generated and bundle budgets remained within the enforced limits.
- `npm run test:sites` — passed: 4/4.
- Focused browser bracket behavior — passed: 1/1.
- Focused In & Out ancestry/background behavior — passed: 1/1.

## Gate status

G4 remains open. The repository has local evidence for the native packets, but the required Windows/macOS/Ubuntu native smoke matrix has not run in CI yet, and E02 still needs the production SQLite/WAL service specified by the workflow. Cross-platform native WebView performance certification is also not locally available. These are release blockers, not waived criteria.
