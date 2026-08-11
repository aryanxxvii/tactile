# Gate G0 results

Run date: 2026-08-11
Branch at gate: `main` before Wave 0 integration commit

## Result

Gate G0 passes for the browser/Sites preview and JavaScript toolchain.

| Check                        | Result                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| Clean lockfile install       | Pass - `npm ci` completed after stopping only the Tactile preview helpers that held esbuild open |
| Formatting                   | Pass - `npm run format:check`                                                                    |
| Lint                         | Pass with 17 migration warnings and 0 errors - `npm run lint`                                    |
| TypeScript bridge            | Pass - `npm run typecheck`                                                                       |
| Unit and compatibility tests | Pass - 32/32 - `npm run test:unit`                                                               |
| Component harness            | Pass with no test files yet - `npm run test:component`                                           |
| E2E harness                  | Pass with no test files yet - `npm run test:e2e`                                                 |
| Production build             | Pass - Vite 6.4.3, 6,258 modules transformed                                                     |
| Sites worker tests           | Pass - 4/4                                                                                       |
| Performance fixture tests    | Pass - 2/2                                                                                       |
| Browser performance baseline | Measured - fixed fixture, scroll/typing/In & Out/nested scenarios, 8 visual captures             |
| Dependency audit             | Pass - 0 high, 0 critical                                                                        |
| Rust checks                  | Deferred - Rust/Cargo are not installed on this host                                             |

## Protected files

The following remain unchanged: `AGENTS.md`, `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs`.

The integrated Wave 0 paths are clean after commit. An unrelated, user-owned untracked `WORKFLOW.md` was present at final handoff and was intentionally preserved outside the commit.

## Known Wave 0 limitations

- Component and E2E test directories are intentionally empty foundations; future waves must add real browser coverage.
- The measured baseline exceeds the future performance budgets and contains a typing action timeout; these are recorded as starting evidence, not hidden or treated as release failures.
- The JavaScript bundle is approximately 140.1 KB gzip versus the future 110 KB budget.
- Rust/Tauri checks cannot run until the native toolchain is installed.
