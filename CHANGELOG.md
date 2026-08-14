# Changelog

This file records user-visible and release-process changes. It does not declare a release until a release owner assigns a version and publishes the required artifacts.

## 0.1.0 — 2026-08-15

This is the first public source release of Tactile. It is a pre-release-quality product with an inspectable local workspace model.

### Included

- Local-first Tiles sheets with sparse A1 cells, formulas, formatting, ranges, and embedded objects.
- Markdown/Text objects, nested In & Out navigation, parent links, aliases, and cycle prevention.
- Native workspace folders, local persistence, ZIP export, themes, onboarding, and the Tactile authoring prompt in Settings.
- A compact Paper interface with a native shell under `src-tauri`.
- Compatibility, security, architecture, release, and contributor documentation.

### Release notes

- Portable workspace format remains v4.
- The tag-triggered release workflow packages Windows MSI, macOS DMG, and Linux AppImage/DEB artifacts. This source commit does not claim that those artifacts are signed, notarized, or covered by completed cross-platform smoke evidence.
- The project license, signing identity, and supported-platform matrix still require an explicit release-owner decision.

## Unreleased

### Documentation and handoff

- Added contributor, security, ownership, architecture, ADR, compatibility, backup/recovery, and release-policy guidance.
- Added deterministic npm and Cargo SBOM and third-party inventory artifacts derived from the committed lockfiles.
- Recorded current release prerequisites, including project licensing, third-party notices, private security intake, cross-platform native checks, and artifact signing.
