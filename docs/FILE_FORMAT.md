# Tactile portable workspace format

Tactile workspaces are local-first folders or ZIP bundles. A `.tactile` file is a ZIP archive with a predictable, inspectable layout. Sheets are CSV files, text objects are Markdown files, and binary embeds keep their native formats.

## Goals

- A person or an LLM can inspect and edit the important content without running Tactile.
- A sheet is always ordinary CSV; the visible 256 × 64 canvas is a display default, not serialized empty data.
- Every embedded object has a stable ID and its own file.
- Links visibly describe what they open.
- Metadata that CSV cannot represent—formatting, groups, conditional rules, view state, and theme bindings—lives in small adjacent JSON files.

## Bundle layout

```text
workspace.tactile
├── manifest.json
├── workspace.json
├── objects/
│   ├── home/
│   │   ├── sheet.csv
│   │   └── sheet.meta.json
│   ├── startup-thoughts/
│   │   ├── sheet.csv
│   │   └── sheet.meta.json
│   ├── note-a1/
│   │   └── content.md
│   └── research-pdf/
│       └── source.pdf
├── assets/
│   └── image-or-video files
└── themes/
    └── custom-theme.json
```

`manifest.json` identifies the format and entry files. `workspace.json` contains the object index, the home object ID, parent links, and file paths. Content remains in the object files rather than being duplicated into the index.

## Embedded-cell link syntax

An embedded cell stores a readable token in CSV:

```text
[[tactile:sheet:startup-thoughts|Startup thoughts]]
[[tactile:markdown:note-a1|Meeting note]]
[[tactile:pdf:research-pdf|Research report]]
```

Grammar:

```text
[[tactile:<type>:<object-id>|<visible title>]]
```

The type tells readers what will open. The stable object ID resolves through `workspace.json`. The title is a human-readable fallback and the compact label shown in the cell. Pipes and closing brackets in titles are escaped when exported.

## Sparse CSV rule

Tactile displays at least 256 rows by 64 columns. Export finds the furthest cell containing a value, formula, or embedded-object link and writes only the rectangular used range. An untouched sheet exports as an empty `sheet.csv`.

## Object metadata

Each sheet may have a `sheet.meta.json` for information CSV cannot preserve:

- row and column sizes
- hidden or grouped ranges
- formatting and number formats
- conditional-format rules
- sort and filter state
- frozen ranges
- comments and validation
- view position and selection

Metadata is optional and should omit defaults. This keeps diffs small and makes machine editing predictable.

## Themes

Themes are JSON documents containing named design tokens. A theme can be imported, exported, or included in a workspace. Unknown tokens are preserved so newer Tactile versions do not destroy data created by plugins or future releases.

## Ownership and recovery

- The local copy is canonical.
- Network access is optional.
- ZIP import/export never requires an account.
- IDs remain stable across exports.
- Native files can be extracted and opened independently.
