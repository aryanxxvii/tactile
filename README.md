<p align="center">
	<img src="images/tactile-banner.svg" alt="Tactile" width="960" />
</p>

<p align="center">
	<strong>A local-first spatial workspace for notes, data, and files.</strong><br />
	Arrange ideas in Tiles, open objects in place, and keep your work in formats you own.
</p>

<p align="center">
	<a href="https://github.com/aryanxxvii/tactile/releases">Downloads</a> ·
	<a href="CONTRIBUTING.md">Contributing</a> ·
	<a href="SECURITY.md">Security</a> ·
	<a href="LICENSE">MIT License</a>
</p>

## A workspace that stays yours

Tactile combines the immediacy of a spreadsheet with the depth of a document workspace. A Tile can hold a value, a formula, or a doorway into another object. Open it, work at full size, then return to the exact place you started.

- **Local first:** no account or cloud service is required for the core experience.
- **Portable by design:** workspaces use inspectable JSON, CSV, Markdown, and native media files.
- **Spatial and nested:** organize sheets, documents, and files without flattening their identity.
- **Made for real work:** formulas, ranges, formatting, themes, keyboard navigation, search, and undo are built in.
- **Extensible without bloating the app:** optional Code, PDF, Image, Audio, Video, HTML, and SVG objects are independently compiled marketplace packages.
- **Web and desktop:** run in a browser during development or use the Tauri shell on Windows, macOS, and Linux.

<p align="center">
	<img src="images/tactile-feature-tour.gif" alt="A tour of the Tactile workspace" width="900" />
</p>

## What you can build

Use Tiles as a lightweight model, tracker, dashboard, notebook, or navigation surface. Keep long-form thinking in Text objects, attach local media, run source snippets through the Code plugin, and move through nested work without losing context.

Tactile stores source rather than rendered output. Text remains Markdown, sheets remain sparse CSV-oriented data, and optional plugin state remains portable even when the plugin is unavailable.

## Get Tactile

Signed-where-configured installers and checksums for Windows, macOS, and Linux are published on the [GitHub Releases](https://github.com/aryanxxvii/tactile/releases) page.

- Stable versions use standard `vX.Y.Z` releases.
- Development previews use clearly marked `vX.Y.Z-alpha.N` or `vX.Y.Z-rc.N` prereleases and blue branding.

## Developer setup

### Prerequisites

- [Git](https://git-scm.com/)
- Node.js **24.13.0** and npm **11.6.2** (`.nvmrc` and `package.json` are authoritative)
- A modern browser
- For desktop development: the stable Rust toolchain and the [Tauri 2 system prerequisites](https://v2.tauri.app/start/prerequisites/)

### Clone and run the web app

```bash
git clone https://github.com/aryanxxvii/tactile.git
cd tactile
npm ci
npm run dev
```

Vite serves the app at `http://localhost:5173` by default. The development command also compiles and watches the local marketplace catalog.

### Run the desktop app

Windows PowerShell:

```powershell
pwsh -File src-tauri/scripts/dev.ps1
```

macOS or Linux:

```bash
sh src-tauri/scripts/dev.sh
```

Native build and platform notes live in [`src-tauri/README.md`](src-tauri/README.md).

### Validate a change

Start narrow while iterating, then run the relevant broader checks:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

The full repository gate is:

```bash
npm run verify
```

Native changes should additionally run:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

## Repository map

```text
src/             React application, object model, shell, and browser platform
src-tauri/       Tauri/Rust shell, native persistence, packaging, and platform tests
marketplace/     Independently compiled optional object packages and generated catalog
tests/           Unit, compatibility, browser, native, visual, and performance tests
scripts/         Build, marketplace, release, checksum, and inventory automation
config/          Tool configuration that does not require root-level discovery
.agents/         Vendor-neutral project routing, domain knowledge, and decisions
images/          Repository artwork and visual documentation
evidence/        Performance results, SBOMs, and third-party inventory snapshots
```

Development work targets the protected `alpha` integration branch. Production-ready changes are promoted to protected `main` through a release pull request. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a PR; coding agents should begin with [`AGENTS.md`](AGENTS.md).

## License

Tactile is available under the [MIT License](LICENSE).
