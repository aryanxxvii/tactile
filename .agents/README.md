# Tactile agent guidance system

This directory is the canonical vendor-neutral knowledge/routing layer. `AGENTS.md` is the small universal entrypoint; vendor files are adapters only.

## Progressive loading

| Level | Load | Stop condition |
| --- | --- | --- |
| 0 | Root `AGENTS.md` | Always |
| 1 | `routing.md` | Task has workflow + owner |
| 2 | One workflow and one primary domain | Constraints/validation are known |
| 3 | Nearest local `AGENTS.md` | Only when editing that subtree |
| 4 | Owning source, callers, nearest tests | Controlling behavior is identified |
| 5 | Relevant knowledge/ADR | Only for durable boundary/rationale needs |

Do not pre-load referenced files. Cross-domain tasks add one domain at a time after a concrete dependency is found.

## Content boundaries

- `workflows/`: how an agent executes a class of task.
- `domains/`: ownership and invariants for code boundaries.
- `knowledge/`: durable concepts/policy that source alone cannot explain.
- `decisions/`: why accepted architectural choices exist.
- Local `AGENTS.md`: subtree-only constraints.
- Human entrypoints (`README.md`, `CONTRIBUTING.md`, `SECURITY.md`): concise user/contributor information and links to canonical knowledge.

Source/tests define current implementation behavior. Knowledge explains concepts and contracts; update it when implementation intentionally changes them.

## Discovery compatibility

| Agent | Native discovery | Canonical entrypoint behavior |
| --- | --- | --- |
| GitHub Copilot | Root/nested `AGENTS.md`; `.github/copilot-instructions.md` | Thin Copilot adapter points to canonical files |
| OpenCode | Root/local `AGENTS.md` | Uses canonical entrypoint directly |
| Claude Code | `CLAUDE.md` | Thin `CLAUDE.md` imports root `AGENTS.md` |
| OpenAI Codex | Hierarchical `AGENTS.md` | Uses canonical entrypoint/local files directly |
| Generic agent | No assumption | Operator should explicitly provide root `AGENTS.md` |

Vendor behavior can change. Adapters must not duplicate domain policy.

## Maintenance

Add guidance only for repeated repository-specific mistakes, non-obvious cross-file invariants, meaningful subtree differences, or a new routing owner. Prefer updating an existing file.

Remove guidance that restates source, duplicates another canonical file, references deleted ownership, or is always loaded with another file. Review guidance in normal PRs with the affected implementation.

When adding a domain or workflow:

1. Add one concise file.
2. Add one row to `routing.md`.
3. Add a local `AGENTS.md` only if subtree rules differ.
4. Update thin vendor adapters only when discovery requires it.
5. Validate links, formatting, and the commands named by the guidance.