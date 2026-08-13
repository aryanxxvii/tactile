#!/usr/bin/env sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_root=$(CDPATH= cd -- "$script_dir/../.." && pwd)
cd "$repo_root"
exec npx --yes @tauri-apps/cli@2.11.4 dev --config src-tauri/tauri.conf.json "$@"

