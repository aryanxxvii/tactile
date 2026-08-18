# Release workflow

Use for branches, CI, versions, tags, packaging, checksums, signing, and publication.

Read `domains/release.md`, then only the workflow/script involved.

- `alpha` is integration; `main` is protected production history.
- App prereleases use immutable `vX.Y.Z-alpha.N` or `vX.Y.Z-rc.N` tags from `alpha`.
- Stable app tags use immutable `vX.Y.Z` tags from `main`.
- Plugin tags use immutable `tactile.name@X.Y.Z` tags from `main`.
- Official artifacts come from CI; never overwrite an existing release.
- Keep version policy, workflow behavior, changelog, and operator commands consistent.

Validate scripts with temporary fixtures before invoking expensive cross-platform packaging.
