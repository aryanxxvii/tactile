# Wave 0 performance and visual baseline

Captured 2026-08-12 against the unmodified Paper product on Windows x64 with Node `v24.13.0`, 12 logical CPUs, and approximately 16 GB of system memory. The browser runner used Playwright Chromium at a 1440 x 900 viewport.

Machine-readable output: [`browser-results.json`](./browser-results.json). Visual captures: [`tests/visual/baselines`](../../tests/visual/baselines).

## Fixed fixture

The deterministic fixture generator in [`benchmarks/generate-fixture.mjs`](../../benchmarks/generate-fixture.mjs) produces the required 250,000 used cells with this fingerprint:

`8131f38127645b677ad39c84e2296bcafdb2d0fd4490ebc0737e69d5a8db46a4`

| Invariant                |                                                 Observed |
| ------------------------ | -------------------------------------------------------: |
| Objects                  |                                                      100 |
| Sheets                   |                                                        6 |
| Used cells               |                                                  250,000 |
| Root sheet used cells    |                                                  100,000 |
| Formulas                 |                                                   25,000 |
| Conditional-format rules |                                                       25 |
| Maximum embedded depth   |                                                        5 |
| Markdown                 |                                            256,000 bytes |
| Binary asset metadata    |                       104,857,600 bytes across 10 assets |
| Formula shapes           | chains, fan-out, ranges, lookups, conditional aggregates |

## Current measurements

These are diagnostic starting values, not a certification pass. The release budgets from the modernization brief are included for comparison.

| Scenario                     | p95 frame time | Max long task | Input p95 | React commits | Mounted cells | Result                                                      |
| ---------------------------- | -------------: | ------------: | --------: | ------------: | ------------: | ----------------------------------------------------------- |
| Scroll                       |       200.1 ms |      1,801 ms |         - |            54 |           570 | Fails current budget; optimization work required            |
| Typing                       |       283.2 ms |      2,509 ms |  2,536 ms |             7 |           390 | Action completed and committed; future budget remains unmet |
| In & Out                     |       166.7 ms |      2,509 ms |  2,536 ms |            14 |           780 | Fails current budget; optimization work required            |
| Five-level nested navigation |       300.1 ms |      2,509 ms |  2,528 ms |            52 |         1,935 | Fails current budget; optimization work required            |

The browser harness observed 41 long tasks during scroll, 49 during typing, 61 during In & Out, and 159 during nested navigation. React commit counts are observable through a test-only pre-load hook: 54 during scroll, 7 during typing, 14 during In & Out, and 52 during nested navigation. Memory was observable through `performance.memory`; the run reported approximately 159 MB used heap against a 3.76 GB limit.

The import-and-render scenario is recorded as a measured 9-commit run. Its input sample is not applicable because it is driven by a file import. The typing scenario completed without an action error and verified the edited cell value.

## Bundle baseline

The production build currently emits approximately 471.7 KB raw / 140.1 KB gzip JavaScript and 81.9 KB raw / 14.5 KB gzip CSS across the initial client chunks. This exceeds the future 110 KB JavaScript gzip budget while CSS is within the 18 KB target.

The verified clean-install build transformed 6,258 modules and completed in approximately 32.1 seconds in this environment. The inspected-machine reference in the brief recorded approximately 16 seconds.

## Visual baseline states

The baseline set captures the sheet, In & Out origin, floating, full, five-level nested floating/full, closing, and returned states. Captures use the existing Paper visual direction and are intended for regression comparison only; no visual changes were made in Wave 0.

## Reproduction

```text
npm test
npm run build
npm run test:sites
node --test tests/performance/*.test.mjs
npm run bench:perf -- --base-url http://127.0.0.1:5187 --screenshots tests/visual/baselines --output docs/performance/browser-results.json
```

For release certification, run the browser command three times on the pinned four-core/16 GB reference machine and aggregate median/p95 values. The current run intentionally records unmet budgets as baseline evidence; it does not gate Wave 0 on future performance targets.
