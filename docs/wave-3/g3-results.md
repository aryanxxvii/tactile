# Wave 3 gate evidence

Run date: 2026-08-13

## Current integration evidence (2026-08-14)

- `main` includes the reviewed fast-scroll handoff fix at `1e4763ff0f74`.
- Focused sheet scrolling and dock separator acceptance passes 12/12 after the integration.
- The strict browser harness was rerun against the local preview. It measured scroll frame p95 at 33.4 ms with 3 tasks over 50 ms; typing frame p95 at 533.3 ms with 6,728 ms input latency; In & Out and nested navigation remained above budget; and all-output client JavaScript measured 223,408 gzip bytes. Runtime scroll leaks were zero in this run, but the remaining performance checks still fail.
- These results improve the stale-slice behavior and provide first-frame coverage, but they do not close G3. The gate remains open until all release performance and functional criteria are measured within budget.

## Functional acceptance

- 72/72 repository unit tests pass.
- TypeScript typecheck passes.
- ESLint reports 0 errors and 16 existing warnings.
- Focused browser acceptance passes: 86 scenarios across keyboard navigation, clipboard/image paste, delete/clear, formula editing, range selection, drag reversal, Files, overlays, themes, tooltips, Markdown, object headers, reparenting, and In & Out.
- In & Out lifecycle suite passes 14/14, including nested rendering, source handoff, reverse contraction, history, deep start restoration, breadcrumb jumps, and full-view chrome stability.
- Sites packaging passes 4/4.

## Engine and startup acceptance

- The normalized transaction engine reports `engine: transaction` and `mode: default` by default.
- The temporary legacy rollback flag has been removed. The normalized transaction engine is the only runtime mode; the bridge remains only as the compatibility boundary while the UI snapshot is migrated.
- Imported workspaces are protected from boot-time persistence races.
- Deferred Files loading keeps the workspace lane and bottom-dock geometry present before the panel chunk resolves.
- Production build passes with entry JS at 61,523 gzip bytes and entry CSS at 18,313 gzip bytes, both within the enforced budgets.

## Gate status

G3 remains open, not because of a known functional regression, but because the rapid virtual-sheet scrolling/performance work was explicitly deferred by the user. The corrected performance harness ran against the local test server and captured the existing problem: the latest scroll p95 is 133.3 ms, typing p95 is 633.3 ms with 7,648 ms input p95, and nested In & Out remains above target with listener retention. `npm run format:check` also retains the repository's existing 50-file formatting drift.

The next wave can proceed from this state, but G3 should be marked complete only after the deferred scrolling performance pass is accepted.
