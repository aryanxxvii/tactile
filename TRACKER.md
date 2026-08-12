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

- [ ] B01 — Typed domain and engine contracts
- [ ] B02 — SheetGrid extraction
- [ ] B03 — App shell and In & Out extraction
- [ ] B04 — Object-type descriptor foundation
- [ ] G1 — Wave 1 gate

## Wave 2 — Replace expensive state and calculation paths

- [ ] C01 — Transaction engine and patch history
- [ ] C02 — Browser persistence adapter and asset separation
- [ ] C03 — Incremental formula worker
- [ ] C04 — Virtual scrolling and bounded cell rendering
- [ ] G2 — Wave 2 gate

## Wave 3 — Interaction, animation, paint, and startup

- [ ] D01 — Local edit sessions
- [ ] D02 — Transient gestures
- [ ] D03 — In & Out lifecycle and compositing
- [ ] D04 — CSS consolidation and code splitting
- [ ] G3 — Wave 3 gate

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
