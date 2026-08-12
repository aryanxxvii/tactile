# Wave 1 B01 results

Run date: 2026-08-12  
Branch: `codex/tactile-wave-0-modernization`

## Result

B01 is complete. The first safe architectural seam is in place without changing the React UI, portable format, browser persistence, or Sites worker surface.

## Deliverables

- `src/core/domain.ts` defines the durable workspace, object, sheet, cell, asset, theme, range, and window types.
- `src/core/ids.ts` defines branded workspace, object, cell, asset, theme, command, patch, revision, timestamp, address, and axis-index types.
- `src/core/commands.ts` defines the shared workspace command union for cell, range, object, axis, embedded-object, asset, formatting, and theme actions.
- `src/core/patches.ts` defines reversible record-level patch operations, dirty records, and transaction results.
- `src/core/engine.ts` defines the `WorkspaceEngine` read/subscribe/dispatch/undo/redo contract.
- `src/core/persistence.ts` defines the storage-port boundary for browser and future Tauri implementations without importing either runtime.
- `src/core/state.ts` makes durable workspace state explicit and keeps selection, layers, editing, gestures, menus, and notices transient.
- `src/core/model.ts`, `coordinates.ts`, `ranges.ts`, `structure.ts`, and `formatting.ts` provide typed facades over the existing pure helpers.

## Acceptance

| Check                                                | Result                                                           |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| TypeScript bridge                                    | Pass - `npm run typecheck`                                       |
| Pure and compatibility tests                         | Pass - 35/35 - `npm run test:unit`                               |
| Formatting                                           | Pass - `npm run format:check`                                    |
| Lint                                                 | Pass with the existing 17 warnings and 0 errors - `npm run lint` |
| Production build and Sites preparation               | Pass - `npm run build`                                           |
| React, DOM, Tauri, and storage imports in `src/core` | None                                                             |

The new core contract test exercises blank-workspace normalization, A1 coordinates, range normalization, paste changes, formula axis adjustment, and number formatting. No existing pure helper behavior was rewritten.

## Boundary note

B01 defines the contract; it does not replace `useLocalWorkspace` yet. The normalized external engine and patch history implementation are Wave 2 C01 work. B02, B03, and B04 can now consume these contracts independently.
