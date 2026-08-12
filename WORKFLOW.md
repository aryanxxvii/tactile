# Tactile Blazing-Fast Native Modernization

## Luna Max orchestration brief

### Mission

Modernize Tactile into an acquisition-ready, cross-platform native desktop application that feels instantaneous with large workspaces while preserving every current capability and durable product decision.

The target is not “more optimized JavaScript.” The target is an engineered system with:

- Measured performance budgets.
- Granular, transactional state.
- Bounded React rendering.
- Incremental formula calculation.
- Off-main-thread persistence and file processing.
- A Tauri 2 desktop shell for Windows, macOS, and Linux.
- Strict types, tests, CI, security controls, release artifacts, and handoff documentation.
- Clean extension points for future object types and spreadsheet features.

Use staged replacement. Do not perform a big-bang rewrite, visual redesign, or speculative feature expansion.

---

## 1. Immutable decisions and constraints

Every agent must read `AGENTS.md` completely before taking action.

The following decisions are locked:

1. Preserve all current Tactile behavior:
   - Sheet editing, selection, formatting, formulas, filtering, sorting, grouping, resizing, reordering, fill, clipboard, and undo/redo.
   - Markdown/document editing.
   - Embedded objects and files.
   - Single-click floating and double-click full In & Out.
   - `]` to enter or expand and `[` to return.
   - Browser-history Back/Forward semantics inside the WebView.
   - Exact reverse transition to the source cell.
   - Existing local import/export and theme behavior.

2. Preserve the current Paper visual direction:
   - Do not redesign the interface.
   - Do not change typography, density, labels, control anatomy, or motion semantics except where necessary to remove rendering cost.
   - Performance-related shadow or compositor changes must remain visually equivalent.

3. Preserve the portable workspace format:
   - Existing v4 `.tactile`, ZIP, JSON, CSV, Markdown, theme, ID, and embedded-link formats remain readable.
   - Embedded cell syntax remains:
     `[[tactile:<type>:<object-id>|<title>]]`
   - Export remains sparse and writes only the used range.
   - Unknown theme and plugin metadata must survive round trips.
   - Binary assets remain separate from ordinary cell data.
   - No folder-per-cell design.

4. Native product direction:
   - Tauri 2.
   - Windows, macOS, and Linux are equal release targets.
   - The customer-facing product is desktop-only.
   - Keep the existing Vite/Sites build functional as an internal preview and handoff artifact.
   - Do not remove or break:
     - `.openai/hosting.json`
     - `worker/index.js`
     - `scripts/prepare-sites-build.mjs`
     - `tests/sites-worker.test.mjs`

5. Do not rewrite the React interface as a native Rust UI.
   - React remains the view layer.
   - Rust handles native persistence, filesystem access, assets, recovery, import/export, compression, and other demonstrated native workloads.
   - Formula or data kernels are not ported to Rust/WASM during the initial modernization unless a later separately approved benchmark proves the optimized TypeScript worker cannot meet the fixed budget.

6. Local-first remains absolute:
   - No product telemetry.
   - No cloud dependency.
   - No account requirement.
   - No network requirement for core operation.
   - Local files remain user-owned and portable.

---

## 2. Verified starting baseline

Record these values in the performance baseline document before implementation:

- React 19.2.
- Vite 6.4.2.
- JavaScript/JSX production source with no strict type checking.
- 27 current tests pass.
- Production output:
  - JavaScript: approximately 471.7 KB raw / 140.1 KB gzip.
  - CSS: approximately 81.9 KB raw / 14.5 KB gzip.
  - 6,258 transformed modules.
- Current build takes approximately 16 seconds on the inspected machine.
- `App.jsx`: approximately 888 lines.
- `SheetGrid.jsx`: approximately 824 lines.
- `useLocalWorkspace.js`: approximately 554 lines.
- `styles.css`: approximately 4,936 lines.
- No component, browser, accessibility, native, memory-leak, or performance regression tests.
- No linting, formatting enforcement, CI, ownership rules, or strict TypeScript configuration.
- Three current high-severity npm audit findings involving Vite and its transitive build dependencies.
- Rust and Cargo are not installed in the current development environment.

Measured scaling evidence:

- Cloning a 50,000-cell sparse cell dictionary costs approximately 35 ms.
- Normalizing a 50,000-cell workspace costs approximately 79 ms.
- Serializing 50,000 cells to CSV costs approximately 51 ms.
- Building the portable package for 50,000 cells costs approximately 106 ms.
- Full formula evaluation already exceeds a frame for representative large formula sets.
- Current editing clones the sheet cell map, workspace object map, and top-level workspace.
- Undo retains whole workspace snapshots.
- Autosave serializes/clones nearly the whole workspace.
- Exact pixel scroll offsets enter React state every animation frame.
- Visible sheet cells rerender even when the virtual row/column window has not changed.
- Formula evaluation depends on the whole sheet object identity.
- Resize and reorder perform durable work during raw pointer movement.
- Every cell uses paint-heavy shadow, gradient, transition, and compositor styling.
- JSZip and all object renderers load eagerly.

---

## 3. Fixed performance fixture and release budgets

Create one deterministic checked-in performance workspace containing:

- 100 objects.
- 250,000 used cells total.
- One sheet with 100,000 used cells.
- 25,000 formulas with chains, fan-out, ranges, lookups, and conditional aggregates.
- 25 conditional-format rules.
- Five nested embedded-object layers.
- A 250 KB Markdown document.
- 100 MB of binary assets.
- Mixed row heights and column widths.
- Collapsed groups, filters, formatted ranges, and embedded cells.

Measure production builds on a pinned four-core, 16 GB, integrated-graphics reference machine.

Release budgets:

- Typing and keyboard navigation:
  - p95 input-to-paint ≤50 ms.
  - No dropped characters.
  - No caret loss.
  - No browser-blue selection flash.
- Scroll, resize preview, and In & Out:
  - p95 frame time ≤16.7 ms.
  - No repeated main-thread task over 50 ms.
- Formula updates:
  - Simple edits display affected results within 100 ms.
  - Input remains responsive while bulk recalculation runs.
- Persistence:
  - No autosave task blocks the UI thread for more than 16 ms.
  - An acknowledged transaction survives a forced process termination.
- Launch:
  - Warm launch to interactive ≤1.5 seconds.
  - Cold launch to interactive ≤3 seconds.
- Bundle:
  - Initial JavaScript ≤110 KB gzip.
  - CSS ≤18 KB gzip.
  - Heavy object types and import/export code load on demand.
- Stability:
  - Mounted cell count remains bounded by the virtual window.
  - No listener, observer, timer, DOM, or retained-memory growth after 100 nested open/close cycles.
  - No performance regression greater than 10% without an explicitly reviewed baseline change.

---

## 4. Target architecture

### 4.1 Workspace engine

Replace the whole-workspace React hook with a normalized external engine.

The engine owns:

- Workspace metadata.
- Object records.
- Sparse sheet records.
- Asset metadata.
- Transactions and revisions.
- Patch-based undo/redo.
- Dirty-record tracking.
- Formula invalidation.
- Persistence coordination.

React owns only:

- Active object/layer presentation.
- Selection and range view state.
- Active edit drafts.
- Transient gestures.
- Menus, popovers, focus, and animation state.
- Cached data for the currently rendered window.

Use `useSyncExternalStore` selectors. Do not introduce Redux, Zustand, or another global state dependency.

Required internal contracts:

```ts
interface WorkspaceEngine {
  getWorkspaceMeta(): WorkspaceMeta;
  getObject(objectId: ObjectId): WorkspaceObject | undefined;
  getSheetWindow(objectId: ObjectId, window: SheetWindow): CellView[];
  subscribe(selector: EngineSelector, listener: () => void): () => void;
  dispatch(command: WorkspaceCommand): Promise<TransactionResult>;
  undo(): Promise<TransactionResult | null>;
  redo(): Promise<TransactionResult | null>;
  getRevision(): string;
}
```

```ts
type WorkspaceCommand =
  | SetCellCommand
  | SetRangeCommand
  | UpdateObjectCommand
  | ResizeAxisCommand
  | MoveAxisCommand
  | InsertAxisCommand
  | DeleteAxisCommand
  | CreateEmbeddedObjectCommand
  | ReplaceAssetCommand
  | ApplyFormattingCommand
  | UpdateThemeCommand;
```

```ts
interface TransactionResult {
  revision: string;
  changedObjectIds: ObjectId[];
  changedCellIds: CellId[];
  invalidatedFormulaIds: CellId[];
  forwardPatch: WorkspacePatch;
  inversePatch: WorkspacePatch;
  dirtyRecords: DirtyRecord[];
}
```

One user action must produce one transaction, one undo entry, and one persistence request.

### 4.2 Persistence boundary

Required interface:

```ts
interface PersistencePort {
  open(request: OpenWorkspaceRequest): Promise<WorkspaceSnapshot>;
  commit(transaction: PersistedTransaction): Promise<PersistenceAck>;
  checkpoint(revision: string): Promise<void>;
  importPortable(source: ImportSource): Promise<WorkspaceSnapshot>;
  exportPortable(request: ExportRequest): Promise<ExportResult>;
  readAsset(request: AssetReadRequest): Promise<AssetHandle>;
  writeAsset(request: AssetWriteRequest): Promise<AssetRecord>;
  close(): Promise<void>;
}
```

Implementations:

- `BrowserPersistencePort`: internal preview/tests only, backed by record-oriented IndexedDB.
- `TauriPersistencePort`: production, backed by typed Tauri commands and Rust services.

### 4.3 Native storage

Use a local workspace directory with the existing inspectable portable content structure.

Maintain a hidden, rebuildable runtime area containing:

- SQLite WAL database.
- Transaction/recovery journal.
- Version and revision metadata.
- Cached formula/index data where useful.

Rules:

- User content remains exportable as ordinary CSV, Markdown, JSON metadata, themes, and native assets.
- SQLite is a transactional runtime index/cache, not the only representation of the user’s data.
- A committed transaction is first made durable in the recovery store.
- Dirty object snapshots are compacted to temporary files and atomically renamed in the background.
- Export first checkpoints the requested revision, then packages the portable files.
- If the runtime database is missing or corrupt, rebuild it from portable files plus the recovery journal.
- Binary assets are native files or blobs, never base64 strings inside React state.
- Use `rusqlite` behind a private Rust service; do not expose arbitrary SQL to the frontend.
- Enable WAL mode and use transactional migrations.

### 4.4 Formula engine

- Cache parsed formula ASTs.
- Maintain dependency and reverse-dependency graphs.
- Recalculate only changed formulas and transitive dependents.
- Run calculation in a standard Web Worker.
- Every worker request and response carries a sheet revision.
- Ignore results for stale revisions.
- Keep the previous stable calculated value visible during long recalculation.
- Report calculation progress only for materially long bulk operations.
- Cache number-format instances by locale and format.

### 4.5 Extensible object types

Replace centralized type switches with:

```ts
interface ObjectTypeDefinition<TObject extends WorkspaceObject> {
  type: TObject["type"];
  label: string;
  icon: IconDefinition;
  loadRenderer(): Promise<React.ComponentType<ObjectRendererProps<TObject>>>;
  create(input: ObjectCreateInput): TObject;
  validate(input: unknown): TObject;
  migrate(input: unknown, version: number): TObject;
  serialize(object: TObject, context: SerializeContext): Promise<PortableObject>;
  parse(input: PortableObject, context: ParseContext): Promise<TObject>;
  assetPolicy: AssetPolicy;
  commands: CommandContribution[];
}
```

Rendering, creation, import/export, migration, menus, and future plugins must all resolve through this descriptor.

---

## 5. Orchestration protocol

Luna Max must act as integrator and reviewer, not primary implementer.

Rules:

1. Spawn subagents only for the current wave.
2. Each subagent receives one bounded packet.
3. Prefer isolated branches/worktrees.
4. One packet equals one reviewed commit.
5. Never let two active agents edit the same file.
6. Agents may not perform unrelated cleanup.
7. Agents may not change product visuals or durable decisions.
8. Agents may not modify `AGENTS.md`; the orchestrator records only genuinely new durable product decisions.
9. Only the orchestrator/integration agent may edit:
   - `package.json`
   - `package-lock.json`
   - root build scripts/configuration
   - shared CI entry points
   - `src/App.*` after the shell extraction wave
   - final shared stylesheet entry points
10. Agents needing a dependency or shared-script change must report it as an integration request.
11. After every wave:
    - Stop all wave agents.
    - Integrate commits in dependency order.
    - Resolve duplication centrally.
    - Run the full gate.
    - Record benchmark deltas.
    - Continue only if the gate passes.

Do not spawn all packets at once.

---

# 6. Execution waves and subagent packets

## Wave 0 — Capture truth and install guardrails

Run A01, A02, and A03 in parallel.

### A01 — Performance and visual baseline

**Write scope**

- `benchmarks/**`
- `tests/performance/**`
- `tests/visual/**`
- Performance-specific Playwright configuration
- Baseline reports under `docs/performance/**`

**Deliverables**

- Deterministic 250,000-cell fixture generator.
- Browser trace harness.
- Frame, long-task, input latency, commit count, DOM count, listener, and memory measurements.
- Bundle-size report.
- Baseline screenshots for the sheet and all In & Out states.
- Machine-readable performance results.

**Must not edit**

- Production source.
- Package manifests; request required dependencies from A02.

**Acceptance**

- Baseline runs against the unmodified product.
- Results are deterministic enough to detect a 10% regression.
- Test records current behavior even where it fails future budgets.

### A02 — Toolchain, TypeScript, and dependency foundation

**Write scope**

- `package.json`
- `package-lock.json`
- TypeScript configuration
- ESLint configuration
- Prettier configuration
- Vite configuration
- Node/Rust toolchain version files
- Shared npm scripts

**Deliverables**

- Strict TypeScript configuration with an incremental migration bridge.
- ESLint: TypeScript, React Hooks, JSX accessibility, imports, promises.
- Prettier format check.
- Scripts:
  - `format:check`
  - `lint`
  - `typecheck`
  - `test:unit`
  - `test:component`
  - `test:e2e`
  - `bench:perf`
  - `verify`
- Patched Vite/build dependencies with zero high/critical audit findings.
- Build dependencies moved to `devDependencies`.
- Removal of unused font packages.
- Pinned Node 24 LTS/npm and stable Rust toolchain with `rustfmt` and `clippy`.

**Acceptance**

- Current app still builds and runs.
- Existing tests pass.
- `npm audit` has zero high/critical findings.
- No mass source conversion in this packet.

### A03 — Compatibility and migration fixtures

**Write scope**

- `tests/fixtures/**`
- `tests/compatibility/**`
- `src/compat/**`
- Runtime schema modules only

**Deliverables**

- Golden v1–v4 workspace fixtures.
- Nested objects and binary assets.
- Styled cells with `role`, validation, notes, embeds, and unknown fields.
- Unknown theme tokens.
- Malformed, oversized, duplicate-ID, dangling-reference, and unsupported-version fixtures.
- Sequential migration contract.
- Round-trip assertions.

**Acceptance**

- Demonstrate the current loss of `role`/unknown fields before the fix.
- Define the required corrected output without changing portable v4 syntax.
- Newer unsupported formats are rejected without destructive normalization.

### Gate G0

- Clean install succeeds.
- Current tests pass.
- Production build succeeds.
- Sites artifacts exist.
- Baseline reports are archived.
- Worktree is clean.

---

## Wave 1 — Create safe architectural seams

Run B01, B02, B03, and B04 in parallel only after G0.

### B01 — Typed domain and engine contracts

**Write scope**

- `src/core/**`
- Type conversions for pure model, coordinate, range, structure, formatting, and command types
- No React components

**Deliverables**

- Strict domain types.
- Workspace engine interfaces.
- Command and patch contracts.
- Stable IDs and revision types.
- Explicit transient-versus-durable state boundary.
- Existing pure helpers migrated without behavior changes.

**Acceptance**

- Pure tests pass unchanged.
- No dependency on React, DOM, Tauri, or storage.

### B02 — SheetGrid extraction

**Write scope**

- Existing sheet grid files.
- New `src/objects/sheet/grid/**` modules.

**Deliverables**

Extract without behavioral change:

- Viewport/canvas calculation.
- Headers.
- Cell layer.
- Selection projection.
- Gesture controllers.
- Conditional-rule projection.
- Context-menu adapter.

Keep `SheetGrid` as a small composition shell.

**Acceptance**

- Pixel baseline remains within agreed tolerance.
- Existing keyboard, focus, selection, scroll, and editing behavior remains identical.
- No optimization beyond obvious no-op deduplication.

### B03 — App shell and In & Out extraction

**Write scope**

- `src/App.*`
- `src/components/SpatialLayer.*`
- New `src/shell/**`

**Deliverables**

Extract:

- Navigation stack.
- Browser-history synchronization.
- Layer lifecycle.
- In & Out timing/state.
- Workspace commands.
- Settings/notice state.
- Object rendering boundary.

**Acceptance**

- `App` becomes a composition entry point.
- All current navigation paths remain identical.
- Browser Back/Forward and exact-source reverse tests pass.

### B04 — Object-type descriptor foundation

**Write scope**

- Object registry/type modules.
- New `src/objects/registry/**`

**Deliverables**

- Typed `ObjectTypeDefinition`.
- Descriptor registrations for all existing types.
- Lazy renderer contract.
- Compatibility adapters around current creation and serialization functions.

**Acceptance**

- All existing object types render and create normally.
- No import/export rewrite yet.
- No eager renderer loading through the new registry.

### Gate G1

- Type checks pass.
- Behavioral and visual baselines remain unchanged.
- No file exceeds the agreed modularity limit without a documented exception.
- Shared contracts are frozen for Wave 2.

---

## Wave 2 — Replace expensive state and calculation paths

Run C01–C04 in parallel after G1.

### C01 — Transaction engine and patch history

**Write scope**

- `src/core/engine/**`
- `src/core/commands/**`
- `src/core/history/**`
- Engine selector hooks

**Deliverables**

- Normalized record store.
- Batched selector notifications.
- Typed dispatch.
- Forward/inverse patches.
- Patch-based undo/redo.
- Dirty-record tracking.
- Coalescing rules for text-edit sessions.
- Differential test adapter against the legacy hook.

**Acceptance**

- Editing one cell does not clone the complete workspace or sheet cell dictionary.
- Unrelated objects receive no subscription notification.
- One edit session equals one undo entry.
- Legacy/new engine snapshots match across golden command sequences.

### C02 — Browser persistence adapter and asset separation

**Write scope**

- `src/platform/browser/**`
- Browser storage migration modules
- Asset handle modules

**Deliverables**

- Record-oriented IndexedDB stores.
- Workspace metadata, objects, cells, and assets stored separately.
- Local storage limited to tiny boot/recovery metadata.
- Legacy cache migration using copy/verify/switch; old data retained until verified.
- Native Blob storage and object-URL lifecycle.

**Acceptance**

- Unrelated edits do not clone or write binary assets.
- Reload restores the latest acknowledged transaction.
- Migration failure leaves the legacy store intact.

### C03 — Incremental formula worker

**Write scope**

- Formula parser/evaluator modules.
- `src/workers/formula/**`
- Formula-specific tests and benchmarks.

**Deliverables**

- Parsed AST cache.
- Dependency/reverse-dependency graph.
- Incremental recalculation.
- Revisioned worker protocol.
- Stale-result rejection.
- Cached formatters.

**Acceptance**

- A single independent edit does not evaluate every formula.
- The 25,000-formula fixture remains interactive.
- Existing formula outputs and errors are byte-for-byte compatible.

### C04 — Virtual scrolling and bounded cell rendering

**Write scope**

- Extracted grid viewport/cell modules.
- `useVirtualSheet`.
- `SheetCell` and cell-slot modules.

**Deliverables**

- Raw scroll offsets in refs or native sticky behavior.
- React updates only when the virtual window or viewport size changes.
- Overscan hysteresis.
- Memoized cell slots with primitive props.
- No materialized records for empty visible cells.
- Numeric selection predicates.
- Precompiled conditional rules.
- Embedded-click timer moved out of ordinary cells.

**Acceptance**

- A 1,000-pixel scroll does not commit React once per animation frame.
- Mounted cell DOM stays bounded.
- Selected/editing cell focus remains stable.

### Gate G2

- New engine enabled in test/shadow mode.
- Legacy/new differential suite passes.
- Scroll, editing, and formula traces improve without functional changes.
- No portable-format changes.

---

## Wave 3 — Interaction, animation, paint, and startup

Run D01–D03 in parallel. Run D04 only after they merge.

### D01 — Local edit sessions

**Write scope**

- Cell editor.
- Formula bar.
- Object title editor.
- Markdown editor.

**Deliverables**

- Local drafts during typing.
- One canonical transaction per edit session.
- Deferred Markdown preview and word/line counts.
- Immediate local visual feedback.
- Formula preview through the worker without whole-workspace mutation.

**Acceptance**

- No dropped characters.
- No focus or caret loss.
- First printable key begins empty-cell editing.
- One undo reverses one logical edit session.

### D02 — Transient gestures

**Write scope**

- Extracted selection, resize, reorder, and fill controllers.

**Deliverables**

- Pointer capture.
- Gesture listeners installed only while active.
- Animation-frame-coalesced preview.
- CSS geometry preview for resizing.
- Drag ghost/insertion marker for reorder.
- One transaction on pointer release.

**Acceptance**

- Resize/reorder does not persist during every pointer move.
- One gesture produces one undo and save entry.
- Viewport never jumps to an unrelated edge.

### D03 — In & Out lifecycle and compositing

**Write scope**

- Extracted shell navigation/layer modules.
- `SpatialLayer`.
- Motion-specific styles.

**Deliverables**

- Lightweight motion shell.
- Transform/opacity-only primary animation.
- Static or opacity-only shadow treatment.
- Child prewarm during floating hold.
- Occluded ancestor suspension.
- Inactive media/observers/listeners paused.
- DOM and scroll state retained for reverse.
- Transition completion events instead of timing races where possible.

**Acceptance**

- Parent remains visible at the deliberate floating stage.
- Reverse keeps child content visible during contraction.
- No blank rectangle or double-painted source tile.
- Exact source-cell return survives five nested layers.
- Browser Back/Forward remains correct.

### D04 — CSS consolidation and code splitting

**Write scope**

- Stylesheets.
- Lazy imports and bundle boundaries.
- Icon import structure.
- No behavior changes.

**Deliverables**

- Tokens/base/motion/object-scoped style organization.
- Removal of blanket cell compositor promotion.
- Cheaper default cell paint with visually equivalent molded depth.
- Lazy settings, import/export, and inactive renderers.
- JSZip loaded only when the internal browser preview imports/exports.
- Bundle report and budget enforcement.

**Acceptance**

- Visual regression suite passes.
- Initial JS and CSS meet budgets.
- No duplicate stale style passes remain.

### Gate G3

- Transaction engine becomes the default.
- Legacy hook remains behind a temporary rollback flag.
- All functional, visual, accessibility, and performance suites pass.
- Remove the rollback flag only in the final integration wave.

---

## Wave 4 — Native Tauri platform

Run E01 first. After E01 merges, run E02–E04 in parallel.

### E01 — Tauri scaffold, build, and security shell

**Write scope**

- New `src-tauri/**` scaffold and configuration.
- Tauri capability and CSP files.
- Native-specific build configuration.

**Deliverables**

- Tauri 2 shell using the existing Vite client build.
- Minimal capabilities.
- Strict CSP.
- No remote-content permission.
- Window title follows `Tactile — {object title}`.
- Development and production scripts.
- Existing `npm run build` continues producing Sites artifacts.

**Acceptance**

- Blank native shell launches on the current platform.
- Sites build remains byte-functionally equivalent.
- Rust formatting, Clippy, and tests run.

### E02 — Rust storage, recovery, and migrations

**Write scope**

- `src-tauri/src/storage/**`
- Native database migrations.
- Recovery tests.

**Deliverables**

- Private `rusqlite` service.
- WAL mode.
- Record-oriented tables.
- Revision and transaction journal.
- Atomic checkpointing.
- Crash recovery.
- Cache rebuild from portable files.
- Typed error codes; no raw SQL or internal paths leaked to UI.

**Acceptance**

- Acknowledged edits survive forced termination.
- Migration failure rolls back.
- Cache deletion followed by reopen reconstructs the same workspace.

### E03 — Rust import/export and assets

**Write scope**

- `src-tauri/src/portable/**`
- `src-tauri/src/assets/**`

**Deliverables**

- Streaming import/export.
- ZIP size/count/resource validation.
- CSV/Markdown/native-file preservation.
- Direct address lookup during metadata import.
- Asset streaming without base64 React state.
- Cancellation and progress for materially long operations.
- Correct round trip for role and unknown metadata.

**Acceptance**

- All v4 golden fixtures round-trip.
- Malformed and oversized bundles fail safely.
- UI remains responsive during 100 MB import/export.

### E04 — Frontend Tauri persistence adapter

**Write scope**

- `src/platform/tauri/**`
- Native runtime detection.
- IPC contract tests.

**Deliverables**

- `TauriPersistencePort`.
- Small command/delta payloads.
- Revision and acknowledgement handling.
- Native file dialog integration behind custom Tactile controls.
- Asset handles rather than raw data URLs.
- Browser adapter remains usable for internal preview tests.

**Acceptance**

- Same frontend behavior with browser and Tauri ports.
- No platform checks leak into object components.
- Stale acknowledgements cannot overwrite newer state.

### Gate G4

- Native smoke passes on Windows, macOS, and Ubuntu CI.
- Existing workspace imports correctly.
- Portable export reopens in the browser preview.
- Security scopes pass review.
- Performance budgets hold inside the native WebView.

---

## Wave 5 — Acquisition and release readiness

Run F01–F04 in parallel.

### F01 — Functional, accessibility, and recovery test pyramid

Own:

- Unit/component tests.
- Playwright functional tests.
- Accessibility tests.
- Native integration and recovery tests.

Coverage gates:

- Domain/data layer: ≥90% lines and ≥80% branches.
- Overall configured source: ≥80% lines and ≥70% branches.
- Thresholds may only ratchet upward.

### F02 — Final performance certification

Own:

- Production trace runs.
- Memory/leak tests.
- Bundle reports.
- Reference hardware certification.

This agent reports regressions to the owning subsystem agent. It must not make broad production edits itself.

### F03 — CI, packaging, and release

Own:

- `.github/**`
- Release workflows.
- Artifact checksums.
- Packaging automation.

Required matrix:

- Windows x64 MSI.
- macOS signed/notarized universal DMG.
- Linux x64 AppImage and `.deb`.
- Unsigned artifacts remain available until owner signing credentials exist.

### F04 — Handoff documentation and supply-chain posture

Own:

- `CONTRIBUTING.md`
- `SECURITY.md`
- Architecture and performance docs.
- ADR template and initial ADRs.
- Code ownership.
- Compatibility and migration policy.
- Backup/recovery procedure.
- Threat model.
- SBOM.
- Third-party notices.
- Dependency/license inventory.
- Release/changelog policy.

Do not invent a license or security contact. Record these as owner/legal prerequisites.

### Gate G5

One clean-clone command must:

1. Install from the lockfile.
2. Check formatting.
3. Lint.
4. Type-check.
5. Run unit and component tests.
6. Build the production client.
7. Produce and validate all Sites artifacts.
8. Run Sites worker tests.
9. Run browser smoke tests.
10. Run Rust formatting, Clippy, and tests.
11. Run native smoke on the platform matrix.
12. Enforce bundle and performance budgets.
13. Enforce zero high/critical dependency advisories.
14. Generate SBOM and license inventory.

---

## Wave 6 — Final integration and legacy removal

Only the Luna Max orchestrator or a dedicated integration agent may perform this wave.

### Z01 — Integration

- Remove the legacy whole-workspace hook and migration flag.
- Remove duplicated object creation/export logic.
- Resolve remaining shared-file adapters.
- Ensure no production JavaScript/JSX remains under `src/`.
- Ensure large modules have documented boundaries.
- Run the complete feature matrix.
- Update architecture diagrams and ADRs.

### Z02 — Release candidate

- Run forced-shutdown recovery tests.
- Run all performance budgets three times and report median/p95.
- Build every native artifact.
- Validate import/export with old fixtures and the new native release.
- Verify no design or product-decision drift.
- Produce:
  - Release notes.
  - Known limitations.
  - Performance report.
  - Security/dependency report.
  - SBOM.
  - Checksums.
  - Acquisition handoff checklist.

---

## 7. Mandatory functional regression matrix

No release is allowed until these pass:

### Sheet

- Single-cell and range selection.
- Shift extension.
- Full row/column selection without moving the active cell to an edge.
- First printable key editing.
- Enter, F2, double-click, Escape, blur, and caret behavior.
- Formula-bar editing and suggestions.
- Copy, cut, paste, multi-cell TSV, and image paste.
- Fill handle and relative/absolute formulas.
- Formatting, fill, text color/highlight, size, alignment, number formats, conditional formats, and clear.
- Sorting, filtering, grouping, resizing, inserting, deleting, and reordering.
- Undo/redo for every command.
- Large-range operations.
- Selection and viewport origin preservation.
- Active outline, fill handle, first-row stacking, and sticky headers.

### Objects and documents

- Blank workspace creation.
- Stable generated names.
- Live embedded-object title resolution.
- Markdown blocks, shortcuts, inline formatting, task lists, color/highlight, and preview.
- PDF, image, video, HTML, SVG, and file replacement.
- Binary asset reload and export.

### In & Out

- Single click → floating.
- Double click → full.
- `]` floating expansion.
- `[` return from floating and full.
- Outside click closes floating.
- Five nested layers.
- Back/Forward reopening.
- Exact source-cell return.
- No blank reverse surface.
- No duplicate source tile.
- Correct document title and dock path.

### Persistence

- Reload after editing.
- Forced termination after acknowledged edit.
- Migration from all supported fixtures.
- Cache corruption and rebuild.
- Import/export cancellation.
- Disk-full and permission failure.
- Unknown-field preservation.
- No asset duplication or base64 inflation.

---

## 8. Rollback and safety strategy

- Keep each wave independently revertible.
- Maintain legacy/new engine differential tests until Z01.
- Browser storage migration uses copy → validate → switch; never overwrite the legacy store first.
- Native database migrations run in transactions with pre-migration backup metadata.
- Portable format remains v4 unless an explicit product decision separately authorizes a version bump.
- Keep the last successfully checkpointed portable state when a checkpoint fails.
- Never mark a transaction durable before the native recovery store acknowledges it.
- Any of the following blocks integration:
  - Portable-format mismatch.
  - Lost input or focus regression.
  - In & Out semantic regression.
  - Performance regression above 10%.
  - Unbounded memory/listener growth.
  - High/critical dependency advisory.
  - Cross-platform build failure.
  - Visual deviation from the Paper baseline.

---

## 9. Definition of done

The modernization is complete only when:

- Tactile runs as a native Tauri application on Windows, macOS, and Linux.
- All existing features and durable decisions are preserved.
- The fixed 250,000-cell fixture meets every performance budget.
- Editing does not clone or persist the whole workspace.
- Scrolling does not rerender on every pixel frame.
- Formulas recalculate incrementally off the UI thread.
- Resize and reorder commit once per gesture.
- Assets do not live as base64 in React state.
- Undo uses patches, not workspace snapshots.
- Native recovery survives forced termination.
- Existing v4 files round-trip without field loss.
- The Sites handoff build remains valid.
- Production source is strictly typed.
- CI, tests, security controls, release artifacts, docs, SBOM, and ownership rules are complete.
- The repository can be handed to another engineering organization without undocumented operational knowledge.

---

# Ready-to-paste Luna Max kickoff prompt

You are the lead orchestrator for the Tactile native-performance modernization in `C:\dev\tactile`.

Read `AGENTS.md` completely before any action. Treat every durable Tactile product decision as immutable. The comprehensive execution specification follows this prompt and is authoritative.

Do not implement the entire project yourself. Delegate bounded task packets to subagents wave by wave. Use isolated branches/worktrees when supported. Never allow two active agents to edit the same file. One packet must produce one reviewable commit. You own integration, shared root files, dependency changes, performance gates, and final decisions.

Start only with Wave 0 packets A01, A02, and A03 in parallel. Give each subagent its exact scope, prohibited files, deliverables, verification steps, and acceptance criteria from the specification. Wait for all three, review their work, integrate in dependency order, run Gate G0, and report measured results before spawning Wave 1.

After every wave:

1. Stop completed agents.
2. Inspect all diffs.
3. Reject unrelated cleanup.
4. Resolve shared-file changes centrally.
5. Run the complete gate for that wave.
6. Compare performance and visual baselines.
7. Commit the integrated wave.
8. Continue only when the gate passes.

Do not redesign the product. Do not remove the Sites infrastructure. Do not change the portable v4 format. Do not rewrite the React UI in Rust. Do not add telemetry or cloud dependencies. Do not port formulas to Rust/WASM during this project.

If a packet encounters a genuine product decision not covered by the specification, stop that packet and escalate the exact decision. Do not let subagents invent product behavior.

Begin by confirming the worktree state, creating the Wave 0 delegation board, and spawning A01, A02, and A03.
