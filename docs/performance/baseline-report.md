# Tactile Wave 0 performance and visual baseline

Captured 2026-08-12 against the unmodified Paper product on Windows x64. The host reports Node `v24.13.0`, 12 logical CPUs, and approximately 16 GB of memory; it is not the pinned four-core certification machine.

## Fixed fixture

[`benchmarks/generate-fixture.mjs`](../../benchmarks/generate-fixture.mjs) produces a deterministic v4 workspace with fingerprint `8131f38127645b677ad39c84e2296bcafdb2d0fd4490ebc0737e69d5a8db46a4`:

- 100 objects and 6 sheets.
- 250,000 used cells, including a 100,000-cell root sheet.
- 25,000 formulas spanning chains, fan-out, ranges, lookups, and conditional aggregates.
- 25 conditional-format rules, mixed geometry, groups, filters, formatted ranges, and five nested embedded layers.
- 256,000 bytes of Markdown and 104,857,600 bytes of deterministic asset metadata across 10 assets.

The default fixture keeps binary payloads as manifest-backed placeholders; `--materialize-assets` streams deterministic 10 MiB files when a disk workload needs them.

## Browser baseline

The Playwright runner is checked in under [`tests/performance/run-browser.mjs`](../../tests/performance/run-browser.mjs). The current measured output is [`browser-results.json`](./browser-results.json). It captured the fixed fixture at 1440 x 900 with Playwright Chromium.

| Scenario          | p95 frame time | Max long task | Input p95 | React commits | Mounted cells | Result                                |
| ----------------- | -------------: | ------------: | --------: | ------------: | ------------: | ------------------------------------- |
| Scroll            |       200.1 ms |      1,801 ms |         - |            54 |           570 | Over future budget; baseline evidence |
| Typing            |       283.2 ms |      2,509 ms |  2,536 ms |             7 |           390 | Action completed; budget unmet        |
| In & Out          |       166.7 ms |      2,509 ms |  2,536 ms |            14 |           780 | Over future budget; baseline evidence |
| Nested navigation |       300.1 ms |      2,509 ms |  2,528 ms |            52 |         1,935 | Over future budget; baseline evidence |

The import-and-render scenario is recorded as a measured 9-commit run; its input sample is not applicable because it is driven by a file import. The test-only pre-load instrumentation now installs a minimal React DevTools hook, so commit counts are observable without changing production code. The final run observed 41 long tasks during scroll, 49 during typing, 61 during In & Out, and 159 during nested navigation. `performance.memory` reported approximately 159 MB used heap. The typing action completed and asserted the committed cell value; it no longer times out.

These measurements are diagnostic starting values, not release certification. The future targets remain p95 frame time <=16.7 ms, input-to-paint <=50 ms, and no repeated main-thread task over 50 ms.

## Bundle baseline

The current production build transforms 6,258 modules and emits approximately 471,710 raw / 140,125 gzip JavaScript bytes and 81,918 raw / 14,505 gzip CSS bytes. JavaScript is above the future 110 KiB gzip budget; CSS is within the 18 KiB budget.

The verified clean-install build completed in approximately 32.1 seconds in this environment. It produced `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Visual states

JPEG baselines at 1440 x 900 are stored in [`tests/visual/baselines`](../../tests/visual/baselines) for the sheet, origin, floating, full, nested floating/full, closing, nested closing, and returned states. [`visual-results.json`](./visual-results.json) records the capture inventory. No UI code or durable visual decision changed in Wave 0.

## Reproduction

```text
npm test
npm run build
npm run test:sites
node --test tests/performance/*.test.mjs
npm run bench:perf -- --base-url http://127.0.0.1:5187 --screenshots tests/visual/baselines --output docs/performance/browser-results.json
```

Run the browser command three times on the pinned reference machine and aggregate median/p95 values before performance certification. The 10% comparator is [`tests/performance/compare-results.mjs`](../../tests/performance/compare-results.mjs).
