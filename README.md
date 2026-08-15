# Tactile

![Tactile - Fully local dimensional workspace](docs/tactile-banner.svg)

Tactile is a local workspace for arranging notes, data, and files on a grid.

Your workspace stays on your computer. No account or cloud storage is required.

![Tactile feature tour](docs/tactile-feature-tour.gif)

## Use it

- **Tiles** hold values, formulas, and links to other objects.
- **Text** holds Markdown.
- **Files** hold local images, PDFs, videos, and other files.
- Embedded objects can be opened and returned to without losing their place.

The workspace is stored as readable local files and can be exported as a ZIP bundle.

## Run locally

```bash
npm install
npm run dev
```

For the desktop shell:

```bash
npx tauri dev
```

## Shortcuts

| Action | Shortcut |
| --- | --- |
| Move between cells | Arrow keys |
| Edit a cell | `Enter` or `F2` |
| Open an embedded object | `]` |
| Return to the parent | `[` |
| Open the Edit menu | `Ctrl ]` |
| Clear selected cells | `Delete` |

## Workspace files

Tactile keeps the local copy inspectable. Sheets, Markdown, assets, themes, and workspace metadata are stored separately. The portable format is documented in [`docs/FILE_FORMAT.md`](docs/FILE_FORMAT.md).

Settings includes a versioned **Workspace authoring prompt** for asking an LLM to create a workspace, for example:

> Make me a workspace to manage my budgets.

## Download

Installers for Windows, macOS, and Linux are available on the [Releases](https://github.com/aryanxxvii/tactile/releases) page.

## License

[MIT](LICENSE)
