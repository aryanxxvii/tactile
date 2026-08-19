# Release policy

## Branches

- `alpha`: protected active integration; routine PR target.
- `main`: protected production-ready history; accepts approved release PRs from `alpha` and urgent `hotfix/*` PRs.
- `feature/*`, `fix/*`, `refactor/*`: temporary branches from `alpha`.
- `hotfix/*`: temporary branches from `main`; merge the fix back into `alpha`.

Block force-push/deletion on both long-lived branches. Delete temporary branches after merge.

## Versions and tags

`version.json` is the only manually edited app version. Synchronize npm, Tauri, and Cargo mirrors with `npm run version:sync`.

| Tag                  | Source  | Publication                       |
| -------------------- | ------- | --------------------------------- |
| `vX.Y.Z-alpha.N`     | `alpha` | Blue-branded GitHub prerelease    |
| `vX.Y.Z-rc.N`        | `alpha` | Release-branded GitHub prerelease |
| `vX.Y.Z`             | `main`  | Stable draft release for approval |
| `tactile.name@X.Y.Z` | `main`  | One-plugin draft release          |

Tags and published versions are immutable. CI validates source branch, tag, and manifests before building.

## Artifacts

Official artifacts come only from clean tagged CI builds with locked dependencies, expected-artifact checks, SHA-256 checksums, updater signatures, and platform signing where configured. Stable builds alone update stable updater metadata.

Do not commit app build outputs, installers, coverage, or test output. `marketplace/dist` remains the deliberate generated exception while production serves that catalog from `main`.

Stable publication also requires compatibility/migration review, native smoke evidence, dependency/license inventory, changelog, signing status, and rollback target.
