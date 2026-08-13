# Wave 3 D04 results

The production build now enforces the Wave 3 entry-asset budgets through
`scripts/check-bundle-budget.mjs`.

| Entry asset | Gzip result | Budget | Result |
| --- | ---: | ---: | --- |
| Vite entry JavaScript | 61,523 bytes | 112,640 bytes | Pass |
| Vite entry CSS | 18,298 bytes | 18,432 bytes | Pass |

The split build also emits independent chunks for Settings, Files, hover tips,
inactive object renderers, and JSZip. SpatialLayer remains eager because it is
part of the latency-sensitive In & Out transition; deferring it caused the
measured staged transition to exceed its acceptance window and was reverted.

Verification completed for D04:

- `npm test`: 71/71 passed.
- `npm run typecheck`: passed.
- `npm run lint`: 0 errors; existing warnings only.
- `npm run build`: passed, including the budget check and Sites artifacts.
- `npm run test:sites`: 4/4 passed.
- Focused Arrow/selection E2E scenarios: 16/16 passed.

The full E2E command exceeded its bounded runtime. The focused clipboard/delete
run passed 16/17; the remaining failure expects the retired inline `.cell-editor`
surface even though the current product routes editing through the formula bar.
