# Development and release commands

## Routine work

```bash
git switch alpha
git pull --ff-only origin alpha
git switch -c feature/short-description
```

Push and PR the temporary branch to `alpha`; squash-merge and delete it.

## Install release commands

Install the repository-local `git build` alias once per clone:

```bash
npm run git:install
```

The alias is stored in the clone's local Git configuration. Reinstall it after creating a new clone.

## Alpha build

Start from a clean, current `alpha` branch:

```bash
git switch alpha
git pull --ff-only origin alpha
git build alpha
```

With `version.json` at `1.5.0-alpha.2`, the command selects `1.5.0-alpha.3`. If the current version is stable
`1.4.9`, it starts the next patch at `1.4.10-alpha.1`. Existing local and remote tags are included when selecting
the next unused counter.

To start a minor or major alpha series, or choose a specific counter, pass the complete version:

```bash
git build alpha 1.5.0-alpha.1
```

The command synchronizes every version mirror, formats generated JSON, validates the future tag, commits as
`build(alpha): prepare <version>`, creates the annotated tag, and atomically pushes `alpha` with the tag. The tag
push triggers the alpha package workflow.

Use `--dry-run` to inspect the selected version and actions without changing files. Use `--yes` only when a trusted
interactive or automated caller should skip confirmation.

## Stable promotion

Prepare the stable version from a clean, current `alpha` branch:

```bash
git switch alpha
git pull --ff-only origin alpha
git build stable 1.5.0
```

This synchronizes and validates the stable version, commits as `build(release): prepare 1.5.0`, and pushes `alpha`.
It does not tag or modify protected `main`. Open and merge the `alpha` -> `main` release PR after CI and release
evidence pass. Then publish from a clean, current `main` branch using the copy-paste commands printed by the
preparation command:

```bash
git switch main
git pull --ff-only origin main
git build stable 1.5.0 --publish
```

Publication verifies that `version.json` and all mirrors equal `1.5.0`, creates the immutable `v1.5.0` tag, and pushes
only that tag. Review CI's draft release, then merge `main` back into `alpha`.

## Safety and recovery

`git build` exits with a specific cause before editing when the branch is wrong, the worktree is dirty, local history
does not equal the required remote branch, a version is invalid or not newer, or a tag already exists. Validation
failures before commit restore the version files. Release tags are never moved or overwritten.

If an alpha atomic push fails after the local commit and tag are created, retry the command printed by the tool:

```bash
git push --atomic origin HEAD:alpha refs/tags/v1.5.0-alpha.3
```

If stable tag publication fails, retry its printed `git push origin refs/tags/v1.5.0` command. Enter SSH passphrases
directly in the terminal; the release tool does not read or store credentials.

## Windows prerelease versions

Canonical versions and tags retain SemVer channel names, such as `1.5.0-alpha.3`. WiX/MSI requires a numeric-only
prerelease identifier, so Windows packaging derives an uncommitted bundle version:

| Canonical version | Windows bundle version |
| ----------------- | ---------------------- |
| `1.5.0-alpha.3`   | `1.5.0-10003`          |
| `1.5.0-rc.3`      | `1.5.0-20003`          |
| `1.5.0`           | `1.5.0`                |

Alpha and RC counters are limited to `1..9999`. `version.json`, npm, Cargo, Tauri source configuration, release tags,
and user-facing build metadata continue to use the canonical version.

## Plugin release

Build/test the bumped package, commit source plus `marketplace/dist`, promote to `main`, then create `tactile.name@X.Y.Z` on that main commit.
