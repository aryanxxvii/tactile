# Wave 3 gate evidence

Run date: 2026-08-13

## Functional acceptance

- 72/72 repository unit tests pass.
- TypeScript typecheck passes.
- ESLint reports 0 errors and 16 existing warnings.
- Focused browser acceptance passes: 86 scenarios across keyboard navigation, clipboard/image paste, delete/clear, formula editing, range selection, drag reversal, Files, overlays, themes, tooltips, Markdown, object headers, reparenting, and In & Out.
- In & Out lifecycle suite passes 14/14, including nested rendering, source handoff, reverse contraction, history, deep start restoration, breadcrumb jumps, and full-view chrome stability.
- Sites packaging passes 4/4.

## Engine and startup acceptance

- The normalized transaction engine reports `engine: transaction` and `mode: default` by default.
- The temporary legacy path is opt-in through `globalThis.__TACTILE_LEGACY_ROLLBACK__` and reports `engine: legacy-rollback` and `mode: rollback`.
- Imported workspaces are protected from boot-time persistence races.
- Deferred Files loading keeps the workspace lane and bottom-dock geometry present before the panel chunk resolves.
- Production build passes with entry JS at 61,523 gzip bytes and entry CSS at 18,313 gzip bytes, both within the enforced budgets.

## Gate status

G3 remains open, not because of a known functional regression, but because the rapid virtual-sheet scrolling/performance work was explicitly deferred by the user. The corrected performance harness ran against the local test server and captured the existing problem: scroll and typing measurements remain above target, and the large fixture rerun later timed out while re-entering the imported fixture. `npm run format:check` also retains the repository's existing 50-file formatting drift.

The next wave can proceed from this state, but G3 should be marked complete only after the deferred scrolling performance pass is accepted.
