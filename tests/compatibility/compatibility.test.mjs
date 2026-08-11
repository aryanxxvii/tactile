import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildPortableV4Package,
  migratePortableWorkspace,
  portablePackageToZip,
  readPortableV4Package,
  validatePortableWorkspace,
} from "../../src/compat/index.js";
import {
  makeDanglingReferenceFixture,
  makeDuplicateObjectIdFixture,
  makeMalformedFixture,
  makeOversizedAssetFixture,
  makeUnsupportedVersionFixture,
  SMALL_ASSET_LIMITS,
} from "../fixtures/invalid-compatibility-workspaces.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = path.resolve(here, "../fixtures");

async function readFixture(version) {
  return JSON.parse(await readFile(path.join(fixtureDirectory, `compatibility-v${version}.json`), "utf8"));
}

function legacyLossyProjection(workspace) {
  return {
    version: workspace.version,
    id: workspace.id,
    name: workspace.name,
    homeObjectId: workspace.homeObjectId,
    objects: Object.fromEntries(
      Object.entries(workspace.objects).map(([objectId, object]) => [
        objectId,
        {
          id: object.id,
          type: object.type,
          title: object.title,
          cells:
            object.type === "sheet"
              ? Object.fromEntries(
                  Object.entries(object.cells || {}).map(([cellId, cell]) => [
                    cellId,
                    {
                      id: cell.id,
                      address: cell.address,
                      value: cell.value,
                      formula: cell.formula,
                      embed: cell.embed,
                    },
                  ]),
                )
              : undefined,
        },
      ]),
    ),
    themes: Object.fromEntries(
      Object.entries(workspace.themes).map(([themeId, theme]) => [
        themeId,
        {
          id: theme.id,
          name: theme.name,
          tokens: {
            paper: theme.tokens.paper,
            tray: theme.tokens.tray,
            ink: theme.tokens.ink,
            accent: theme.tokens.accent,
          },
        },
      ]),
    ),
  };
}

test("golden v1-v4 fixtures migrate sequentially to the v4 contract", async () => {
  for (const version of [1, 2, 3, 4]) {
    const fixture = await readFixture(version);
    const migrated = migratePortableWorkspace(fixture);
    const home = migrated.objects["sheet-home"];
    const titleCell = home.cells["r1c1"];

    assert.equal(migrated.version, 4);
    assert.equal(migrated.format, "tactile");
    assert.equal(migrated.homeObjectId, "sheet-home");
    assert.equal(migrated.objects["doc-spec"].type, "markdown");
    assert.equal(home.rows >= 256, true);
    assert.equal(home.columns >= 64, true);
    assert.equal(titleCell.role, "heading");
    assert.equal(titleCell.validation.kind, "list");
    assert.equal(titleCell.note, "Canonical project label.");
    assert.deepEqual(titleCell["x-cell-plugin"], {
      owner: "compatibility-fixture",
      ordinal: 1,
    });
    assert.equal(migrated["x-workspace-plugin"].preserve, true);
    assert.equal(migrated.themes["theme-paper"].tokens.futureToken, "#00d4a8");
    assert.deepEqual(migrated.themes["theme-paper"].tokens.futureMetrics, { cornerRadius: 9 });
  }
});

test("the compatibility path preserves metadata that a legacy projection drops", async () => {
  const fixture = await readFixture(4);
  const lossy = legacyLossyProjection(fixture);
  assert.equal(lossy.objects["sheet-home"].cells["r1c1"].role, undefined);
  assert.equal(lossy["x-workspace-plugin"], undefined);

  const migrated = migratePortableWorkspace(fixture);
  assert.equal(migrated.objects["sheet-home"].cells["r1c1"].role, "heading");
  assert.equal(migrated["x-workspace-plugin"].schema, "demo.workspace.v1");
  assert.equal(migrated.objects["image-ref"]["x-object-plugin"].altPolicy, "title");
});

test("malformed, oversized, duplicate, and dangling fixtures fail safely", async () => {
  const golden = await readFixture(4);
  const cases = [
    [makeMalformedFixture(), "MALFORMED_OBJECTS"],
    [makeOversizedAssetFixture(golden), "OVERSIZED_ASSET"],
    [makeDuplicateObjectIdFixture(golden), "DUPLICATE_ID"],
    [makeDanglingReferenceFixture(golden), "DANGLING_REFERENCE"],
  ];

  for (const [fixture, code] of cases) {
    assert.throws(
      () => validatePortableWorkspace(fixture, { limits: SMALL_ASSET_LIMITS }),
      (error) => {
        assert.equal(error.code, code);
        return true;
      },
    );
  }
});

test("newer unsupported formats are rejected without destructive normalization", async () => {
  const golden = await readFixture(4);
  const unsupported = makeUnsupportedVersionFixture(golden);
  const before = structuredClone(unsupported);

  assert.throws(
    () => migratePortableWorkspace(unsupported),
    (error) => {
      assert.equal(error.code, "UNSUPPORTED_VERSION");
      return true;
    },
  );
  assert.deepEqual(unsupported, before);
});

test("v4 portable package round-trips nested metadata and binary asset records", async () => {
  const fixture = await readFixture(4);
  const packageData = buildPortableV4Package(fixture, {
    manifestMetadata: { "x-manifest-plugin": { preserve: true } },
  });
  const workspaceIndex = JSON.parse(packageData.files["workspace.json"]);
  const home = workspaceIndex.objects.find((object) => object.id === "sheet-home");

  assert.equal(workspaceIndex["x-workspace-plugin"].schema, "demo.workspace.v1");
  assert.equal(home["x-object-plugin"].panel, "milestones");
  assert.equal(packageData.manifest["x-manifest-plugin"].preserve, true);
  assert.equal(packageData.files["objects/sheet-home/sheet.meta.json"] !== undefined, true);
  assert.equal(packageData.files["objects/image-ref/content.png"] !== undefined, true);

  const zip = await portablePackageToZip(packageData);
  const result = await readPortableV4Package(zip);
  assert.equal(result.workspace.objects["sheet-home"].cells["r1c1"].role, "heading");
  assert.equal(result.workspace.objects["sheet-home"]["x-object-plugin"].panel, "milestones");
  assert.equal(result.workspace["x-workspace-plugin"].preserve, true);
  assert.equal(result.manifest["x-manifest-plugin"].preserve, true);
});
