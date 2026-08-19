import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

function fail(message) {
  throw new Error(message);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function versionFromTag(tag, pattern, description) {
  const match = pattern.exec(tag || "");
  if (!match) fail(`Tag must use ${description}.`);
  return match;
}

const APP_RELEASE_TAG_PATTERN = /^v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:alpha|rc)\.(?:0|[1-9]\d*))?)$/;

function cargoPackageVersion(contents, filePath) {
  const version = /\[\[?package\]?\][\s\S]*?^name\s*=\s*"tactile"\s*$[\s\S]*?^version\s*=\s*"([^"]+)"\s*$/m.exec(
    contents,
  )?.[1];
  if (!version) fail(`Could not find the tactile package version in ${filePath}.`);
  return version;
}

async function validateApp(tag) {
  const [, tagVersion] = versionFromTag(
    tag,
    APP_RELEASE_TAG_PATTERN,
    "v<major>.<minor>.<patch>, v<version>-alpha.<number>, or v<version>-rc.<number>",
  );
  const authoritativeVersion = String((await readJson("version.json")).version || "");
  const packageVersion = String((await readJson("package.json")).version || "");
  const packageLock = await readJson("package-lock.json");
  const tauriVersion = String((await readJson(path.join("src-tauri", "tauri.conf.json"))).version || "");
  const cargo = await readFile(path.join("src-tauri", "Cargo.toml"), "utf8");
  const cargoVersion = /^version\s*=\s*"([^"]+)"/m.exec(cargo)?.[1] || "";
  const cargoLockPath = path.join("src-tauri", "Cargo.lock");
  const cargoLockVersion = cargoPackageVersion(await readFile(cargoLockPath, "utf8"), cargoLockPath);
  const versions = {
    tag: tagVersion,
    "version.json": authoritativeVersion,
    "package.json": packageVersion,
    "package-lock.json": String(packageLock.version || ""),
    "package-lock.json root": String(packageLock.packages?.[""]?.version || ""),
    "src-tauri/tauri.conf.json": tauriVersion,
    "src-tauri/Cargo.toml": cargoVersion,
    "src-tauri/Cargo.lock": cargoLockVersion,
  };

  const mismatches = Object.entries(versions).filter(([, version]) => version !== authoritativeVersion);
  if (!authoritativeVersion || mismatches.length) {
    fail(
      `App versions must match version.json: ${Object.entries(versions)
        .map(([source, version]) => `${source}=${version || "<missing>"}`)
        .join(", ")}`,
    );
  }

  console.log(`Validated app release version ${authoritativeVersion}.`);
}

async function validatePlugin(tag) {
  const [, packageId, tagVersion] = versionFromTag(
    tag,
    /^([a-z0-9]+(?:[.-][a-z0-9]+)*)@([^@]+)$/i,
    "<packageId>@<version>",
  );
  const appVersion = String((await readJson("version.json")).version || "");
  const appMajor = /^(\d+)\./.exec(appVersion)?.[1];
  if (!appMajor) fail(`version.json contains an invalid version: ${appVersion || "<missing>"}.`);

  const pluginsRoot = path.resolve("marketplace", "plugins");
  const entries = await readdir(pluginsRoot, { withFileTypes: true });
  let manifest;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = await readJson(path.join(pluginsRoot, entry.name, "manifest.json"));
    if (candidate.packageId === packageId) {
      manifest = candidate;
      break;
    }
  }

  if (!manifest) fail(`No marketplace plugin has packageId ${packageId}.`);
  if (manifest.version !== tagVersion) {
    fail(`Plugin tag version ${tagVersion} does not match ${packageId} manifest version ${manifest.version}.`);
  }

  const pluginMajor = /^(\d+)\./.exec(manifest.version)?.[1];
  if (pluginMajor !== appMajor) {
    fail(`Plugin ${packageId} major ${pluginMajor || "<invalid>"} does not match Tactile major ${appMajor}.`);
  }

  console.log(`Validated ${packageId} release version ${manifest.version} for Tactile ${appVersion}.`);
}

async function main() {
  const [mode, tag] = process.argv.slice(2);
  if (mode === "app") return validateApp(tag);
  if (mode === "plugin") return validatePlugin(tag);
  fail("Usage: validate-release-version.mjs <app|plugin> <tag>");
}

main().catch((error) => {
  console.error(`Release version validation failed: ${error.message}`);
  process.exitCode = 1;
});
