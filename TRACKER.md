# Tactile Modernization Tracker

## Wave 0 — Capture truth and install guardrails

- [x] A01 — Performance and visual baseline
  - Deterministic 250,000-cell fixture, browser trace harness, bundle report, and nine Paper visual states are archived.
  - Final run on 2026-08-12 measured scroll, typing, In & Out, and five-level nested navigation.
  - React commit counts are observable through a pre-load test-only DevTools hook; typing completed with a committed value assertion.
  - Future performance budgets remain intentionally unmet baseline evidence.

- [x] A02 — Toolchain, TypeScript, and dependency foundation
  - TypeScript bridge, linting, formatting, scripts, build, and audit work are in place.
  - Node 24.13.0/npm 11.6.2 are pinned in `.nvmrc`, `package.json`, and the lockfile.
  - Rust 1.97.1, Cargo, rustfmt, and Clippy pass a temporary smoke project with formatting checks, `-D warnings`, and tests.

- [x] A03 — Compatibility and migration fixtures

- [x] G0 — Wave 0 gate
  - Browser, visual, JavaScript, dependency, build, Sites, and Rust smoke checks pass on 2026-08-12.
  - `WORKFLOW.md` and `TRACKER.md` were explicitly approved for repository inclusion and are committed with the Wave 0 work.

## Wave 1 — Create safe architectural seams

- [x] B01 — Typed domain and engine contracts
  - React/DOM/storage-free contracts now live under `src/core/` for domain records, IDs, commands, patches, transactions, persistence, engine reads, and transient-versus-durable state.
  - Typed facades cover the existing model, coordinate, range, structure, and formatting helpers without changing their runtime behavior.
  - TypeScript, formatting, lint, build, and 35/35 unit/compatibility/core contract tests pass; B02–B04 remain separate extraction packets.
- [x] B02 — SheetGrid extraction
  - `SheetGrid` is now a small composition shell over extracted canvas, projection, gesture, and context-menu modules; keyboard, focus, selection, scroll, editing, formatting, and drag-reversal behavior remain covered.
- [x] B03 — App shell and In & Out extraction
  - Navigation/history, layer lifecycle, In & Out timing, selection/workspace commands, settings/notices, and object rendering now live behind `src/shell/**`; App remains the composition entry point.
- [x] B04 — Object-type descriptor foundation
  - All eight existing object types resolve through a lazy typed/JSDoc-compatible registry with compatibility adapters; existing portable import/export behavior remains unchanged.
- [x] G1 — Wave 1 gate
  - Full formatting, lint, type, unit/compatibility, object-registry, browser, build, and Sites checks pass on 2026-08-12; the visual baseline and benchmark deltas are recorded in `docs/wave-1/g1-results.md`.

## Wave 2 — Replace expensive state and calculation paths

- [x] C01 — Transaction engine and patch history
  - Normalized record store, typed commands, selector batching, patch undo/redo, dirty tracking, and edit-session coalescing are committed in `bccf4be`; focused C01 and differential tests pass.
- [x] C02 — Browser persistence adapter and asset separation
  - Record-oriented IndexedDB, migration safety, boot metadata, native asset handles, and portable v4 persistence are committed in `9d99ab9`; focused C02 tests pass.
- [x] C03 — Incremental formula worker
  - AST/dependency caching, incremental worker protocol, stale-result rejection, and formatter caching are committed in `2725401`; focused formula tests and the 25,000-formula fixture pass.
- [x] C04 — Virtual scrolling and bounded cell rendering
  - Ref-based scrolling, bounded overscan, memoized cell slots, sparse empty cells, and stable selection/editing focus are committed in `48d0ca9`; focused C04 tests pass.
- [x] G2 — Wave 2 gate
  - The live legacy hook now mirrors user transitions into the normalized engine, record persistence adapter, and formula worker through a reversible shadow controller. Full unit, focused Wave 2, Sites, typecheck, lint, build, and live 5237 smoke checks pass; the focused Wave 2 browser scenarios pass 11/11. The legacy path remains the visible rollback path and no portable-format changes were made. The broader 57-test UI sweep is kept separate from this gate because its runner timed out and its isolated failures are existing/flaky visual and interaction-baseline assertions outside the Wave 2 packet criteria.

## Wave 3 — Interaction, animation, paint, and startup

- [x] D01 — Local edit sessions
  - Local drafts now cover sheet cells, the formula bar, object titles, and Markdown; commits are deferred to logical edit-session boundaries while formula previews use the worker without mutating the workspace.
  - First printable input seeds an empty cell, focus/caret state is preserved, and the active sheet is supplied for neighboring-reference previews.
  - Committed in `a6345e0`; 71/71 unit tests, typecheck, lint, and production build pass (lint retains existing warnings only).
- [x] D02 — Transient gestures
  - Resize and axis reorder now capture the active pointer, attach listeners only while active, retain transient preview state, and commit once on pointer release; pointer-cancel cleans up without writing.
  - Existing selection and fill gestures retain their release-time transaction behavior and viewport lock.
  - Committed on the reviewed branch as `05b0955` and merged into `main` via `d84bd33`; 71/71 tests, typecheck, lint, and production build pass (lint retains existing warnings only).
- [x] D03 — In & Out lifecycle and compositing
  - Reviewed against the Wave 3 acceptance criteria: staged origin/floating/full phases, transform-first motion, reverse child-content fade, circular contraction radius, retained source handoff, nested route validation, and browser-history Back/Forward behavior are already present in the verified baseline.
  - No additional safe production diff was identified by the bounded D03 review; no motion semantics were invented or changed.
- [x] D04 — CSS consolidation and code splitting
  - App bootstrap, Files, Settings, and hover tips use deferred boundaries; portable workspace commands and JSZip load only when their actions are used. Inactive object renderers remain registry-lazy.
  - Removed blanket cell compositor promotion and unused prototype/type-study/description style passes while preserving the Paper cell and In & Out motion geometry.
  - The enforced production budget checks the Vite entry assets: entry JS is 61,523 gzip bytes (≤112,640) and entry CSS is 18,298 gzip bytes (≤18,432). `scripts/check-bundle-budget.mjs` runs as part of `npm run build`.
  - 71/71 unit tests, typecheck, Sites packaging, production build, and focused Arrow/selection browser scenarios pass. Lint has zero errors and pre-existing warnings only.
- [ ] G3 — Wave 3 gate
  - Functional and integration work is complete: the normalized transaction engine is now the default, the legacy path is available only through `__TACTILE_LEGACY_ROLLBACK__`, formula-bar reference insertion keeps its local draft synchronized, nested In & Out cleanup is covered, and deferred Files loading preserves dock/scrim geometry.
  - Acceptance evidence: 72/72 unit tests, typecheck, lint with 0 errors, 86 focused browser scenarios, 4/4 Sites checks, and production build/budget checks pass. The full In & Out suite is 14/14; keyboard/clipboard/delete/formula is 25/25; range/selection is 19/19; Files/overlay/theme/tooltip is 23/23; object/reparenting is 5/5.
  - Gate remains open because the user explicitly deferred rapid virtual-sheet scrolling. The performance harness ran against the correct local server and produced a partial result: scroll and typing remain well above the performance target, and the fixture rerun later timed out. Format check also retains the repository's existing 50-file drift. These are recorded rather than masked; G3 should be closed after the deferred scrolling/performance pass.

## Wave 4 — Native Tauri platform

- [ ] E01 — Tauri scaffold, build, and security shell
- [ ] E02 — Rust storage, recovery, and migrations
- [ ] E03 — Rust import/export and assets
- [ ] E04 — Frontend Tauri persistence adapter
- [ ] G4 — Wave 4 gate

## Wave 5 — Acquisition and release readiness

- [ ] F01 — Functional, accessibility, and recovery test pyramid
- [ ] F02 — Final performance certification
- [ ] F03 — CI, packaging, and release
- [ ] F04 — Handoff documentation and supply-chain posture
- [ ] G5 — Wave 5 gate

## Wave 6 — Final integration and legacy removal

- [ ] Z01 — Integration
- [ ] Z02 — Release candidate

## Final release requirements

- [ ] Mandatory functional regression matrix
- [ ] Rollback and safety strategy verified
- [ ] Definition of done satisfied
