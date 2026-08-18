---
description: "Use when changing Tactile branches, CI, app/plugin versions, release tags, packaging, signing, checksums, changelogs, or release documentation."
applyTo: ".github/workflows/**,scripts/release/**,docs/release/**,version.json,package.json,package-lock.json,src-tauri/Cargo.toml,src-tauri/Cargo.lock,src-tauri/tauri.conf.json,marketplace/plugins/**/manifest.json,CHANGELOG.md"
---

# Release changes

Use [the release specialist](../agents/release.agent.md) and load only its task-specific files.

- `alpha` is integration; `main` is production and changes through approved PRs.
- Never mutate published tags/releases or hand-edit generated app version mirrors.
- Official artifacts come from CI; marketplace artifacts follow their scoped `AGENTS.md`.
- Keep policy, developer instructions, and workflow behavior consistent in the same change.
