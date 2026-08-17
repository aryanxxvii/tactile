import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const catalog = JSON.parse(readFileSync(path.join(root, "marketplace", "dist", "catalog.json"), "utf8"));
const expected = [
  "tactile.audio",
  "tactile.code",
  "tactile.example-counter",
  "tactile.html",
  "tactile.image",
  "tactile.pdf",
  "tactile.svg",
  "tactile.video",
];

function artifactFile(url) {
  return path.join(root, "marketplace", "dist", ...url.split("/").filter(Boolean));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

test("the generated catalog contains every independently compiled plugin", () => {
  assert.deepEqual(
    catalog.plugins.map((entry) => entry.packageId),
    expected,
  );
  assert.equal(
    catalog.plugins.every((entry) => entry.status === "available"),
    true,
  );
});

test("catalog hashes and sizes match independently emitted artifacts", () => {
  for (const entry of catalog.plugins) {
    const pluginFile = artifactFile(entry.artifact);
    assert.equal(existsSync(pluginFile), true, pluginFile);
    const source = readFileSync(pluginFile);
    assert.equal(source.byteLength, entry.size);
    assert.equal(sha256(source), entry.sha256);
    for (const asset of entry.assets || []) {
      const assetFile = artifactFile(asset.artifact);
      const bytes = readFileSync(assetFile);
      assert.equal(bytes.byteLength, asset.size);
      assert.equal(sha256(bytes), asset.sha256);
    }
  }
});

test("compiled plugins contain no unresolved host or cross-plugin imports", async () => {
  for (const entry of catalog.plugins) {
    const pluginFile = artifactFile(entry.artifact);
    const source = readFileSync(pluginFile, "utf8");
    assert.doesNotMatch(source, /tactile:host|src\/objects|marketplace\/plugins/);
    const result = await build({
      entryPoints: [pluginFile],
      bundle: true,
      format: "esm",
      platform: "browser",
      write: false,
      metafile: true,
      logLevel: "silent",
    });
    const input = Object.values(result.metafile.inputs).find((value) => value.bytes === Buffer.byteLength(source));
    assert.deepEqual(input?.imports || [], [], entry.packageId);
  }
});

test("PDF owns its worker asset while other plugins remain independent", () => {
  const pdf = catalog.plugins.find((entry) => entry.packageId === "tactile.pdf");
  assert.deepEqual(
    pdf.assets.map((asset) => asset.file),
    ["pdf.worker.min.mjs"],
  );
  assert.equal(catalog.plugins.filter((entry) => entry.assets?.length).length, 1);
});
