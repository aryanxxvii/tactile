# Wave 1 B03 results

Run date: 2026-08-12
Packet commit: `6e71e52`

## Result

B03 is complete. App composition now delegates shell concerns to focused modules while preserving the existing navigation, browser-history, and In & Out behavior.

## Deliverables

- `src/shell/inOut.js` owns the navigation stack, history URL/state synchronization, layer lifecycle, timing, outside-click close, and exact source-cell return.
- `src/shell/selectionCommands.js` owns selection, keyboard, clipboard, image paste, and sheet command routing.
- `src/shell/workspaceCommands.js` owns workspace import/export, embedded-object creation, file replacement, and theme commands.
- `src/shell/useShellState.js` owns settings, notices, export state, and import focus state.
- `src/shell/ObjectSurface.jsx` defines the object rendering boundary.
- `src/App.jsx` is the composition entry point.

## Acceptance

- Targeted B03 lint: pass.
- TypeScript check: pass.
- Unit tests: 35/35 pass.
- Reversed drag-selection browser regression: pass.
- Production build and Sites packaging: pass.
- Browser smoke: app mounts and renders the expected sheet surface.
- Deterministic browser fixture exercised single-layer, nested, floating, full, closing, returned, and document-title states.

No manual step is required for B03. No product visual or durable behavior decision changed.
