import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { format, resolveConfig } from "prettier";

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function fail(message) {
  throw new Error(message);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function formatJson(value, filePath) {
  return format(JSON.stringify(value), { ...(await resolveConfig(filePath)), filepath: filePath });
}

function replacePackageVersion(contents, version, filePath) {
  const pattern = /(\[\[?package\]?\][\s\S]*?^name\s*=\s*"tactile"\s*$[\s\S]*?^version\s*=\s*")[^"]+("\s*$)/m;
  if (!pattern.test(contents)) fail(`Could not find the tactile package version in ${filePath}.`);
  return contents.replace(pattern, `$1${version}$2`);
}

async function versionTargets(version) {
  const packageJson = await readJson("package.json");
  const packageJsonSynchronized = packageJson.version === version;
  packageJson.version = version;

  const packageLock = await readJson("package-lock.json");
  if (!packageLock.packages?.[""]) fail("package-lock.json is missing its root package entry.");
  const packageLockSynchronized = packageLock.version === version && packageLock.packages[""].version === version;
  packageLock.version = version;
  packageLock.packages[""].version = version;

  const tauriConfigPath = path.join("src-tauri", "tauri.conf.json");
  const tauriConfig = await readJson(tauriConfigPath);
  // Allow side-by-side installs: stable and prerelease (alpha/rc) use
  // different product names and bundle identifiers so the OS treats them as
  // distinct apps. The channel is inferred from the SemVer prerelease tag.
  const isPrerelease = String(version).includes("-");
  const expectedProductName = isPrerelease ? "Tactile Alpha" : "Tactile";
  const expectedIdentifier = isPrerelease
    ? "com.tactile.workspace.alpha"
    : "com.tactile.workspace";
  const tauriConfigSynchronized =
    tauriConfig.version === version &&
    tauriConfig.productName === expectedProductName &&
    tauriConfig.identifier === expectedIdentifier;
  tauriConfig.version = version;
  tauriConfig.productName = expectedProductName;
  tauriConfig.identifier = expectedIdentifier;

  const cargoTomlPath = path.join("src-tauri", "Cargo.toml");
  const cargoLockPath = path.join("src-tauri", "Cargo.lock");
  const cargoToml = await readFile(cargoTomlPath, "utf8");
  const cargoLock = await readFile(cargoLockPath, "utf8");
  const expectedCargoToml = replacePackageVersion(cargoToml, version, cargoTomlPath);
  const expectedCargoLock = replacePackageVersion(cargoLock, version, cargoLockPath);

  return [
    {
      filePath: "package.json",
      synchronized: packageJsonSynchronized,
      expected: await formatJson(packageJson, "package.json"),
    },
    {
      filePath: "package-lock.json",
      synchronized: packageLockSynchronized,
      expected: await formatJson(packageLock, "package-lock.json"),
    },
    {
      filePath: tauriConfigPath,
      synchronized: tauriConfigSynchronized,
      expected: await formatJson(tauriConfig, tauriConfigPath),
    },
    { filePath: cargoTomlPath, synchronized: cargoToml === expectedCargoToml, expected: expectedCargoToml },
    { filePath: cargoLockPath, synchronized: cargoLock === expectedCargoLock, expected: expectedCargoLock },
  ];
}

async function main() {
  const checkOnly = process.argv[2] === "--check";
  if (process.argv.length > (checkOnly ? 3 : 2)) fail("Usage: sync-version.mjs [--check]");

  const version = String((await readJson("version.json")).version || "");
  if (!VERSION_PATTERN.test(version))
    fail(`version.json contains an invalid semantic version: ${version || "<missing>"}.`);

  const stale = [];
  for (const { filePath, synchronized, expected } of await versionTargets(version)) {
    if (synchronized) continue;
    stale.push(filePath);
    if (!checkOnly) await writeFile(filePath, expected, "utf8");
  }

  if (checkOnly && stale.length) {
    fail(`Run npm run version:sync to update: ${stale.join(", ")}`);
  }

  console.log(
    stale.length ? `Synchronized ${version}: ${stale.join(", ")}` : `App version ${version} is synchronized.`,
  );
}

main().catch((error) => {
  console.error(`Version synchronization failed: ${error.message}`);
  process.exitCode = 1;
});
