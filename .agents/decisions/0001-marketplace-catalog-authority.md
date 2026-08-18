# 0001: Marketplace catalog authority

- Status: accepted
- Date: 2026-08-17
- Owners: unassigned

## Context

Marketplace packages compile independently from the app. Development needs immediate local rebuilds, while production needs one auditable catalog origin and verified relative assets.

## Decision

Development serves/watches local `marketplace/dist` with no-store and activates matching local artifacts without replacing persistent installs. Production removes embedded catalog output and loads the committed `main` catalog from the approved GitHub Raw origin. Bundles/assets are accepted only after catalog size and SHA-256 verification.

## Consequences

- Plugin-only publication does not require an app build.
- Generated `marketplace/dist` remains committed while GitHub Raw is the production authority.
- Production CSP permits the exact catalog origin and host-created blob activation path.
- A CDN or external publisher model requires a superseding decision and security review.

## Validation and rollback

Marketplace build/runtime tests verify relative paths, hashes, local authority, remote loading, and cache behavior. Rollback restores a prior committed catalog/plugin version; published artifacts remain immutable.
