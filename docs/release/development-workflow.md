# Development and release workflow

This is the operator manual for Tactile's `feature/*` to `alpha` to `main` flow.

## Start work

```bash
git switch alpha
git pull --ff-only origin alpha
git switch -c feature/short-description
```

Commit focused changes and push the temporary branch:

```bash
git add <files>
git commit -m "feat(area): describe the change"
git push -u origin feature/short-description
```

Open a PR to `alpha`, wait for required CI/review, squash-merge, and delete the temporary branch.

## Create an alpha package

An ordinary alpha push runs CI but does not publish installers. To distribute an alpha:

1. Set `version.json` to a new value such as `1.5.0-alpha.1`.
2. Synchronize, validate, commit, and push `alpha`.
3. Create and push an annotated tag.

```bash
npm run version:sync
npm run version:check
git add version.json package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "build(release): prepare 1.5.0-alpha.1"
git push origin alpha
git tag -a v1.5.0-alpha.1 -m "Tactile 1.5.0 alpha 1"
git push origin v1.5.0-alpha.1
```

The next distributed alpha is `alpha.2`; never move `alpha.1`.

## Create a release candidate

After feature freeze, prepare `1.5.0-rc.1` on `alpha` using the same synchronization/tag process. RC builds use release branding but remain GitHub prereleases. Fixes require `rc.2`, not a rebuilt `rc.1`.

## Promote a stable release

On `alpha`, change `version.json` to the stable version, synchronize mirrors, update `CHANGELOG.md`, and commit. Open a PR from `alpha` to `main`.

After approval and merge:

```bash
git switch main
git pull --ff-only origin main
npm run version:check
git tag -a v1.5.0 -m "Tactile 1.5.0"
git push origin v1.5.0
```

CI builds the tag and creates a draft GitHub Release. Review artifacts, checksums, signing status, generated notes, changelog, and smoke evidence before publishing.

Then synchronize production history back into development:

```bash
git switch alpha
git pull --ff-only origin alpha
git merge --no-ff origin/main
git push origin alpha
```

## Hotfix production

```bash
git switch main
git pull --ff-only origin main
git switch -c hotfix/v1.5.1
# Apply the fix; set version.json to 1.5.1; synchronize and test.
git commit -m "fix(area): describe the production correction"
git push -u origin hotfix/v1.5.1
```

PR the hotfix to `main`, merge, tag `v1.5.1`, then merge `main` into `alpha`. Delete the hotfix branch.

## Release one plugin

Develop plugin changes through `alpha`, bump only that plugin manifest, build it, and commit source plus `marketplace/dist`. Promote the change to `main` before tagging:

```bash
npm run marketplace:build -- tactile.code
node --test tests/marketplace-build.test.mjs tests/marketplace.test.mjs tests/plugins.test.mjs
git switch main
git pull --ff-only origin main
git tag -a tactile.code@1.1.0 -m "tactile.code 1.1.0"
git push origin tactile.code@1.1.0
```

Plugin versions are independent from the app patch/minor version, but their major version must match Tactile's major version.

## Recovery rules

- A failed unpublished workflow may be rerun from GitHub Actions.
- Do not move a tag to repair source or assets. Commit the correction and use a new version.
- Revert broken `alpha` integrations promptly.
- Never bypass `main` protection for a routine release.
