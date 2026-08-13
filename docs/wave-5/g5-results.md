# Wave 5 acquisition and release gate

Date: 2026-08-14

## Packet status

- F01 complete: added accessibility/recovery browser coverage and native/Tauri recovery boundary tests. New tests passed; no coverage reporter is configured, so numeric coverage thresholds remain unverified.
- F02 complete as a certification packet, but certification failed honestly against the fixed budgets. The latest strict report records scroll frame p95 133.3 ms, typing frame p95 633.3 ms with 7,648 ms input p95, In & Out frame p95 766.6 ms, nested frame p95 733.3 ms, listener retention up to +867, and full client JavaScript 221,027 gzip bytes versus the 112,640-byte budget. The stabilized global event bridge reduced frame/long-task variance in this run but did not clear the release budgets or leak gate.
- F03 complete: release matrix and checksum/artifact validation helpers cover Windows MSI, macOS universal DMG, and Linux AppImage/.deb. Actual runner packaging and Apple signing remain CI/credential dependent.
- F04 complete: handoff, security, backup/recovery, compatibility, ADR, ownership, reproducible-build, SBOM, and license inventory documentation are present. `npm audit` is clean; `cargo audit` is unavailable locally; two npm license entries remain legal-review items.

## G5 checks run

- Unit/compatibility: 77/77 passed.
- Typecheck: passed.
- Lint: 0 errors, existing warnings only.
- Build and Sites packaging: passed; Sites tests 4/4.
- Rust format/check/test/strict Clippy: passed after SQLite/WAL integration.
- Focused bracket, path-surface, accessibility/recovery, and native persistence tests: passed.
- Performance certification: strict fail, with the blockers above.
- Full E2E suite: timed out at the configured five-minute limit without a result.
- Cross-platform native smoke/package matrix: not available in the local Windows environment.

## Gate decision

G5 remains open. No performance budget, leak, coverage, full-browser, cross-platform native, or cargo-advisory requirement is waived. These blockers must be cleared before the final release requirements can be marked complete.
