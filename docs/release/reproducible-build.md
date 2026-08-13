# Reproducible build and inventory handoff

This document records how to reproduce the repository's build inputs and supply-chain inventory. It intentionally avoids claiming byte-for-byte application reproducibility until a release owner measures and publishes that evidence.

## Pinned inputs

- Node: `24.13.0` from `.nvmrc` and the root engine declaration.
- npm: `11.6.2` from the root package manager declaration.
- Rust: stable channel with `rustfmt` and `clippy`, as declared by `rust-toolchain.toml`.
- JavaScript resolution: `package-lock.json`, lockfile version 3.
- Native resolution: `src-tauri/Cargo.lock`.

Use a clean checkout, the pinned toolchains, and `npm ci` for dependency installation. Do not regenerate a lockfile during a release candidate build.

## Build sequence

```text
npm ci
npm run verify
pwsh -File src-tauri/scripts/build.ps1
```

The native wrapper invokes the existing root build and native checks; platform-specific equivalents are documented in `src-tauri/README.md`. Keep build output out of the commit unless the release workflow explicitly requires an artifact.

## Inventory sequence

```text
node docs/release/generate-inventory.mjs
```

The generator:

1. hashes both committed lockfiles;
2. runs `npm sbom --package-lock-only --sbom-format cyclonedx --sbom-type application`;
3. runs `cargo metadata --format-version 1 --locked`;
4. normalizes component ordering and removes wall-clock timestamps;
5. derives deterministic SBOM serial numbers from the corresponding lockfile hash;
6. writes the npm SBOM, Cargo SBOM, and combined third-party inventory under `docs/release/`.

The npm SBOM's license IDs are registry metadata and Cargo license expressions are manifest metadata. Neither is a legal determination. Review the generated inventory against the actual distributed files and collect full notices before release.

## Verification record

For each candidate, retain the source commit, lockfile hashes, tool versions, command output, target platform, and owner sign-off. A future release workflow may automate this, but the repository currently does not evidence a trusted builder, attestation service, or signing key.
