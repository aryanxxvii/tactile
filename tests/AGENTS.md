# Test subtree instructions

These rules apply under `tests/` in addition to root guidance.

- Read `.agents/workflows/testing.md` and the source owner before changing assertions.
- Root `npm test` covers only `tests/*.test.mjs`; nested suites are explicit.
- Match the test level to behavior: pure Node tests first, Playwright for rendered interaction, native tests for Rust/platform contracts, performance suites for budgets.
- Preserve failure evidence; do not weaken assertions, timeouts, or budgets without a documented behavior change.
- Keep generated reports, screenshots, and `test-results` out of commits unless they are intentional baselines/evidence.
