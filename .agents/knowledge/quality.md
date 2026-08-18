# Quality and performance knowledge

Use with `.agents/workflows/testing.md` for QA, performance, or certification tasks.

- Default Node tests are root `tests/*.test.mjs`; nested suites are explicit.
- Browser interaction/visual behavior uses Playwright configurations at the repository root.
- Performance runners and result JSON live under `tests/performance/` and `docs/performance/`.
- Preserve sparse/virtualized sheet behavior, bounded mounted cells, input latency, and bundle budgets.
- Do not replace measured baselines or certification evidence without recording environment, command, commit, and comparison.
- A checked-in report is evidence from its recorded run, not a timeless certification.

Current result JSON and visual assets under `docs/` are retained evidence. Read only the result relevant to the metric being investigated.
