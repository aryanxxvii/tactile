# Contributing to Tactile

Tactile is a local-first workspace. The canonical user copy is a portable, inspectable set of files; network access is optional and the core product does not require an account or cloud storage.

This guide describes the repository workflow. It does not grant release, legal, security, signing, or product ownership. Those owners must be named before a public release.

## Working agreements

- Keep changes small and reviewable. Put application behavior in `src/`, native behavior in `src-tauri/`, and handoff or supply-chain material in the documented scope for that area.
- Do not hide durable data in browser-only state. Portable JSON, CSV, Markdown, and native asset files must remain inspectable and recoverable.
- Preserve unknown fields when reading and writing portable data. Do not silently discard plugin or future-version data.
- Use the existing object registry and persistence ports when adding object types or storage adapters. Do not duplicate navigation, import/export, or command behavior in a renderer.
- Keep A1 sheet addressing and embedded-object links stable. A link has an object ID, link ID, relation, parent object, and source cell; repairs must be deterministic.
- Do not add a dependency without updating the appropriate lockfile, reviewing its license evidence, and regenerating `evidence/release/`.
- Do not claim that a dependency, release, security contact, license, signing key, or platform certification exists unless the repository or an owner provides evidence.

## Toolchain and checks

The root manifest pins Node `24.13.0` and npm `11.6.2`. Rust uses the stable channel with `rustfmt` and `clippy` in `rust-toolchain.toml`. Start from a clean install when dependency behavior matters:

```text
npm ci
npm run verify
```

The native shell has separate checks documented in `src-tauri/README.md`:

```text
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

Run the narrowest relevant checks while iterating, then run the full gate before handoff. A passing local check is evidence for that environment, not cross-platform certification.

## Branch and pull-request workflow

- `alpha` is the active integration branch. Create temporary `feature/*`, `fix/*`, or `refactor/*` branches from it and PR them back to `alpha`.
- `main` is protected production-ready history. Promote through an approved release PR from `alpha`; use a temporary `hotfix/*` branch from `main` only for urgent production corrections.
- Squash ordinary work PRs. Preserve a merge commit when promoting `alpha` to `main` or synchronizing a hotfix back to `alpha`.
- Delete temporary branches after merge. Never force-push `main` or `alpha`.
- Update `CHANGELOG.md` for user-facing behavior.

See [the developer release workflow](.agents/knowledge/development-workflow.md) for commands and [the release policy](.agents/knowledge/release-policy.md) for protection, tagging, and artifact rules.

## App version changes

`version.json` owns the complete app version. Do not directly edit the mirrored version fields in `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, or `src-tauri/Cargo.lock`.

```text
npm run git:install
npm run version:sync
npm run version:check
```

`npm run git:install` adds the repository-local `git build` release command for the current clone. Run `git build alpha` on `alpha` to select, commit, tag, and atomically push the next prerelease. Run `git build stable X.Y.Z` on `alpha`, merge the resulting release PR to `main`, then run `git build stable X.Y.Z --publish` on `main`.

Development and production npm/Tauri builds synchronize automatically. Direct Cargo builds and release workflows only validate and fail on drift; they do not repair committed files. Canonical alpha/RC versions retain their named SemVer identifiers; Windows CI derives a numeric-only MSI bundle version without changing committed metadata. Marketplace plugin versions remain independent. See [the release policy](.agents/knowledge/release-policy.md#versions-and-tags) for ownership rules and [the developer workflow](.agents/knowledge/development-workflow.md) for release commands.

## Marketplace plugins

Tiles and Text ship with Tactile. Optional cell-object types live under `marketplace/plugins/` and compile independently of the application. Read the scoped [`marketplace/AGENTS.md`](marketplace/AGENTS.md) first and [marketplace knowledge](.agents/knowledge/marketplace.md) only for host/catalog architecture.

For a plugin-only change, bump the package version and compile only that package:

```text
npm run marketplace:build -- tactile.image
node --test tests/marketplace-build.test.mjs tests/marketplace.test.mjs tests/plugins.test.mjs
```

Commit the package source and regenerated `marketplace/dist` artifacts. Do not require `npm run build` or a new Tactile release for an ordinary plugin release. A full application build is required only when changing the host SDK, loader, core app, or shared compiler infrastructure.

Marketplace owns Install, version-driven Update, and Delete. Settings > Plugins > Cell Objects owns Enable/Disable for installed and built-in types. A catalog version must be greater than the installed semantic version before Update is offered.

## Portable data and migrations

The current portable workspace format is v4. Sheets are sparse CSV surfaces, text remains Markdown, and binary resources retain native files. Read [portable format knowledge](.agents/knowledge/file-format.md) before changing serialized fields, link repair, object IDs, or migration behavior.

Before changing a format or migration:

1. Write or update an ADR in `.agents/decisions/`.
2. Back up a representative portable workspace and record its SHA-256 hash.
3. Add round-trip, unknown-field, malformed-input, and downgrade/upgrade expectations where applicable.
4. Verify that a failed migration leaves the source and its recoverable copy unchanged.
5. Regenerate the inventory if a dependency or native lockfile changes.

## Dependency and license review

The committed inventory is generated with:

```text
node scripts/release/generate-inventory.mjs
```

It reads `package-lock.json` and `src-tauri/Cargo.lock`, records their hashes, emits CycloneDX SBOMs, and summarizes license evidence. The generated data is an engineering snapshot. It is not a legal conclusion, a complete notice bundle, or a project license. A legal owner must review license texts and attribution requirements before distribution.

For dependency changes, record:

- why the dependency is needed and whether it is runtime, build, test, or native-only;
- the exact lockfile resolution and integrity/checksum evidence;
- security audit results and any accepted residual risk;
- license evidence, notice requirements, and the owner who accepted them;
- compatibility and rollback impact.

## Security and reporting

Read `SECURITY.md` and `.agents/knowledge/security.md` before handling untrusted portable files or native assets. Do not place secrets, user workspaces, or private report contents in tests or public issues.

No security contact is evidenced by the repository at this time. The maintainer must configure a private reporting path before promising confidential disclosure handling. Non-sensitive defects can use the repository's normal issue/review process once that process is configured.

## Review and release ownership

`CODEOWNERS` is intentionally unpopulated because no owner identities are evidenced in this repository. Protected branch rules and review requirements are therefore owner prerequisites, not an assumed control. Release tags, version alignment, gates, signing, artifact publication, and legal approval are described in `.agents/knowledge/release-policy.md` and remain open until named owners complete them. Read that policy before creating, deleting, or moving a release tag.
