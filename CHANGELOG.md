# Changelog

## 0.1.3 — 2026-08-15

macOS packaging correction: clean runners use ad-hoc signing when Developer ID credentials are absent, so the DMG can be built and clearly labeled without pretending to be notarized.

## 0.1.2 — 2026-08-15

Release workflow correction: clean macOS runners now produce an explicitly unsigned DMG when Apple signing credentials are not configured, while retaining the signed/notarized path when the release owner supplies them.

## 0.1.1 — 2026-08-15

Packaging correction for the first public release. Native icon assets are now explicitly included in source checkouts, allowing the Windows, macOS, and Linux release jobs to build from the same tag.

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
