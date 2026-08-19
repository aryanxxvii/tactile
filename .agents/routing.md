# Context router

Select the smallest applicable workflow and primary domain. Add another domain only after finding a concrete cross-boundary dependency.

| Task                                                  | Workflow               | Primary domain           | Optional knowledge                            |
| ----------------------------------------------------- | ---------------------- | ------------------------ | --------------------------------------------- |
| Feature, bug fix, refactor                            | `workflows/change.md`  | Owning domain below      | Boundary knowledge only                       |
| Tests, regression, performance, CI validation         | `workflows/testing.md` | Owning code domain       | `knowledge/quality.md`                        |
| Branch, version, tag, packaging, release              | `workflows/release.md` | `domains/release.md`     | Release policy/build evidence                 |
| React shell, objects, navigation, browser persistence | `workflows/change.md`  | `domains/application.md` | Architecture/file format when needed          |
| Tauri, Rust, SQLite, native dialogs/CSP               | `workflows/change.md`  | `domains/native.md`      | Security knowledge for trust changes          |
| Plugin, SDK, host API, catalog, installation          | `workflows/change.md`  | `domains/marketplace.md` | Local `marketplace/AGENTS.md`                 |
| Portable format or migration                          | `workflows/change.md`  | `domains/application.md` | File format, compatibility, relevant decision |
| Architecture/security boundary                        | `workflows/change.md`  | Owning domain            | Decision index, then relevant ADR only        |

## Ambiguous tasks

1. Search the exact symbol, behavior, error, or filename.
2. Identify the code that computes or mutates the behavior, not just wiring.
3. Load that domain and nearest local instructions.
4. Inspect one caller/test boundary.
5. Broaden only if the owning boundary is still unresolved.

Never classify Tactile using generic backend/database categories: browser persistence belongs to application; SQLite and IPC belong to native; plugin APIs belong to marketplace.
