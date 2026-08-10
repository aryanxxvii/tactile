import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import {
  createBlankWorkspace,
  createCellRecord,
  createEmbeddedObject,
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
  const childId = imported.objects.home.cells.r1c1.embed.objectId;
  assert.equal(imported.objects[childId].type, "markdown");
});
