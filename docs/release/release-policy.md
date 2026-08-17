# Release policy

Tactile has two tag-triggered release workflows. Workflows react to tags and build the referenced commit; they do not create tags or detect version changes. They validate tag and manifest versions before building.

## Build categories and tags

The native app workflow accepts two tag forms:

- `alpha@<version>` creates an alpha app build;
- `release@<version>` creates an official release candidate.

Both tags run the same Windows, macOS, and Linux build, signing, validation, checksum, updater-manifest, artifact-upload, and draft GitHub Release steps. Release builds retain the standard Tactile icon; alpha builds use the same mark in blue so installed builds are visually distinguishable. Staged installer names include `alpha` or `release`; macOS names also retain their `ad-hoc`, `signed-unnotarized`, or `signed-notarized` status. The tag category communicates release intent but does not weaken any build gate.

The marketplace plugin workflow accepts `tactile.<name>@<version>`, where `tactile.<name>` exactly matches the plugin manifest's `packageId`. It builds only that package, verifies the generated marketplace output is committed, and creates a draft GitHub Release containing that plugin's bundle, manifest, and checksums.

The former `v*` native release tag form is retired. Tags outside these patterns do not trigger release builds.

## Tag operation rules

Git permits multiple tags on one commit. An accepted promotion flow is to tag a commit as `alpha@<version>`, review its build, and then tag the same commit as `release@<version>`. Each tag triggers a separate workflow run and draft GitHub Release; the alpha build receives the blue icon and `alpha` artifact label, while the release build retains the standard icon and receives the `release` artifact label.

The version after `@` must match the version declared by the tagged commit:

- app tags must match `version.json` and every generated package version field;
- plugin tags must match the selected plugin's `manifest.json` version.

The workflows enforce this equality before installing dependencies or building. A mismatched app tag, stale generated app manifest, mismatched plugin tag, or incompatible plugin major version fails its release workflow.

Tags do not require empty commits. Create them directly on the committed version change:

```text
git tag "alpha@1.1.0"
git push origin "alpha@1.1.0"
git tag "release@1.1.0"
git push origin "release@1.1.0"
```

To correct or rerun an unpublished tag, delete it locally and remotely, fix or select the intended commit, then recreate and push it. Published release tags are immutable; correcting one requires a new version.

```text
git tag -d "alpha@1.1.0"
git push origin ":refs/tags/alpha@1.1.0"
git tag "alpha@1.1.0" <commit>
git push origin "alpha@1.1.0"
```

## Required release inputs

Every release candidate must identify:

- a source commit and clean-worktree record;
- the matching app or plugin version manifest and intended platform matrix;
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

The native Windows/macOS/Ubuntu smoke matrix must run before claiming native release readiness. The current Wave 4 evidence records the SQLite/WAL service as implemented, while cross-platform smoke and full Tauri persistence integration remain open. The app release workflow packages all three target families, but packaging is not the same as signed, notarized, or fully smoke-tested native support.

## Supply-chain and license posture

`package-lock.json` and `src-tauri/Cargo.lock` are the resolution sources. The generator emits:

- `sbom-npm.cdx.json`, from npm's package-lock-only CycloneDX output;
- `sbom-cargo.cdx.json`, from locked Cargo metadata plus Cargo.lock checksums;
- `third-party-inventory.json` and `.md`, which map exact components to license evidence and direct/development/native scope.

The inventory intentionally distinguishes evidence from legal approval. The repository now includes the project MIT license, but it does not yet constitute a complete third-party notice bundle. No public/commercial release may rely on the generated IDs alone; an owner/legal reviewer must inspect the actual license texts, attribution requirements, copyleft obligations, asset fonts, and native distribution terms.

Security advisories must be triaged per dependency and lockfile. A clean `npm audit` result is a snapshot, not a guarantee. Native advisory scanning, source review, and any OS/WebView/FFI obligations must be added to the release record when the native product is shipped.

## Artifact integrity and signing

The inventory records lockfile SHA-256 hashes and uses deterministic SBOM serial numbers derived from those hashes. This establishes input identity for the inventory; it does not sign the application or prove build provenance. Signing credentials, key custody, trusted build environment, attestations, and verification instructions are not evidenced and must be supplied by the release owner before publication.

## Versioning and rollback

The root `version.json` is the single source of truth for the complete Tactile app. Each marketplace plugin keeps its independent version in `marketplace/plugins/<name>/manifest.json`.

After changing the app version in `version.json`, run `npm run version:sync`. This updates `package.json`, the root package-lock entries, Tauri configuration, Cargo manifest, and the root Cargo lock entry. Do not edit those mirrored version fields directly. `npm run version:check`, the repository verification command, and app release workflows reject stale mirrors or a mismatched release tag.

Assign a version only after compatibility and migration behavior are reviewed. Commit each synchronized app or plugin version change before creating its matching tag, then push that tag so the corresponding workflow builds the same commit. Release workflows enforce tag and manifest alignment before building.

A release that changes the portable format must include an ADR, migration fixture, backup/restore test, and explicit handling of newer/older versions. Rollback means restoring the prior signed application and a known-good portable workspace; never require a user to discard the only local copy.

## Owner/legal checklist

- [ ] Named engineering/release owner.
- [ ] Supported platforms and versions declared.
- [ ] Private security intake and response policy configured.
- [ ] SQLite/WAL storage is integrated through the native persistence path and cross-platform smoke evidence is complete.
- [x] Project license selected and added: MIT (`LICENSE`).
- [ ] Third-party license texts and notices collected.
- [ ] SBOMs regenerated from the candidate lockfiles and reviewed.
- [ ] Signing/provenance system configured and verification instructions published.
- [ ] Changelog, recovery plan, and rollback target approved.
