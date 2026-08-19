# Release policy

## Branches

- `alpha`: protected active integration; routine PR target.
- `main`: protected production-ready history; accepts approved release PRs from `alpha` and urgent `hotfix/*` PRs.
- `feature/*`, `fix/*`, `refactor/*`: temporary branches from `alpha`.
- `hotfix/*`: temporary branches from `main`; merge the fix back into `alpha`.

Block force-push/deletion on both long-lived branches. Delete temporary branches after merge.

## Versions and tags

`version.json` is the app version authority. Use the repository-local `git build` command for app releases; it updates
`version.json`, synchronizes npm, Tauri, and Cargo mirrors, validates, commits, and publishes only from the required
branch. Manual repair uses `npm run version:sync`.

| Tag                  | Source  | Publication                       |
| -------------------- | ------- | --------------------------------- |
| `vX.Y.Z-alpha.N`     | `alpha` | Blue-branded GitHub prerelease    |
| `vX.Y.Z-rc.N`        | `alpha` | Release-branded GitHub prerelease |
| `vX.Y.Z`             | `main`  | Stable draft release for approval |
| `tactile.name@X.Y.Z` | `main`  | One-plugin draft release          |

Tags and published versions are immutable. CI validates source branch, tag, and manifests before building.

Canonical prerelease versions use `X.Y.Z-alpha.N` or `X.Y.Z-rc.N`, with `N` in `1..9999`. WiX/MSI cannot encode
named prerelease identifiers, so Windows CI projects alpha builds to `X.Y.Z-(10000 + N)` and RC builds to
`X.Y.Z-(20000 + N)` at bundle time. This platform projection is not committed and does not replace the canonical
version or release tag.

RC means release candidate: a prerelease believed ready for stable publication and used for final validation. It is
still opt-in and must not be offered to stable installations.

## Artifacts

Official artifacts come only from clean tagged CI builds with locked dependencies, expected-artifact checks, SHA-256 checksums, updater signatures, and platform signing where configured.

## App updater channels

The desktop updater checks GitHub Release metadata, not branches or repository commits. Users select one of two
machine-local channels in Settings:

- Stable checks `/releases/latest/download/latest.json`. GitHub resolves this only after a stable draft is published
  and does not select releases marked as prereleases.
- Nightly checks `/releases/download/nightly/latest.json` and includes both alpha and RC versions. The `nightly`
  release is a mutable channel pointer; versioned prerelease releases and their installer assets remain immutable.
- `.github/workflows/release.yml` generates `latest.json` for every app tag with immutable, tag-specific artifact URLs.
  A serialized promotion job replaces the nightly pointer only when the candidate alpha or RC is newer.
- `src-tauri/tauri.conf.json` owns the embedded public key and updater-artifact generation flag. Runtime code overrides
  its default endpoint with the selected channel endpoint.
- `scripts/release/create-updater-manifest.mjs` owns platform download URLs and signatures in `latest.json`.
- `scripts/release/promote-updater-channel.mjs` owns monotonic nightly promotion decisions.
- `src-tauri/src/lib.rs` owns runtime checking, download, signature verification through the Tauri updater plugin,
  installation, and restart. `src-tauri/src/updater.rs` owns channel persistence, endpoints, and candidate filtering.
  `src/platform/tauri/updater.js` and `src/components/SettingsPanel.jsx` expose the manual Settings flow; there is no
  startup or background poll.

Stable accepts only newer stable versions. Nightly accepts only newer alpha or RC versions. Switching channels never
permits an automatic downgrade; a nightly build ahead of the latest stable waits until a newer stable is published.

Do not commit app build outputs, installers, coverage, or test output. `marketplace/dist` remains the deliberate generated exception while production serves that catalog from `main`.

Stable publication also requires compatibility/migration review, native smoke evidence, dependency/license inventory, changelog, signing status, and rollback target.
