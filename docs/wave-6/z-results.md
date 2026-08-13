# Wave 6 final integration evidence

Date: 2026-08-14

## Z01 integration audit

The repository is integrated on `main`, and the latest safe integration pass
stabilized document-level keyboard, clipboard, tooltip, and floating-layer
listeners without changing the Paper interaction model. The path navigator
has an opaque portaled Paper surface, and plain square brackets remain In & Out
shortcuts unless the formula editor is active.

Z01 is not complete. The production app still enters through
`src/hooks/useLocalWorkspace.js`, which exposes the legacy React snapshot hook
and the Wave 2 shadow controller. The opt-in
`__TACTILE_LEGACY_ROLLBACK__` flag and `src/core/engine/shadow.js` remain in
place for rollback coverage. There are currently 89 JavaScript/JSX source
files and 32 TypeScript/TSX source files under `src/`; removing the legacy
path and converting the remaining production surface requires a dedicated
engine-to-React integration pass, not a safe cleanup-only deletion.

## Z02 release-candidate audit

Z02 remains blocked by evidence rather than an unreported failure:

- The strict performance harness still exceeds frame, input, full-client
  JavaScript, and nested listener budgets. The latest run recorded scroll p95
  133.3 ms, typing p95 633.3 ms with 7,648 ms input p95, nested frame p95
  733.3 ms, and +867 listeners at the nested checkpoint.
- Numeric coverage thresholds are not measurable because no coverage reporter
  is configured.
- The full browser suite did not finish within the five-minute local limit.
- Cross-platform native packaging, WebView performance, signing, and smoke
  verification require Windows/macOS/Linux CI or the corresponding toolchains.
- `cargo audit` is unavailable locally; the npm audit is clean and the two
  package-license review items remain documented.

The release artifacts, SBOMs, checksums, compatibility fixtures, native WAL
recovery tests, and Sites handoff remain present and validated by their focused
checks. No unresolved requirement is marked complete by this audit.
