# Wave 1 G1 results

Run date: 2026-08-12
Integrated packet commits: `2efe2f4`, `4dfddbb`, `6e71e52`, `039d4cb`
Final integration commit: this commit

## Gate result

G1 passes. The typed contracts, sheet-grid seam, shell seam, and object-type registry are integrated without a portable-format rewrite or a Paper visual redesign.

| Check                         | Result                                  |
| ----------------------------- | --------------------------------------- |
| `npm run format:check`        | Pass                                    |
| `npm run lint`                | Pass; 0 errors and 18 existing warnings |
| `npm run typecheck`           | Pass                                    |
| Unit and compatibility suite  | 35/35 pass                              |
| Object registry suite         | 3/3 pass                                |
| Component suite               | Pass with no component tests present    |
| Reversed drag-selection E2E   | 1/1 pass                                |
| Production build              | Pass; Sites artifacts prepared          |
| Sites worker suite            | 4/4 pass                                |
| Deterministic browser fixture | Pass; all 250,000-cell invariants valid |
| Visual capture set            | 9 states captured and reviewed          |

## Browser and visual evidence

The final fixture run captured the sheet, origin, floating, full, nested floating/full, closing, nested closing, and returned states. The stable sheet and returned captures match the Wave 0 baseline exactly. Transition captures were reviewed as semantic states because their JPEG pixels depend on the capture moment; the child surface remains visible during reverse contraction, and no blank paper rectangle or source echo replaces it.

The live Paper preview still shows the compact grid, custom formatting strip, active-cell outline, sticky headers, object path, and 256 x 64 metadata. The browser document title follows the active object through the nested fixture.

## Benchmark delta

The final deterministic browser pass ran on the same 12-logical-CPU, approximately 16 GB host used for the Wave 0 diagnostic baseline. These are diagnostic deltas, not release certification:

| Scenario          | Wave 0 p95 frame (ms) | Wave 1 p95 frame (ms) |  Delta |
| ----------------- | --------------------: | --------------------: | -----: |
| Scroll            |                 200.1 |                 150.0 | -25.0% |
| Typing            |                 283.2 |                 216.6 | -23.5% |
| In & Out          |                 166.7 |                 149.9 | -10.1% |
| Nested navigation |                 300.1 |                 216.7 | -27.8% |

Mounted cells remain at 390/570/780/1935 for fixture import, scroll, In & Out, and nested navigation respectively. The initial JavaScript bundle is 148.5 KB gzip after the registry seam; the future 110 KB gzip budget remains explicitly assigned to Wave 3 code-splitting work.

## Contract freeze

The shared `src/core/**` contracts are frozen for Wave 2. Wave 2 may implement the engine and selector behavior behind these seams, but it must preserve the command, patch, transaction, persistence, object, and transient-state boundaries established in Wave 1.
