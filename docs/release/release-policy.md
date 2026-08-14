# Release policy

Tactile `v0.1.2` is the first public packaged release candidate, following the `v0.1.0` source tag and the `v0.1.1` native-icon correction. The repository also contains a tag-triggered packaging workflow for Windows MSI, macOS DMG, and Linux AppImage/DEB artifacts. This policy does not declare a project license, signing identity, notarization status, or a supported-platform promise beyond the artifacts and evidence attached to a specific release.

## Required release inputs

Every release candidate must identify:

- a source commit and clean-worktree record;
- web/native version alignment and the intended platform matrix;
- portable format compatibility statement and migration notes;
- build/test logs for the relevant runtime and native targets;
- normalized npm and Cargo SBOMs tied to the committed lockfile hashes;
- dependency audit results and accepted exceptions;
- project license, third-party license texts, attribution notices, and legal approval;
- signed artifacts and public verification instructions, once an owner chooses the signing system;
- a changelog entry and a rollback/recovery plan.

## Engineering gates

Run the repository checks appropriate to the candidate:

```text
npm ci
npm run verify
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
npm audit --audit-level=high
node docs/release/generate-inventory.mjs
```

The native Windows/macOS/Ubuntu smoke matrix must run before claiming native release readiness. The current Wave 4 evidence records the SQLite/WAL service as implemented, while cross-platform smoke and full Tauri persistence integration remain open. The `v0.1.0` release workflow packages all three target families, but packaging is not the same as signed, notarized, or fully smoke-tested native support.

## Supply-chain and license posture

`package-lock.json` and `src-tauri/Cargo.lock` are the resolution sources. The generator emits:

- `sbom-npm.cdx.json`, from npm's package-lock-only CycloneDX output;
- `sbom-cargo.cdx.json`, from locked Cargo metadata plus Cargo.lock checksums;
- `third-party-inventory.json` and `.md`, which map exact components to license evidence and direct/development/native scope.

The inventory intentionally distinguishes evidence from legal approval. The repository does not evidence a project license or complete third-party notice bundle. No public/commercial release may rely on the generated IDs alone; an owner/legal reviewer must inspect the actual license texts, attribution requirements, copyleft obligations, asset fonts, and native distribution terms.

Security advisories must be triaged per dependency and lockfile. A clean `npm audit` result is a snapshot, not a guarantee. Native advisory scanning, source review, and any OS/WebView/FFI obligations must be added to the release record when the native product is shipped.

## Artifact integrity and signing

The inventory records lockfile SHA-256 hashes and uses deterministic SBOM serial numbers derived from those hashes. This establishes input identity for the inventory; it does not sign the application or prove build provenance. Signing credentials, key custody, trusted build environment, attestations, and verification instructions are not evidenced and must be supplied by the release owner before publication.

## Versioning and rollback

Assign a version only after compatibility and migration behavior are reviewed. A release that changes the portable format must include an ADR, migration fixture, backup/restore test, and explicit handling of newer/older versions. Rollback means restoring the prior signed application and a known-good portable workspace; never require a user to discard the only local copy.

## Owner/legal checklist

- [ ] Named engineering/release owner.
- [ ] Supported platforms and versions declared.
- [ ] Private security intake and response policy configured.
- [ ] SQLite/WAL storage is integrated through the native persistence path and cross-platform smoke evidence is complete.
- [ ] Project license selected and added by the legal owner.
- [ ] Third-party license texts and notices collected.
- [ ] SBOMs regenerated from the candidate lockfiles and reviewed.
- [ ] Signing/provenance system configured and verification instructions published.
- [ ] Changelog, recovery plan, and rollback target approved.
