# Tactile

![Tactile — Fully local dimensional workspace](docs/tactile-banner.png)

Tactile is a local-first workspace built around a simple idea: a sheet is a map, and a cell can open another object.

No cloud layer. No mandatory account. The workspace stays on disk.

## The short version

- **Tiles** are compact A1 sheets for values, formulas, ranges, and layout.
- **Text** is Markdown stored as its own object.
- **Files** are local assets with inspectable references.
- **In & Out** keeps nested work attached to the cell that opened it.
- **Portable v4** keeps the workspace readable, movable, and versioned.

![Tactile feature tour](docs/tactile-feature-tour.gif)

Click an embedded object once to float it. Double-click to open it fully. Press `]` to enter and `[` to return.

## The model

The app is a graph laid over a spreadsheet.

```text
workspace
├── Home — a Tiles sheet and the default map
├── Tiles — another sheet, embedded or opened directly
├── Text — Markdown content stored separately
└── File — an image, PDF, video, HTML, SVG, or local asset
```

Objects have stable IDs. A cell stores a value or a reference. A reference can point to the same object from more than one place. Parent links retain the route back to the source cell. Cycles are rejected.

![Tactile workspace model](docs/tactile-architecture.svg)

The portable link form is deliberately plain:

```text
[[tactile:<type>:<object-id>|<title>]]
```

Ordinary cells remain sparse sheet data. Text stays Markdown. Binary content stays in an asset record. The file is the source of truth.

## Run it

Requires Node.js and, for the native shell, Rust.

```bash
npm install
npm run dev
```

The browser development server is the fastest way to inspect the product. The native shell lives under `src-tauri` and can be started with:

```bash
npx tauri dev
```

## A few controls

| Action | Input |
| --- | --- |
| Move through a sheet | Arrow keys |
| Edit the active tile | `Enter` or `F2` |
| Enter an embedded object | `]` |
| Return to the parent | `[` |
| Open the edit menu | `Ctrl ]` |
| Clear selected cells | `Delete` |
| Copy and paste | `Ctrl C` / `Ctrl V` |

## Local files

Tactile keeps a workspace inspectable instead of hiding it behind an opaque database.

```text
workspace.json
objects/<object-id>/content.md
objects/<sheet-id>/sheet.csv
assets/<asset-id>/<file>
themes/<theme-id>.json
```

The exact package layout is documented in [`docs/FILE_FORMAT.md`](docs/FILE_FORMAT.md). Export produces a ZIP bundle. The v4 compatibility rules are documented in [`docs/compatibility/README.md`](docs/compatibility/README.md).

## Settings can explain the model to another LLM

Open **Settings → Files & ownership → Workspace authoring prompt** to copy a versioned prompt that describes the object graph, sparse sheets, Markdown, assets, links, themes, Home/Start metadata, and the strict v4 authoring payload. It is intended for requests such as:

> Make me a workspace to manage my budgets.

The result should be a plan, a machine-readable workspace payload, and a validation report.

## Project shape

```text
src/       browser application and workspace model
src-tauri/ native shell and filesystem bridge
docs/      format, architecture, security, QA, and release notes
tests/     unit, compatibility, component, and end-to-end tests
```

The architecture notes are in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Product constraints and durable decisions live in [`AGENTS.md`](AGENTS.md). The current delivery tracker is [`TRACKER.md`](TRACKER.md).

## Checks

```bash
npm run typecheck
npm run lint
npm run test:unit
npx vite build
```

Tactile is still being built. The direction is stable: local files, familiar coordinates, quiet surfaces, and enough structure to grow without hiding the data.
