# Tactile

![Tactile - Fully local dimensional workspace](docs/tactile-banner.svg)

Tactile is a local workspace for arranging notes, data, and files on a grid.

Everything is fully local. Workspaces use common files such as CSV, Markdown, JSON, and native media files, so the contents can be viewed or edited separately when needed. No account or cloud storage is required.

Use the grid for the overview and place deeper work inside it. A budget workspace might have monthly totals in Tiles, a Markdown note for assumptions, and receipts as local files. Open any object directly from its cell, then return to that same place without losing your train of thought.

![Tactile feature tour](docs/tactile-feature-tour.gif)

- **Tiles** hold values, formulas, and links to other objects.
- **Text** holds Markdown.
- **Files** hold local images, PDFs, videos, and other files.
- Embedded objects can be opened and returned to without losing their place.

Sheets, Markdown, assets, themes, and workspace metadata are stored separately. The file layout is documented in [`docs/FILE_FORMAT.md`](docs/FILE_FORMAT.md). Workspaces can also be exported as ZIP files.

To run the browser version locally:

```bash
npm install
npm run dev
```

To run the desktop shell:

```bash
npx tauri dev
```

Useful shortcuts: arrow keys move between cells; `Enter` or `F2` edits a cell; `]` opens an embedded object; `[` returns to its parent; `Ctrl ]` opens the Edit menu; `Delete` clears selected cells.

The versioned **Workspace authoring prompt** in Settings can explain the workspace model to an LLM. For example: “Make me a workspace to manage my budgets.”

Installers for Windows, macOS, and Linux are available on the [Releases](https://github.com/aryanxxvii/tactile/releases) page.

[MIT License](LICENSE)
