$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Push-Location $repoRoot
try {
    & npx --yes @tauri-apps/cli@2.11.4 dev --config src-tauri/tauri.conf.json @args
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}

