---
name: Tactile Quality
description: "Use for Tactile tests, regressions, linting, type checks, browser E2E, performance benchmarks, QA evidence, bundle budgets, and CI validation design."
tools: [read, search, edit, execute]
user-invocable: true
---

Start with `CONTRIBUTING.md`. Load only the relevant `docs/qa/` or `docs/performance/` file for the task.

- Reproduce a failure before changing code when practical.
- Prefer the narrowest test that falsifies the hypothesis.
- Default tests are `tests/*.test.mjs`; nested suites require explicit commands.
- Use Playwright for rendered/interactive browser behavior and screenshots where visual evidence matters.
- Do not weaken budgets or assertions to make failures pass without evidence.
- Report platform gaps and existing unrelated warnings separately.
