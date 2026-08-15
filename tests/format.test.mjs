import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import {
  bareUrlTitle,
  createBlankWorkspace,
  createCellRecord,
  createEmbeddedLink,
  createEmbeddedObject,
  isBareUrlValue,
  usedSheetBounds,
} from "../src/model.js";
import {
  createTactileLink,
  parseCsv,
  parseSheetCsv,
  parseTactileLink,
  serializeSheetCsv,
  stringifyCsv,
} from "../src/format/csv.js";
import { buildPortablePackage, workspaceFromZip } from "../src/export.js";

test("CSV codec preserves commas, quotes, and line breaks", () => {
  const rows = [["plain", "comma, value", 'a "quote"', "two\nlines"]];
  assert.deepEqual(parseCsv(stringifyCsv(rows)), rows);
});

test("Tactile links remain human-readable and escape titles", () => {
  const link = createTactileLink("markdown", "text-123", "Plan | notes ] v2");
  assert.equal(link, "[[tactile:markdown:text-123|Plan \\| notes \\] v2]]");
  assert.deepEqual(parseTactileLink(link), {
    type: "markdown",
    objectId: "text-123",
    title: "Plan | notes ] v2",
  });
});

test("sheet export writes only the used range", () => {
  const workspace = createBlankWorkspace({ id: "test-workspace" });
  const sheet = workspace.objects.home;
  sheet.cells.r2c3 = createCellRecord(1, 2, { value: "last" });
  assert.deepEqual(usedSheetBounds(sheet), { rows: 2, columns: 3 });
  assert.equal(serializeSheetCsv(sheet, workspace), ",,\r\n,,last");
});

test("Files preferences round-trip inside the portable workspace settings", async () => {
  const workspace = createBlankWorkspace({ id: "files-settings-workspace" });
  workspace.settings.filesPinned = true;
  workspace.settings.filesWidth = 472;

  const packageData = buildPortablePackage(workspace);
  const exportedIndex = JSON.parse(packageData.files["workspace.json"]);
  assert.equal(exportedIndex.settings.filesPinned, true);
  assert.equal(exportedIndex.settings.filesWidth, 472);

  const zip = new JSZip();
  Object.entries(packageData.files).forEach(([path, value]) => zip.file(path, value));
  const imported = await workspaceFromZip(await zip.generateAsync({ type: "uint8array" }));
  assert.equal(imported.settings.filesPinned, true);
  assert.equal(imported.settings.filesWidth, 472);
});

test("embedded objects serialize as links and round-trip from a bundle", async () => {
  let workspace = createBlankWorkspace({ id: "test-workspace" });
  ({ workspace } = createEmbeddedObject(workspace, {
    parentObjectId: "home",
    parentCellId: "r1c1",
    type: "markdown",
  }));
  workspace.objects.home.rowGroups = [{ id: "group-1", start: 0, end: 2, collapsed: true }];
  workspace.objects.home.conditionalFormats = [{ id: "rule-1", range: "A1:A3", kind: "sign" }];
  workspace.objects.home.filters = [{ id: "filter-1", column: 0, value: "Text A1" }];
  workspace.objects.home.rowHeights = { 1: 42 };
  workspace.objects.home.columnWidths = { 2: 188 };
  workspace.objects.home.iconColor = "blue";
  const childObjectId = workspace.objects.home.cells.r1c1.embed.objectId;
  workspace.objects[childObjectId].iconEmoji = "🧠";
  const csv = serializeSheetCsv(workspace.objects.home, workspace);
  const parsedCells = parseSheetCsv(csv);
  assert.equal(parsedCells.r1c1.embed.type, "markdown");

  const packageData = buildPortablePackage(workspace);
  const zip = new JSZip();
  Object.entries(packageData.files).forEach(([path, value]) => zip.file(path, value));
  const bytes = await zip.generateAsync({ type: "uint8array" });
  const imported = await workspaceFromZip(bytes);
  assert.equal(imported.homeObjectId, "home");
  assert.equal(imported.objects.home.cells.r1c1.embed.type, "markdown");
  assert.deepEqual(imported.objects.home.rowGroups, workspace.objects.home.rowGroups);
  assert.deepEqual(imported.objects.home.conditionalFormats, workspace.objects.home.conditionalFormats);
  assert.deepEqual(imported.objects.home.filters, workspace.objects.home.filters);
  assert.deepEqual(imported.objects.home.rowHeights, workspace.objects.home.rowHeights);
  assert.deepEqual(imported.objects.home.columnWidths, workspace.objects.home.columnWidths);
  assert.equal(imported.objects.home.iconColor, "blue");
  const childId = imported.objects.home.cells.r1c1.embed.objectId;
  assert.equal(imported.objects[childId].type, "markdown");
  assert.equal(imported.objects[childId].iconEmoji, "🧠");
});

test("bare http(s) URLs are detected as link cells with host titles", () => {
  assert.equal(isBareUrlValue("https://example.com/path?q=1"), true);
  assert.equal(isBareUrlValue("http://example.com"), true);
  assert.equal(isBareUrlValue("   https://example.com  "), true);
  assert.equal(isBareUrlValue("example.com"), false);
  assert.equal(isBareUrlValue("https://"), false);
  assert.equal(isBareUrlValue("mailto:hi@example.com"), false);
  assert.equal(bareUrlTitle("https://Sub.Example.com/path"), "sub.example.com");
  assert.equal(bareUrlTitle("not-a-url"), "not-a-url");
});

test("a bare-URL cell materializes an embedded link object that round-trips from a bundle", async () => {
  let workspace = createBlankWorkspace({ id: "link-workspace" });
  let created;
  const parentCellId = "r1c2";
  ({ workspace, object: created } = createEmbeddedLink(workspace, {
    parentObjectId: "home",
    parentCellId,
    url: "https://example.com/docs",
  }));

  assert.equal(created.type, "link");
  assert.equal(created.url, "https://example.com/docs");
  assert.equal(created.title, "example.com");
  const cell = workspace.objects.home.cells[parentCellId];
  assert.equal(cell.embed.type, "link");
  assert.equal(cell.embed.objectId, created.id);
  assert.equal(cell.value, "example.com");
  assert.equal(created.parent.parentObjectId, "home");
  assert.equal(created.parent.sourceAddress, "B1");
  assert.equal(workspace.objects.home.cells[parentCellId].embed.objectId, created.id);

  const packageData = buildPortablePackage(workspace);
  const zip = new JSZip();
  Object.entries(packageData.files).forEach(([path, value]) => zip.file(path, value));
  const imported = await workspaceFromZip(await zip.generateAsync({ type: "uint8array" }));
  const importedCell = imported.objects.home.cells[parentCellId];
  assert.equal(importedCell.embed.type, "link");
  assert.equal(imported.objects[importedCell.embed.objectId].type, "link");
  assert.equal(imported.objects[importedCell.embed.objectId].url, "https://example.com/docs");
  assert.equal(imported.objects[importedCell.embed.objectId].title, "example.com");
});

test("portable workspaces preserve the containment path to a nested home", async () => {
  let workspace = createBlankWorkspace({ id: "nested-home-workspace" });
  ({ workspace } = createEmbeddedObject(workspace, {
    parentObjectId: "home",
    parentCellId: "r1c1",
    type: "markdown",
  }));
  const childId = workspace.objects.home.cells.r1c1.embed.objectId;
  workspace.homeObjectId = childId;
  workspace.homePath = [{ objectId: childId, sourceObjectId: "home", sourceAddress: "A1" }];

  const packageData = buildPortablePackage(workspace);
  const zip = new JSZip();
  Object.entries(packageData.files).forEach(([path, value]) => zip.file(path, value));
  const imported = await workspaceFromZip(await zip.generateAsync({ type: "uint8array" }));

  assert.equal(imported.homeObjectId, childId);
  assert.deepEqual(
    imported.homePath.map(({ objectId, sourceObjectId, sourceAddress }) => ({
      objectId,
      sourceObjectId,
      sourceAddress,
    })),
    workspace.homePath.map(({ objectId, sourceObjectId, sourceAddress }) => ({
      objectId,
      sourceObjectId,
      sourceAddress,
    })),
  );
  assert.equal(imported.homePath[0].linkId, imported.objects.home.cells.r1c1.embed.linkId);
});
