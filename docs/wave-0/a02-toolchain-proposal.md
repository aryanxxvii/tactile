# A02 — toolchain, TypeScript, and dependency integration proposal

Status: integrator-prepared after the delegated A02 workers failed to return a reviewable proposal.
Date: 2026-08-11

This document is intentionally a proposal. Shared root files remain owned by the Luna Max integrator under the Wave 0 orchestration rules.

## Observed baseline

- Node: `v24.13.0`
- npm: `11.6.2`
- Rust: `rustc` and `cargo` are not installed on this machine.
- React: `19.2.0`
- Vite: `6.4.2`
- `@vitejs/plugin-react`: `5.0.4`
- Production source is JavaScript/JSX; there is no strict TypeScript configuration.
- `npm test`: 27 passed, 0 failed.
- `npm run build`: passed; Vite transformed 6,258 modules and produced `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
- The observed build took approximately 8.6 seconds in this run; the brief's inspected-machine reference was approximately 16 seconds.
- `npm audit --audit-level=high`: 3 high, 0 critical findings involving Vite and transitive `nanoid`/`postcss` paths.
- Direct runtime dependencies are currently all listed under `dependencies`, including build-only Vite/plugin packages and 17 unused font families.
- `npm outdated` reports newer major versions for Vite/plugin-react and newer patch versions for React; these are not automatic upgrade recommendations for Wave 0.

## Proposed root-file changes

Apply centrally, in this order, after reviewing the dependency graph:

1. `package.json` / `package-lock.json`
   - Move `@vitejs/plugin-react`, `vite`, and future lint/type/test/build tooling to `devDependencies`.
   - Keep only runtime packages used by the client in `dependencies`.
   - Remove font packages that are not imported by `src/`; preserve the current Public Sans/Lilex Paper direction.
   - Patch Vite to the first compatible release whose advisory is closed, then verify the lockfile rather than assuming the latest major is safe.
   - Add scripts:

     ```json
     {
       "format:check": "prettier --check .",
       "lint": "eslint .",
       "typecheck": "tsc --noEmit",
       "test:unit": "node --test tests/*.test.mjs tests/compatibility/*.test.mjs",
       "test:component": "playwright test --config tests/playwright.component.config.mjs",
       "test:e2e": "playwright test --config tests/playwright.e2e.config.mjs",
       "bench:perf": "node tests/performance/run.mjs",
       "verify": "npm run format:check && npm run lint && npm run typecheck && npm run test:unit && npm run build && npm run test:sites"
     }
     ```

     The exact test runner/config file names should be reconciled with the A01 and later test packets before merging; these scripts must not make the internal Sites build depend on a native runtime.

2. `tsconfig.json`, `tsconfig.app.json`, and `tsconfig.node.json`
   - Use a strict no-emit app configuration with `allowJs: true`, `checkJs: false`, `jsx: react-jsx`, `isolatedModules: true`, and `noEmit: true` as the migration bridge.
   - Include only `src/**/*.js`, `src/**/*.jsx`, and future TypeScript files initially; exclude generated `dist`, `node_modules`, and benchmark output.
   - Turn on `checkJs` by directory as modules are migrated. Do not mass-convert the existing UI in Wave 0.

3. `eslint.config.js`
   - Use flat-config ESLint 9 with JavaScript and TypeScript parser support, React Hooks, JSX accessibility, import ordering/resolution, and promise rules.
   - Begin with errors for unsafe promise handling and hooks/a11y violations, warnings for migration-only rules that would otherwise block the unmodified JS surface.
   - Ignore generated output, fixtures with intentional malformed payloads, and `node_modules`.

4. `.prettierrc.json` / `.prettierignore`
   - Add a stable 2-space, trailing-comma, double-quote format for JS/JSX/TS/JSON/MD/CSS.
   - Exclude generated benchmark binaries, `dist`, and binary fixtures.

5. `.nvmrc` and `engines` / `packageManager`
   - Pin Node `24.13.0` for the current Node 24 LTS line and npm `11.6.2` for reproducible local/CI setup.
   - Keep the pin documented as an update point rather than coupling the product runtime to a developer shell.

6. `rust-toolchain.toml`
   - Pin the stable Rust channel with `rustfmt` and `clippy` components and the Windows, macOS universal, and Linux targets required by later Tauri packets.
   - Since Rust is absent here, Wave 0 can only validate the file shape; native checks belong to G4/G5.

7. `vite.config.mjs`
   - Preserve the existing `dist/client` output and Sites preparation step.
   - Keep the current host/allowed-host behavior for the internal preview.
   - Add only type-safe config support or test-only hooks; no visual or product behavior changes.

## Dependency/audit plan

- Run `npm audit --json` after every lockfile change and fail CI on high/critical advisories.
- Verify the resolved tree with `npm ls vite postcss nanoid --all`; the installed tree currently reports Vite `6.4.2`, PostCSS `8.5.26`, and nanoid `3.3.18`, while the audit database still reports three high-severity paths. Treat the audit result as authoritative until a clean install proves otherwise.
- Do not upgrade Vite to the latest major in Wave 0; Vite 8 and `@vitejs/plugin-react` 6 are outside the stated staged-replacement scope.
- Do not change React versions without running the existing behavioral and visual baselines.
- Do not remove Public Sans or Lilex. Remove only font packages with no source import after a read-only import scan.

## Acceptance and limitations

The following are proven now: the existing tests pass, the current build produces Sites artifacts, Node/npm are already on the requested major lines, and Rust is unavailable. The following remain unproven until the integrator applies and verifies root changes: zero high/critical advisories, lint/typecheck/format scripts, clean-install reproducibility, component/e2e runner setup, and Rust formatting/clippy/tests.

No package manifest, lockfile, root config, or shared CI file was modified while preparing this proposal.

## Integrator verification after proposal

The integrator applied the root changes centrally. The resulting lockfile resolves Vite `6.4.3`, Playwright `1.55.1`, PostCSS `8.5.26`, and nanoid `3.3.18`; `npm audit --audit-level=high` now reports 0 high, 0 critical findings. TypeScript, lint, Prettier, unit, component, e2e, build, and Sites checks are recorded in the Wave 0 gate results.
