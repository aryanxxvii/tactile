# Release policy

This policy defines Tactile's two long-lived branches, version authority, immutable releases, and artifact ownership. Operational commands are in [development-workflow.md](development-workflow.md).

## Branch model

```mermaid
flowchart LR
  F[feature/* or fix/*] -->|PR| A[alpha]
  A -->|release PR| M[main]
  A -->|vX.Y.Z-alpha.N or vX.Y.Z-rc.N| P[Prerelease CI]
  M -->|vX.Y.Z| R[Stable release CI]
  M -->|tactile.name@X.Y.Z| G[Plugin release CI]
```

| Branch      | Responsibility                           | Changes enter through                                 | Required state                      |
| ----------- | ---------------------------------------- | ----------------------------------------------------- | ----------------------------------- |
| `main`      | Production-ready source                  | Release PR from `alpha`; urgent `hotfix/*` PR         | Every commit is potentially stable  |
| `alpha`     | Active development and integration       | PR from temporary work branches; release preparation  | Buildable with required CI passing  |
| `feature/*` | Temporary feature, fix, refactor or test | Created from and squash-merged back into `alpha`      | Focused enough to review and revert |
| `hotfix/*`  | Temporary urgent production correction   | Created from `main`; PR to `main`, then sync to alpha | Minimal production fix              |

Only `main` and `alpha` are long-lived. Block force-push and deletion on both. Delete temporary branches after merge.

## Protection rules

### `main`

- Require a pull request, one approval, resolved conversations, and all required CI checks.
- Block direct pushes, force-pushes, and deletion.
- Require the branch to be current before merge.
- Allow release PRs from `alpha` and urgent PRs from `hotfix/*`.
- Restrict stable and plugin tag creation to release maintainers.

### `alpha`

- Require CI for pull requests and block force-push/deletion.
- Use PRs for ordinary development; a maintainer may directly push only release preparation or immediate integration repair.
- Revert a breaking integration quickly. Incomplete features must be guarded, disabled, or reverted before promotion.

Branch protection and tag rules are repository-host settings; workflow files cannot enforce all of them.

## Semantic versions

Tactile follows Semantic Versioning:

- `MAJOR`: incompatible portable-format, plugin-host API, updater, or public contract change.
- `MINOR`: backward-compatible functionality.
- `PATCH`: backward-compatible bug fix.

Distributed development builds use unique prerelease versions:

```text
1.5.0-alpha.1
1.5.0-alpha.2
1.5.0-rc.1
1.5.0
```

Use `alpha.N` for tester builds and `rc.N` after feature scope is frozen. A beta stage is unnecessary unless the project later needs a distinct public-testing phase. Every published version is immutable; a changed build requires a new version.

## Version authority

The root `version.json` is the only app version edited manually. `npm run version:sync` generates matching versions in:

- `package.json` and the root entries in `package-lock.json`;
- `src-tauri/tauri.conf.json`;
- the Tactile package entries in `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock`.

Do not edit generated version fields directly. `npm run version:check`, application CI, Cargo's build script, and release validation reject drift.

Marketplace plugins own independent versions in `marketplace/plugins/<name>/manifest.json`. Plugin major versions must match Tactile's major version.

## Tags and channels

| Tag                  | Source branch | Result                                      |
| -------------------- | ------------- | ------------------------------------------- |
| `vX.Y.Z-alpha.N`     | `alpha`       | Blue-branded published GitHub prerelease    |
| `vX.Y.Z-rc.N`        | `alpha`       | Release-branded published GitHub prerelease |
| `vX.Y.Z`             | `main`        | Stable draft GitHub Release for approval    |
| `tactile.name@X.Y.Z` | `main`        | Draft release for one marketplace plugin    |

Use annotated tags. Never move, delete, or reuse a tag after artifacts are available. Release workflows verify the tag version, generated manifests, and required source branch before building.

## Promotion from alpha to main

The default release mechanism is a normal, clearly labelled release PR from `alpha` to `main`:

1. Stabilize `alpha`; disable or revert unfinished work.
2. Change `version.json` from the latest prerelease to the stable version and synchronize mirrors.
3. Update `CHANGELOG.md`, compatibility notes, inventory, and rollback information.
4. Open the release PR and run full CI/native gates.
5. Merge after release approval.
6. Create the matching stable tag on the resulting `main` commit.
7. Review and publish the draft release produced by CI.
8. Merge `main` back into `alpha`, then start the next prerelease version.

If `alpha` must advance during stabilization, create a temporary `release/vX.Y.Z` branch from the approved alpha commit. PR it to `main` and delete it afterward. This is an exception, not a third long-lived branch.

## Production hotfixes

Create `hotfix/vX.Y.Z` from the current stable `main`, make the smallest correction, bump the patch version, and PR it to `main`. Tag the merged main commit. Then merge `main` into `alpha` before closing the hotfix. Resolve conflicts in favor of preserving both the fix and ongoing development.

## CI and publication

| Event                     | Behavior                                                               |
| ------------------------- | ---------------------------------------------------------------------- |
| Feature/fix branch push   | Formatting, lint, typecheck, version check, unit tests                 |
| PR to `alpha` or `main`   | Full web/browser build plus native check/test                          |
| Push to `alpha`           | Full CI and a seven-day web artifact; no public app release            |
| App SemVer tag            | Clean cross-platform native package, validation, signatures, checksums |
| Stable app tag            | Adds updater manifest and creates a draft release                      |
| Prerelease app tag        | Creates a GitHub prerelease; stable updater metadata is not replaced   |
| Marketplace source change | Rebuilds catalog and rejects committed artifact drift                  |
| Marketplace plugin tag    | Builds and stages only the selected plugin                             |

CI validates branches. Tags authorize package publication. A branch push never silently creates an official release.

## Artifact policy

Commit source, tests, docs, workflows, lockfiles, configuration, and required branding/installer inputs. `marketplace/dist` remains committed because production currently serves that verified catalog from `main`.

Do not commit `dist/client`, `src-tauri/target`, installers, executables, coverage, test reports, caches, or CI packages. Store short-lived development builds as Actions artifacts and released installers in GitHub Releases.

Release artifacts include platform/architecture/version/channel in their names, SHA-256 checksums, and Tauri updater signatures. Windows code signing and Apple signing/notarization are applied when repository credentials are configured.

## Release gates

Before stable publication, retain evidence for:

- `npm ci`, `npm run verify`, and native format/check/test/clippy;
- Windows, macOS, and Linux packaging/smoke results;
- portable-format and plugin compatibility impact;
- dependency audits, regenerated SBOM/inventory, and license review;
- source commit, tag, checksums, signing status, changelog, and rollback target.

Packaging success is not proof of platform certification, legal approval, or signing identity. Release owners must explicitly approve those claims.

## Changelog and rollback

Update `CHANGELOG.md` in user-facing PRs and finalize it in the release PR. GitHub-generated notes supplement the changelog; they do not replace curated compatibility, migration, and recovery information.

Never repair a published release in place. Roll forward with a new SemVer version. Rollback restores the previous trusted application and a known-good portable workspace without discarding the user's only local copy.
