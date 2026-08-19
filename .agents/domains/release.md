# Release domain

`version.json` is the app version authority. `scripts/release/sync-version.mjs` owns npm, Tauri, and Cargo mirrors. Marketplace manifests version plugins independently.

App release operators install the clone-local alias with `npm run git:install`, then use `git build alpha` or
`git build stable`. Windows MSI packaging derives its numeric-only bundle prerelease from the canonical app version;
the canonical version and tag remain `X.Y.Z-alpha.N` or `X.Y.Z-rc.N`.

CI validates branches; tags authorize publication. Prereleases do not replace stable updater metadata. Release jobs use clean tagged checkouts, locked dependencies, expected-artifact validation, SHA-256 checksums, updater signatures, and platform signing when credentials exist.

Do not commit `dist/client`, `src-tauri/target`, installers, coverage, or test output. `marketplace/dist` is the deliberate generated exception while production serves the committed catalog.

Load `knowledge/release-policy.md` for policy, `knowledge/development-workflow.md` for commands, and `knowledge/reproducible-build.md` for evidence requirements.
