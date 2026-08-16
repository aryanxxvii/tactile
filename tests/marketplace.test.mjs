import assert from "node:assert/strict";
import test from "node:test";

import { OBJECT_TYPE_DEFINITIONS } from "../src/objects/registry/builtins.js";
import { workspaceFromZip, workspaceToZipBlob } from "../src/export.js";
import { createBlankWorkspace } from "../src/model.js";
import {
  downloadMarketplacePlugin,
  fetchMarketplaceCatalog,
  sha256Hex,
} from "../src/objects/registry/marketplace.js";

function response(body, options = {}) {
  const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    json: async () => body,
    text: async () => String(body),
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}

test("the installed app bundles only Tiles, Text, and internal Link support", () => {
  assert.deepEqual(Object.keys(OBJECT_TYPE_DEFINITIONS), ["sheet", "markdown", "link"]);
  assert.equal(OBJECT_TYPE_DEFINITIONS.sheet.creatable, true);
  assert.equal(OBJECT_TYPE_DEFINITIONS.markdown.creatable, true);
  assert.equal(OBJECT_TYPE_DEFINITIONS.link.manageInSettings, false);
});

test("marketplace catalog validation accepts schema v1 and rejects malformed data", async () => {
  const catalog = await fetchMarketplaceCatalog(async () => response({ schemaVersion: 1, plugins: [] }));
  assert.deepEqual(catalog.plugins, []);
  await assert.rejects(
    fetchMarketplaceCatalog(async () => response({ schemaVersion: 2, plugins: [] })),
    /catalog is invalid/,
  );
});

test("a GitHub-hosted catalog resolves relative bundles and assets without recompiling Tactile", async () => {
  const catalogUrl = "https://raw.githubusercontent.com/acme/tactile/main/marketplace/dist/catalog.json";
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => catalogUrl };
  try {
    const catalog = await fetchMarketplaceCatalog(async (url) => {
      assert.equal(url, catalogUrl);
      return response({
        schemaVersion: 1,
        plugins: [{
          packageId: "tactile.pdf",
          artifact: "plugins/tactile.pdf/1.0.0/plugin.js",
          assets: [{ file: "worker.mjs", artifact: "plugins/tactile.pdf/1.0.0/worker.mjs" }],
        }],
      });
    });
    assert.equal(catalog.plugins[0].artifact, "https://raw.githubusercontent.com/acme/tactile/main/marketplace/dist/plugins/tactile.pdf/1.0.0/plugin.js");
    assert.equal(catalog.plugins[0].assets[0].artifact, "https://raw.githubusercontent.com/acme/tactile/main/marketplace/dist/plugins/tactile.pdf/1.0.0/worker.mjs");
  } finally {
    globalThis.localStorage = originalStorage;
  }
});

test("plugin downloads verify size and SHA-256 before activation", async () => {
  const source = "export function activate() { return {}; }";
  const entry = {
    status: "available",
    artifact: "/marketplace/plugin.js",
    size: new TextEncoder().encode(source).byteLength,
    sha256: await sha256Hex(source),
  };
  assert.equal((await downloadMarketplacePlugin(entry, async () => response(source))).source, source);
  await assert.rejects(
    downloadMarketplacePlugin({ ...entry, sha256: "0".repeat(64) }, async () => response(source)),
    /checksum/,
  );
});

test("plugin package assets are verified and returned for persistent caching", async () => {
  const source = "export function activate() { return {}; }";
  const worker = new TextEncoder().encode("self.onmessage = () => {};");
  const entry = {
    status: "available",
    artifact: "/marketplace/plugin.js",
    size: new TextEncoder().encode(source).byteLength,
    sha256: await sha256Hex(source),
    assets: [{ file: "worker.mjs", artifact: "/marketplace/worker.mjs", size: worker.byteLength, sha256: await sha256Hex(worker) }],
  };
  const result = await downloadMarketplacePlugin(entry, async (url) => response(url.endsWith("worker.mjs") ? worker : source));
  assert.equal(result.assetSources[0].file, "worker.mjs");
  assert.deepEqual(result.assetSources[0].bytes, worker);
});

test("portable workspaces preserve opaque plugin state and requirements without the plugin", async () => {
  const workspace = createBlankWorkspace({ id: "plugin-portable" });
  workspace.objects.counter = {
    id: "counter",
    type: "example-counter",
    title: "Counter",
    description: "",
    parent: null,
    count: 42,
    futureState: { color: "red" },
  };
  const blob = await workspaceToZipBlob(workspace);
  const restored = await workspaceFromZip(await blob.arrayBuffer());
  assert.equal(restored.objects.counter.count, 42);
  assert.deepEqual(restored.objects.counter.futureState, { color: "red" });
});
