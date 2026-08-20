import assert from "node:assert/strict";
import test from "node:test";

import { OBJECT_TYPE_DEFINITIONS } from "../src/objects/registry/builtins.js";
import { workspaceFromZip, workspaceToZipBlob } from "../src/export.js";
import { createBlankWorkspace } from "../src/model.js";
import {
  buildCellObjectDefinitions,
  comparePluginVersions,
  downloadMarketplacePlugin,
  fetchMarketplaceCatalog,
  HOSTED_MARKETPLACE_CATALOG_URL,
  hostedMarketplaceCatalogUrl,
  isPluginUpdateAvailable,
  LOCAL_MARKETPLACE_CATALOG_URL,
  localDevelopmentPluginRecord,
  marketplaceInstallSize,
  marketplaceCatalogUrl,
  sha256Hex,
  updatedPluginRecord,
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

test("development uses local marketplace artifacts while production defaults to GitHub", () => {
  const storage = { getItem: () => "https://example.test/override/catalog.json" };
  assert.equal(marketplaceCatalogUrl({ development: true, storage }), LOCAL_MARKETPLACE_CATALOG_URL);
  assert.equal(marketplaceCatalogUrl({ development: false, storage: null }), HOSTED_MARKETPLACE_CATALOG_URL);
  assert.equal(marketplaceCatalogUrl({ development: false, storage }), "https://example.test/override/catalog.json");
});

test("alpha and RC builds use the alpha marketplace catalog while stable uses main", () => {
  const alphaUrl = "https://raw.githubusercontent.com/aryanxxvii/tactile/alpha/marketplace/dist/catalog.json";
  assert.equal(hostedMarketplaceCatalogUrl("alpha"), alphaUrl);
  assert.equal(hostedMarketplaceCatalogUrl("rc"), alphaUrl);
  assert.equal(hostedMarketplaceCatalogUrl("release"), HOSTED_MARKETPLACE_CATALOG_URL);
  assert.equal(hostedMarketplaceCatalogUrl("development"), HOSTED_MARKETPLACE_CATALOG_URL);
  assert.equal(
    marketplaceCatalogUrl({ development: false, storage: null, channel: "alpha" }),
    alphaUrl,
  );
  assert.equal(
    marketplaceCatalogUrl({ development: false, storage: null, channel: "release" }),
    HOSTED_MARKETPLACE_CATALOG_URL,
  );
});

test("development activation replaces stale cached source without changing install state", async () => {
  const record = {
    packageId: "tactile.code",
    version: "1.0.0",
    source: "stale cached source",
    enabled: true,
    installedAt: "installed",
  };
  const catalogEntry = { packageId: "tactile.code", version: "1.0.0", source: undefined };
  const local = await localDevelopmentPluginRecord(record, catalogEntry, async () => ({
    source: "fresh local source",
    assetSources: [],
  }));
  assert.equal(local.source, "fresh local source");
  assert.equal(local.enabled, true);
  assert.equal(local.installedAt, "installed");
  assert.equal(local.developmentSource, true);
});

test("marketplace updates appear only for a newer catalog version", () => {
  const installed = { packageId: "tactile.code", version: "1.2.3" };
  assert.equal(isPluginUpdateAvailable({ status: "available", version: "1.2.4" }, installed), true);
  assert.equal(isPluginUpdateAvailable({ status: "available", version: "1.2.3" }, installed), false);
  assert.equal(isPluginUpdateAvailable({ status: "available", version: "1.1.9" }, installed), false);
  assert.equal(isPluginUpdateAvailable({ status: "planned", version: "2.0.0" }, installed), false);
  assert.equal(comparePluginVersions("2.0.0", "1.99.99"), 1);
  assert.equal(comparePluginVersions("1.0.0", "1.0.0-beta.1"), 1);
  assert.equal(comparePluginVersions("1.0.0-beta.1", "1.0.0"), -1);
});

test("disabled installed plugins remain available in the Cell Objects list", () => {
  const core = [{ type: "sheet", label: "Tiles", source: "built-in" }];
  const installed = {
    "tactile.code": {
      packageId: "tactile.code",
      type: "code",
      name: "Code",
      description: "Code editor",
      version: "1.2.3",
      enabled: false,
    },
  };
  const definitions = buildCellObjectDefinitions(core, installed);
  assert.deepEqual(
    definitions.map((definition) => definition.type),
    ["sheet", "code"],
  );
  assert.equal(definitions[1].installedPlaceholder, true);
  assert.equal(definitions[1].package.version, "1.2.3");
});

test("plugin updates preserve the installed enablement state", () => {
  const updated = updatedPluginRecord(
    { packageId: "tactile.code", version: "1.0.0", enabled: false, installedAt: "installed" },
    { packageId: "tactile.code", type: "code", version: "1.1.0" },
    { source: "new bundle", assetSources: [] },
    "updated",
  );
  assert.equal(updated.version, "1.1.0");
  assert.equal(updated.enabled, false);
  assert.equal(updated.installedAt, "installed");
  assert.equal(updated.updatedAt, "updated");
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
        plugins: [
          {
            packageId: "tactile.pdf",
            artifact: "plugins/tactile.pdf/1.0.0/plugin.js",
            assets: [{ file: "worker.mjs", artifact: "plugins/tactile.pdf/1.0.0/worker.mjs" }],
          },
        ],
      });
    });
    assert.equal(
      catalog.plugins[0].artifact,
      "https://raw.githubusercontent.com/acme/tactile/main/marketplace/dist/plugins/tactile.pdf/1.0.0/plugin.js",
    );
    assert.equal(
      catalog.plugins[0].assets[0].artifact,
      "https://raw.githubusercontent.com/acme/tactile/main/marketplace/dist/plugins/tactile.pdf/1.0.0/worker.mjs",
    );
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

test("marketplace install size and progress include the bundle and declared assets", async () => {
  const source = new TextEncoder().encode("export function activate() { return {}; }");
  const asset = new TextEncoder().encode("worker bytes");
  const entry = {
    status: "available",
    artifact: "/marketplace/plugin.js",
    size: source.byteLength,
    sha256: await sha256Hex(source),
    assets: [
      {
        file: "worker.mjs",
        artifact: "/marketplace/worker.mjs",
        size: asset.byteLength,
        sha256: await sha256Hex(asset),
      },
    ],
  };
  const progress = [];
  await downloadMarketplacePlugin(
    entry,
    async (url) => response(url.endsWith("worker.mjs") ? asset : source),
    (next) => progress.push(next),
  );
  assert.equal(marketplaceInstallSize(entry), source.byteLength + asset.byteLength);
  assert.equal(progress.at(-1).phase, "verified");
  assert.equal(progress.at(-1).loaded, marketplaceInstallSize(entry));
  assert.equal(progress.at(-1).total, marketplaceInstallSize(entry));
  assert.equal(
    progress.some((item) => item.phase === "verifying" && item.file === "worker.mjs"),
    true,
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
    assets: [
      {
        file: "worker.mjs",
        artifact: "/marketplace/worker.mjs",
        size: worker.byteLength,
        sha256: await sha256Hex(worker),
      },
    ],
  };
  const result = await downloadMarketplacePlugin(entry, async (url) =>
    response(url.endsWith("worker.mjs") ? worker : source),
  );
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
