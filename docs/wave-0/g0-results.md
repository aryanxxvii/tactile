# Gate G0 results

Run date: 2026-08-12
Branch at verification: `codex/tactile-wave-0-modernization`

## Result

All executable Wave 0 checks pass. G0 sign-off is complete: the user-owned `WORKFLOW.md` and `TRACKER.md` files were explicitly approved for repository inclusion and are included in the Wave 0 commit.

| Check                        | Result                                                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Clean lockfile install       | Pass - `npm ci --ignore-scripts` completed after stopping the Tactile preview that held esbuild open            |
| Formatting                   | Pass - `npm run format:check`; user-owned `WORKFLOW.md` is intentionally excluded from repository format checks |
| Lint                         | Pass with 17 migration warnings and 0 errors - `npm run lint`                                                   |
| TypeScript bridge            | Pass - `npm run typecheck`                                                                                      |
| Unit and compatibility tests | Pass - 32/32 - `npm run test:unit`                                                                              |
| Performance fixture tests    | Pass - 2/2 - `node --test tests/performance/*.test.mjs`                                                         |
| Component harness            | Pass with no test files yet - `npm run test:component`                                                          |
| E2E harness                  | Pass - 1 drag-reversal regression test - `npm run test:e2e`                                                     |
| Production build             | Pass - Vite 6.4.3, 6,258 modules transformed                                                                    |
| Sites worker tests           | Pass - 4/4 - `npm run test:sites`                                                                               |
| Sites artifacts              | Pass - `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json` exist                  |
| Browser performance baseline | Pass - fixed fixture, five scenarios, typing assertion, and observable React commit counts                      |
| Visual baseline              | Pass - all nine Paper/In & Out states regenerated at 1440 x 900                                                 |
| Dependency audit             | Pass - 0 high, 0 critical                                                                                       |
| Rust toolchain smoke         | Pass - Rust 1.97.1; Cargo format, Clippy `-D warnings`, and tests pass in a temporary Cargo project             |

## A01 closure

The pre-load browser harness installs a minimal React DevTools hook when no hook exists, allowing React 19 commit callbacks to be counted without modifying production code. The final browser run reports observable commit counts for fixture import (9), scroll (54), typing (7), In & Out (14), and nested navigation (52). The typing scenario waits for the editor, types into B1, commits with Enter, and asserts the resulting cell value; it completed with no action error.

The baseline intentionally exceeds future performance budgets on this non-certification host. The current bundle is approximately 140.1 KB gzip JavaScript and 14.5 KB gzip CSS. Full measurements are archived in [`docs/performance/browser-results.json`](../performance/browser-results.json), [`docs/performance/baseline-results.json`](../performance/baseline-results.json), and [`docs/performance/visual-results.json`](../performance/visual-results.json).

## A02 closure

Node/npm are pinned at 24.13.0/11.6.2 in `.nvmrc`, `package.json`, and the lockfile. Rust 1.97.1 is installed through the host MSVC distribution and the repository’s `rust-toolchain.toml` requires the `rustfmt` and `clippy` components. A temporary Cargo project passed `cargo fmt --all -- --check`, `cargo clippy --all-targets --all-features -- -D warnings`, and `cargo test --all-targets`.

## Protected files

The following remain unchanged: `AGENTS.md`, `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs`.

## Final disposition

The user explicitly approved repository inclusion for `TRACKER.md` and `WORKFLOW.md`. Both files are included in the Wave 0 commit, so no manual G0 disposition remains.
