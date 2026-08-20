import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

function run(script, args) {
  return spawnSync(process.execPath, [path.join(root, script), ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

test("generates updater manifests with immutable tag-specific artifact URLs", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "tactile-updater-"));
  try {
    for (const name of [
      "tactile-windows-x64-release.msi",
      "tactile-macos-universal-release.tar.gz",
      "tactile-linux-x64-release.appimage",
    ]) {
      await writeFile(path.join(directory, name), "bundle");
      await writeFile(path.join(directory, `${name}.sig`), `signature-${name}`);
    }
    const output = path.join(directory, "latest.json");
    const result = run("scripts/release/create-updater-manifest.mjs", [
      "--dir",
      directory,
      "--version",
      "1.2.0-rc.2",
      "--tag",
      "v1.2.0-rc.2",
      "--repo",
      "aryanxxvii/tactile",
      "--output",
      output,
    ]);
    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(await readFile(output, "utf8"));
    assert.equal(manifest.version, "1.2.0-rc.2");
    for (const platform of Object.values(manifest.platforms)) {
      assert.match(platform.url, /\/releases\/download\/v1\.2\.0-rc\.2\//);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("updater manifest URLs use GitHub-sanitized asset names", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "tactile-updater-"));
  try {
    const name = "tactile-windows-x64-alpha-Tactile Alpha_1.2.0-10003_x64_en-US.msi";
    const macName = "tactile-macos-universal-alpha-ad-hoc-Tactile Alpha.app.tar.gz";
    const linuxName = "tactile-linux-x64-alpha-Tactile Alpha_1.2.0-alpha.3_amd64.AppImage";
    for (const candidate of [name, macName, linuxName]) {
      await writeFile(path.join(directory, candidate), "bundle");
      await writeFile(path.join(directory, `${candidate}.sig`), `signature-${candidate}`);
    }
    const output = path.join(directory, "latest.json");
    const result = run("scripts/release/create-updater-manifest.mjs", [
      "--dir",
      directory,
      "--version",
      "1.2.0-alpha.3",
      "--tag",
      "v1.2.0-alpha.3",
      "--repo",
      "aryanxxvii/tactile",
      "--output",
      output,
    ]);
    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(await readFile(output, "utf8"));
    assert.equal(
      manifest.platforms["windows-x86_64"].url,
      "https://github.com/aryanxxvii/tactile/releases/download/v1.2.0-alpha.3/tactile-windows-x64-alpha-Tactile.Alpha_1.2.0-10003_x64_en-US.msi",
    );
    assert.equal(
      manifest.platforms["darwin-aarch64"].url,
      "https://github.com/aryanxxvii/tactile/releases/download/v1.2.0-alpha.3/tactile-macos-universal-alpha-ad-hoc-Tactile.Alpha.app.tar.gz",
    );
    for (const platform of Object.values(manifest.platforms)) {
      assert.doesNotMatch(platform.url, / /);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("promotes only newer alpha or RC manifests", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "tactile-promotion-"));
  try {
    const current = path.join(directory, "current.json");
    const candidate = path.join(directory, "candidate.json");
    await writeFile(current, JSON.stringify({ version: "1.2.0-rc.2" }));

    await writeFile(candidate, JSON.stringify({ version: "1.2.0-alpha.9" }));
    const outputFile = path.join(directory, "output.txt");
    let result = run("scripts/release/promote-updater-channel.mjs", [
      "--candidate",
      candidate,
      "--current",
      current,
      "--github-output",
      outputFile,
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "promote=false\n");
    assert.equal(await readFile(outputFile, "utf8"), "promote=false\n");

    await writeFile(candidate, JSON.stringify({ version: "1.2.1-alpha.1" }));
    await rm(outputFile, { force: true });
    result = run("scripts/release/promote-updater-channel.mjs", [
      "--candidate",
      candidate,
      "--current",
      current,
      "--github-output",
      outputFile,
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "promote=true\n");
    assert.equal(await readFile(outputFile, "utf8"), "promote=true\n");

    await writeFile(candidate, JSON.stringify({ version: "1.2.1" }));
    result = run("scripts/release/promote-updater-channel.mjs", ["--candidate", candidate]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /alpha or RC/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("release workflow keeps stable and nightly updater channels separate", async () => {
  const workflow = await readFile(path.join(root, ".github/workflows/release.yml"), "utf8");
  const nativeUpdater = await readFile(path.join(root, "src-tauri/src/updater.rs"), "utf8");

  assert.match(nativeUpdater, /releases\/latest\/download\/latest\.json/);
  assert.match(nativeUpdater, /releases\/download\/nightly\/latest\.json/);
  assert.doesNotMatch(nativeUpdater, /updater-nightly/);
  assert.match(workflow, /--tag "\$GITHUB_REF_NAME"/);
  assert.match(workflow, /contains\(github\.ref_name, '-alpha\.'\).*contains\(github\.ref_name, '-rc\.'/);
  assert.match(workflow, /group: updater-nightly/);
  assert.match(workflow, /gh release upload nightly .* --clobber/);
});
