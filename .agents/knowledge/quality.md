# Quality and performance knowledge

Use with `.agents/workflows/testing.md` for QA, performance, or certification tasks.

- Default Node tests are root `tests/*.test.mjs`; nested suites are explicit.
- Browser interaction/visual behavior uses Playwright configurations at the repository root.
- Performance runners live under `tests/performance/`; retained result JSON lives under `evidence/performance/`.
- Preserve sparse/virtualized sheet behavior, bounded mounted cells, input latency, and bundle budgets.
- Do not replace measured baselines or certification evidence without recording environment, command, commit, and comparison.
- A checked-in report is evidence from its recorded run, not a timeless certification.

Current result JSON under `evidence/performance/` and visual assets under `images/` are retained evidence. Read only the artifact relevant to the metric being investigated.
