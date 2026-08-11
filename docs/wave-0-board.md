# Tactile modernization - Wave 0 delegation board

Status: Gate G0 passed; integrated Wave 0
Started: 2026-08-11
Integrator: Luna Max orchestration thread

## Repository baseline

- Repository: `C:\dev\tactile`
- Branch: `main`
- HEAD at kickoff: `d2027b9` (`remove dock shortcut hint`)
- Worktree: clean at kickoff
- Product direction: Paper visual scheme and all durable decisions in `AGENTS.md` remain locked
- Sites handoff files remain protected: `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, `tests/sites-worker.test.mjs`

## Wave 0 packets

| Packet                                                 | Owner                                                                                          | Write scope                                                                                                      | Status     | Review gate                                                                                                                                                  |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A01 - performance and visual baseline                  | Boole (`019ff16d-6916-74f0-aebb-0eb8972b94b3`)                                                 | `benchmarks/**`, `tests/performance/**`, `tests/visual/**`, performance Playwright config, `docs/performance/**` | integrated | Fixed fixture, browser harness, 8 visual states, bundle report, and measured rerun are reviewed; future budgets remain intentionally unmet baseline evidence |
| A02 - toolchain, TypeScript, and dependency foundation | Volta / Heisenberg (workers stopped; integrator applied)                                       | `package.json`, `package-lock.json`, TypeScript/ESLint/Prettier/Vite/toolchain config, shared scripts            | integrated | Strict migration bridge, requested scripts, Vite 6.4.3, zero high/critical audit findings, and Sites preservation are verified                               |
| A03 - compatibility and migration fixtures             | Faraday + Ohm (`019ff16d-6bfb-79c2-8f38-d10adab24d2c`, `019ff17a-dc89-7500-845a-95a47567b67d`) | `tests/fixtures/**`, `tests/compatibility/**`, `src/compat/**`, runtime schema modules only                      | integrated | v1-v4 fixtures, sequential migration/round-trip tests, unknown metadata preservation, and safe rejection behavior are verified                               |

## Integration rules

1. Packets are disjoint and must not edit `AGENTS.md`, production UI, Sites worker files, or another packet's scope.
2. Each packet should return one reviewable commit or a precise integration request if it needs a shared-file change.
3. The integrator reviews diffs, rejects unrelated cleanup, and runs Gate G0 only after all three packets are stopped and integrated.
4. No Wave 1 packet starts until Gate G0 passes and the baseline report is archived.

## Gate G0 checklist

- [x] Clean install succeeds
- [x] Current tests pass
- [x] Production build succeeds
- [x] Sites artifacts exist
- [x] Baseline reports are archived
- [x] Wave 0 integration files are clean after the commit; unrelated user-owned `WORKFLOW.md` remains untracked and untouched
