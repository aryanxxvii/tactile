# Tactile agent router

Load only the smallest relevant specialist and canonical docs. Do not scan all documentation by default.

| Task                                                     | Specialist                             | Canonical docs                                                           |
| -------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------ |
| App architecture, object model, persistence, portability | `.github/agents/architecture.agent.md` | `docs/ARCHITECTURE.md`, `docs/FILE_FORMAT.md`                            |
| Tests, regressions, performance, QA                      | `.github/agents/quality.agent.md`      | `CONTRIBUTING.md`, `docs/qa/`, `docs/performance/`                       |
| Native Tauri/Rust/platform integration                   | `.github/agents/native.agent.md`       | `src-tauri/README.md`, `docs/security/`                                  |
| Marketplace plugin work                                  | `.github/agents/marketplace.agent.md`  | `marketplace/AGENTS.md`, `docs/marketplace.md`                           |
| Branches, CI, versions, tags, packaging, release docs    | `.github/agents/release.agent.md`      | `docs/release/release-policy.md`, `docs/release/development-workflow.md` |

Project-wide rules:

- Routine work branches from `alpha`; `main` is production-only.
- Preserve unrelated worktree changes and keep edits scoped.
- Prefer existing architecture and focused tests over new abstractions.
- Read a linked document only when the current task needs that detail.
- Run the narrowest relevant validation after the first edit and broader checks before handoff.
