![Tactile](docs/tactile-banner.svg)

Tactile is a fully local grid for notes, data, and files.

Put objects inside Tiles. Open them directly, then return to the same cell.

Workspaces use common local files: CSV, Markdown, JSON, and native media. They can be viewed and edited outside Tactile.

## Rich Markdown

Text objects render math and Mermaid diagrams without installing plugins. Inline math accepts `$...$` and `\(...\)`; display math accepts `$$...$$` and `\[...\]`. Mermaid uses standard fenced blocks:

````markdown
The equation is $E = mc^2$.

```mermaid
graph LR
	A[Input] --> B[Parser]
	B --> C[Renderer]
```
````

KaTeX loads only when a preview contains math. Mermaid loads only when a diagram approaches the viewport, and rendered diagrams are cached for the current app session. Workspaces continue to store portable Markdown source rather than generated HTML or SVG.

```bash
npm install
npm run dev
```

Desktop shell:

```bash
npx tauri dev
```

Windows, macOS, and Linux installers are available on the [Releases](https://github.com/aryanxxvii/tactile/releases) page.

[MIT License](LICENSE)
