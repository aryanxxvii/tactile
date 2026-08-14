# Tactile Ideas

These are future product ideas only. They are not implemented and must not be
treated as current storage or onboarding behavior until they are deliberately
promoted into the workflow and tracker.

## 1. Copyable workspace-authoring prompt

Add a copyable, versioned “Workspace authoring prompt” to Settings. The prompt
should teach an LLM how to create a Tactile workspace, including:

- Tiles sheets, ordinary values, and embedded-object references.
- Nested objects, stable object IDs, parent links, source cells, aliases, and
  cycle prevention.
- Text/Markdown objects stored separately from the cell that embeds them.
- Images, PDFs, videos, and local files stored as separate assets referenced by
  asset IDs.
- Sparse sheet cells, A1 addressing, formulas, formatting, themes, Home/Start
  metadata, and portable v4 rules.
- The embedded-cell syntax:
  `[[tactile:<type>:<object-id>|<title>]]`

The prompt should support both a human-readable workspace plan and a strict
machine-readable output contract, with an explicit schema version so it stays
in sync with the product model.

Example use case: “Make me a workspace to manage my budgets.” The LLM should
be able to return workspace metadata, objects, sparse cells, embedded links,
Markdown content, asset references, and a validation report.

## 2. Folder-first native workspace storage

For the native Tauri app, allow the user to choose a real workspace folder and
use it as the canonical home directory instead of requiring a single
`.tactile` archive as the primary working format.

Implemented layout:

```text
My Workspace/
  workspace.json
  objects/
    <object-id>/sheet.csv
    <object-id>/content.md
  assets/
  themes/
  .tactile-runtime/
```

The runtime directory can contain SQLite/WAL/recovery data, while user-facing
content remains inspectable and portable. The native app exports the same
portable workspace as a `.zip` backup/share file; `.tactile` is no longer
offered in the user interface. The browser preview still uses its existing
IndexedDB fallback.

## 3. Native first-run “Getting started” guide

After the Windows installer launches the app for the first time, show a short
guide explaining:

- The local-first model.
- Cells, Tiles, Text objects, and embedded files.
- Single-click floating and double-click full navigation.
- How to return to a parent object.

Then ask the user to choose or create the home workspace directory:

- If the selected folder is empty, create a default Home Tiles page.
- If it contains an existing Tactile workspace, open and validate it.
- Allow the guide to be skipped and reopened later from Settings.
- Make the selected folder and first-run completion durable and recoverable.
