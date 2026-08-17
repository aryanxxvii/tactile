# ADR-0001: Marketplace catalog authority

- Status: accepted
- Date: 2026-08-17
- Decision owner: Tactile maintainers
- Reviewers: Tactile maintainers
- Supersedes: none
- Superseded by: none

## Context

Marketplace packages are built independently and cached in IndexedDB after installation. During local development, the cache could retain an older bundle with the same semantic version, hiding current renderer CSS and Settings contributions even though `npm run dev` rebuilt `marketplace/dist`. Production also copied the local catalog into the client, making deployment authority ambiguous.

## Decision

Development and production use separate, deterministic catalog authorities:

- `npm run dev` builds and serves `/marketplace/` from local `marketplace/dist`, watches marketplace plugin and SDK source, rebuilds on changes, and reloads after success.
- Development activates installed plugins from fresh local catalog artifacts without persisting those artifacts over the installed production cache.
- Production removes any embedded marketplace directory and defaults to `https://raw.githubusercontent.com/aryanxxvii/tactile/main/marketplace/dist/catalog.json`.
- Production permits marketplace network access only to `raw.githubusercontent.com`. Fetched bundles and assets must pass catalog size and SHA-256 verification before JavaScript is imported from a host-created blob URL.
- A localStorage catalog override remains a production/browser diagnostic mechanism. Vite development ignores it so local preview cannot silently switch to remote artifacts.

## Alternatives considered

| Option                          | Benefits                                      | Costs and risks                                                        | Reason not selected                                            |
| ------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| Always restore IndexedDB        | Fast startup and offline behavior             | Same-version local changes remain invisible                            | Does not support reliable plugin development                   |
| Embed the catalog in production | Same-origin delivery and offline availability | Client and marketplace releases become coupled; authority is ambiguous | Conflicts with independent marketplace publication             |
| Auto-bump development versions  | Reuses update UI                              | Creates artifact churn and mutates release semantics                   | Development source authority should not alter package versions |

## Compatibility and migration

Installed records and portable workspaces do not change format. Development uses an ephemeral activation record and keeps install/enable state. Production continues to restore verified installed records when the hosted catalog is unavailable; install and update operations require the hosted catalog. Removing the production embedded directory reduces deployment output but does not alter workspace data.

## Security and privacy

GitHub Raw becomes a narrow production network trust dependency. Catalog entries and artifacts remain repository-controlled but are treated as untrusted bytes until size and SHA-256 verification succeeds. The CSP adds only the exact HTTPS origin and `blob:` script activation already required by the verified plugin loader. No workspace content is uploaded.

Residual risks are repository/account compromise, mutable branch content, availability of GitHub Raw, and incomplete native cross-platform smoke evidence. A future signed catalog or release-pinned URL can supersede this decision.

## Validation

- Unit tests assert local development and hosted production catalog selection.
- Marketplace tests verify artifact sizes, SHA-256 values, and absence of unresolved imports.
- Playwright verifies install/disable lifecycle and contributed Settings-tab visibility.
- Native scaffold tests compare the exact production `connect-src` directive and blob script policy.
- Production preparation checks that `dist/client/marketplace` is absent.

## Rollout and rollback

The change ships with the client. Roll back by restoring the same-origin catalog default, removing the GitHub Raw CSP source, and restoring production catalog copying. Roll back if hosted catalog CORS, CSP, integrity verification, or native activation fails in release smoke testing.

## Open prerequisites

- [x] Named engineering owner.
- [x] Named security reviewer where applicable.
- [ ] Cross-platform native hosted-marketplace smoke evidence.
- [ ] Signed or release-pinned catalog publication policy.
