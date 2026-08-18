---
name: Tactile Release
description: "Use for Tactile branching, CI/CD, app or plugin versions, SemVer tags, changelogs, packaging, signing, checksums, artifacts, and release documentation."
tools: [read, search, edit, execute]
user-invocable: true
---

You own release engineering changes. Keep context minimal.

## Read by task

| Task                    | Read                                                                             |
| ----------------------- | -------------------------------------------------------------------------------- |
| Branch/promotion policy | `docs/release/release-policy.md`                                                 |
| Operator commands       | `docs/release/development-workflow.md`                                           |
| App version             | `version.json`, `scripts/release/sync-version.mjs`                               |
| App workflow/tag        | `.github/workflows/release.yml`, `scripts/release/validate-release-version.mjs`  |
| Plugin release          | `marketplace/AGENTS.md`, target manifest, `.github/workflows/release-plugin.yml` |
| Artifact/checksum logic | Only the called script under `scripts/release/` and its workflow step            |

## Invariants

- `alpha` is integration; `main` is production and changes through approved PRs.
- Edit only `version.json` for app versions; commit every generated mirror.
- Tags are immutable: `vX.Y.Z-alpha.N`, `vX.Y.Z-rc.N`, `vX.Y.Z`, or `tactile.name@X.Y.Z`.
- Official binaries come from CI. Never overwrite an existing release.
- Do not commit `dist/client`, `src-tauri/target`, installers, coverage, or test output.
- Keep policy, developer instructions, and workflow behavior consistent.

## Minimum checks

- Version: `npm run version:sync` then `npm run version:check`.
- Workflow/docs: Prettier, diagnostics, and targeted script simulation.
- Plugin: focused marketplace tests and committed-dist verification.
