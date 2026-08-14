# Production performance certification

Captured 2026-08-14 against the production preview at `http://127.0.0.1:5187/` with the deterministic 250,000-cell fixture, Playwright Chromium, a 1440 × 900 viewport, and one browser pass on the current Windows x64 host. The machine-readable report is [`browser-results.json`](./browser-results.json). This is a strict diagnostic certification run, not a pass on the pinned four-core reference machine.

## Result

Certification: **FAIL**. The harness completed all five scenarios and returned exit code `1` because release timing, repeated-long-task, listener-leak, and full-client JavaScript bundle checks exceeded their unchanged budgets. Memory measurement was observable and stable for this pass, so it was not a blocker.

Fixture validation passed with fingerprint `8131f38127645b677ad39c84e2296bcafdb2d0fd4490ebc0737e69d5a8db46a4` (100 objects, 6 sheets, 250,000 used cells, 25,000 formulas, 25 conditional-format rules, maximum embedded depth 5, 256,000 Markdown bytes, and 104,857,600 represented asset bytes).

## Scenario measurements

| Scenario          | p95 frame time | Frame budget | p95 input-to-paint | Input budget | Long tasks over 50 ms | Commits | Max mounted cells | Result |
| ----------------- | -------------: | -----------: | -----------------: | -----------: | --------------------: | ------: | ----------------: | ------ |
| Scroll            |        83.3 ms |      16.7 ms |                n/a |          n/a |                    19 |      10 |             1,025 | Fail   |
| Typing            |       266.6 ms |      16.7 ms |           3,736 ms |        50 ms |                     4 |       9 |               476 | Fail   |
| In & Out          |       333.3 ms |      16.7 ms |             384 ms |        50 ms |                     8 |      15 |               918 | Fail   |
| Nested navigation |       250.0 ms |      16.7 ms |           602.1 ms |        50 ms |                    43 |      69 |             1,008 | Fail   |

Scroll and typing returned clean runtime deltas. In & Out retained `+146` listeners. Nested navigation retained `+871` listeners, `+1` resize observer, and `+4` animation frames against the post-fixture reference. After the final return-to-base cleanup, teardown still retained `+866` listeners. The strict runtime-resource budget is zero positive delta.

## Bundle and memory measurements

The production build completed successfully and produced the required Sites artifacts. The entry chunks remain within the existing build gate (`index` JavaScript: 61,523 gzip bytes; `index` CSS: 18,331 gzip bytes). The performance report also measures all client output, which is the scope used for this certification artifact: JavaScript is 718,962 raw / **221,015 gzip** bytes against the unchanged **112,640-byte** budget (**fail**), and CSS is 112,663 raw / **18,331 gzip** bytes against the **18,432-byte** budget (**pass**).

`performance.memory` was observable. The post-fixture reference and final teardown both reported 10,000,000 used heap bytes, for a measured delta of `0` bytes. No byte threshold is substituted for the runtime leak budget; memory evidence remains recorded separately from listener/observer/timer/animation-frame cleanup.

## Reproduction and limitations

```text
npm run build
node --test tests/performance/*.test.mjs
npm run bench:perf -- --base-url http://127.0.0.1:5187 --no-screenshots --strict --output docs/performance/browser-results.json
```

The run used one pass on a 12-logical-CPU host rather than three repetitions on the pinned reference machine. The browser harness does not claim a median or cross-run p95 from this packet; repeat externally for that comparison after the current blockers are addressed. A strict result of `2` is reserved for an unavailable or unmeasurable certification prerequisite.
