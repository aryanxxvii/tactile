# Changelog

Notable user-facing changes are recorded here. Tactile follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Changed

- Adopted protected `alpha` integration and `main` production branches.
- Adopted immutable SemVer prerelease and stable release tags.
- Separated alpha branding and prerelease publication from stable releases.

### Fixed

- Release workflows now reject version drift, invalid source branches, and attempts to overwrite published versions.
