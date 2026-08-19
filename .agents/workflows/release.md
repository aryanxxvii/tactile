# Release workflow

Use for branches, CI, versions, tags, packaging, checksums, signing, and publication.

Read `domains/release.md`, then only the workflow/script involved.

- `alpha` is integration; `main` is protected production history.
- App prereleases use immutable `vX.Y.Z-alpha.N` or `vX.Y.Z-rc.N` tags from `alpha`.
- Stable app tags use immutable `vX.Y.Z` tags from `main`.
- Plugin tags use immutable `tactile.name@X.Y.Z` tags from `main`.
- Official artifacts come from CI; never overwrite an existing release.
- Keep version policy, workflow behavior, changelog, and operator commands consistent.
- Install the clone-local release alias with `npm run git:install`. Prepare prereleases with `git build alpha`,
  prepare stable versions with `git build stable X.Y.Z` on `alpha`, and publish stable tags with
  `git build stable X.Y.Z --publish` on `main` after promotion.
- Keep canonical alpha/RC SemVer in source and tags. Windows packaging alone projects it to the numeric-only MSI
  prerelease defined by release policy.

Validate scripts with temporary fixtures before invoking expensive cross-platform packaging.
