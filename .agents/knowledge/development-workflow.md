# Development and release commands

## Routine work

```bash
git switch alpha
git pull --ff-only origin alpha
git switch -c feature/short-description
```

Push and PR the temporary branch to `alpha`; squash-merge and delete it.

## App prerelease

Set `version.json` to a unique prerelease such as `1.5.0-alpha.1`, then:

```bash
npm run version:sync
npm run version:check
git add version.json package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "build(release): prepare 1.5.0-alpha.1"
git push origin alpha
git tag -a v1.5.0-alpha.1 -m "Tactile 1.5.0 alpha 1"
git push origin v1.5.0-alpha.1
```

Use a new number for every changed build.

## Stable promotion

Set the stable version on `alpha`, synchronize, update changelog/evidence, and PR `alpha` to `main`. After merge:

```bash
git switch main
git pull --ff-only origin main
git tag -a v1.5.0 -m "Tactile 1.5.0"
git push origin v1.5.0
```

Review CI's draft release, then merge `main` back into `alpha`.

## Plugin release

Build/test the bumped package, commit source plus `marketplace/dist`, promote to `main`, then create `tactile.name@X.Y.Z` on that main commit.
