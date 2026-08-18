# Release build reproducibility

Tactile release artifacts are traceable to an immutable source tag. This document does not claim byte-for-byte reproducibility across hosted runners until that property is measured.

## Required inputs

- Immutable app or plugin tag and its commit SHA.
- Node `24.13.0`, npm `11.6.2`, and committed `package-lock.json`.
- Rust toolchain from `rust-toolchain.toml` and committed `src-tauri/Cargo.lock`.
- Pinned Tauri CLI invocation used by the workflow.
- Repository signing credentials supplied only by the CI environment.

Release jobs use a clean checkout and `npm ci`. They validate tag/manifests before building and do not repair committed version drift.

## Build and inventory checks

```text
npm ci
npm run verify
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
node docs/release/generate-inventory.mjs
```

The release workflow packages Windows MSI, macOS DMG/updater archive, and Linux AppImage/DEB artifacts. It validates expected coverage, creates SHA-256 checksums, and requires updater signatures. Stable builds also create `latest.json`; prereleases do not replace stable updater metadata.

## Evidence to retain

- Tag, source commit, workflow run URL, runner OS, and tool versions.
- npm/Cargo lockfile hashes and generated SBOM/inventory files.
- Artifact names, sizes, SHA-256 checksums, updater signatures, and platform-signing status.
- Test/smoke output, release approval, changelog, and rollback target.

## Assurance levels

**Required:** clean tagged checkout, locked dependencies, manifest equality, CI-built artifacts, checksums, and immutable publication.

**Recommended:** signed annotated tags, Windows code signing, Apple notarization, retained SBOMs, and provenance attestations.

**Future:** pin Rust to an exact release instead of `stable`, pin third-party actions by commit SHA, issue SLSA provenance, and measure bit-for-bit rebuilds.
