import assert from "node:assert/strict";
import test from "node:test";

import { buildFilesIndex, normalizeSearchText } from "../src/shell/filesIndex.js";
import {
  createBlankWorkspace,
  createCellRecord,
  createMarkdownObject,
  createSheetObject,
  normalizeWorkspace,
} from "../src/model.js";

function filesWorkspace() {
  const home = createSheetObject({ id: "home", title: "Home" });
  const other = createSheetObject({ id: "other", title: "Notes" });
  const child = createMarkdownObject({ id: "child", title: "Résumé" });
  const homeCell = createCellRecord(0, 0, {
    value: child.title,
    embed: { objectId: child.id, type: child.type, linkId: "home-child", relation: "containment" },
  });
  const aliasCell = createCellRecord(1, 1, {
    value: child.title,
    embed: { objectId: child.id, type: child.type, linkId: "other-child", relation: "alias" },
  });
  child.parent = {
    linkId: "home-child",
    parentObjectId: home.id,
    parentCellId: homeCell.id,
    sourceAddress: homeCell.address,
  };
  return normalizeWorkspace({
    ...createBlankWorkspace({ id: "files-test" }),
    homeObjectId: home.id,
    objects: {
      [home.id]: { ...home, cells: { [homeCell.id]: homeCell } },
      [other.id]: { ...other, cells: { [aliasCell.id]: aliasCell } },
      [child.id]: child,
    },
  });
}

test("Files index exposes canonical and alias locations without changing Home ordering", () => {
  const workspace = filesWorkspace();
  const index = buildFilesIndex(workspace);
  const child = index.entryByObjectId.get("child");

  assert.equal(index.roots[0], "home");
  assert.equal(child.canonical.rootObjectId, "home");
  assert.equal(child.canonical.segments.at(-1).linkId, "home-child");
  assert.equal(child.aliases.length, 1);
  assert.equal(child.aliases[0].segments.at(-1).linkId, "other-child");
  assert.equal(child.aliases[0].rootObjectId, "other");

  const changedHome = normalizeWorkspace({ ...workspace, homeObjectId: "other", homePath: [] });
  assert.equal(changedHome.objects.child.parent.parentObjectId, "home");
  assert.equal(buildFilesIndex(changedHome).roots[0], "other");
});

test("Files search ranks identity metadata and ignores case and accents", () => {
  const index = buildFilesIndex(filesWorkspace());
  assert.equal(normalizeSearchText("Résumé"), "resume");
  assert.equal(index.search("resume")[0].objectId, "child");
  assert.equal(index.search("tiles")[0].type, "sheet");
  assert.deepEqual(index.search("does-not-exist"), []);
});

test("ordinary metadata edits reuse the cached topology graph", () => {
  const workspace = filesWorkspace();
  const index = buildFilesIndex(workspace);
  const changed = {
    ...workspace,
    objects: {
      ...workspace.objects,
      child: { ...workspace.objects.child, title: "Renamed notes" },
    },
  };
  const next = buildFilesIndex(changed, index);
  assert.strictEqual(next.topology, index.topology);
  assert.equal(next.entryByObjectId.get("child").title, "Renamed notes");
});

test("Files distinguishes ordinary Tiles, the root Home Tiles, and the selected Start object", () => {
  const workspace = filesWorkspace();
  const index = buildFilesIndex(workspace);
  const ordinaryTiles = index.entryByObjectId.get("other");
  const homeTiles = index.entryByObjectId.get("home");

  assert.equal(ordinaryTiles.typeLabel, "Tiles");
  assert.equal(ordinaryTiles.isRoot, true);
  assert.equal(ordinaryTiles.isStart, false);
  assert.equal(homeTiles.typeLabel, "Tiles");
  assert.equal(homeTiles.isRoot, true);
  assert.equal(homeTiles.isStart, true);

  const startedFromOther = normalizeWorkspace({
    ...workspace,
    homeObjectId: "other",
    homePath: [],
  });
  const startedIndex = buildFilesIndex(startedFromOther);
  const startedTiles = startedIndex.entryByObjectId.get("other");
  const stillRootHome = startedIndex.entryByObjectId.get("home");

  assert.equal(startedTiles.typeLabel, "Tiles");
  assert.equal(startedTiles.isRoot, true);
  assert.equal(startedTiles.isStart, true);
  assert.equal(stillRootHome.isRoot, true);
  assert.equal(stillRootHome.isStart, false);

  const startedFromNestedObject = normalizeWorkspace({
    ...workspace,
    homeObjectId: "child",
    homePath: [],
  });
  const nestedStartIndex = buildFilesIndex(startedFromNestedObject);
  const nestedStart = nestedStartIndex.entryByObjectId.get("child");

  assert.equal(nestedStart.isRoot, false);
  assert.equal(nestedStart.isStart, true);
  assert.equal(nestedStartIndex.roots[0], "home");
});

test("Files index carries object icon customizations without changing topology", () => {
  const workspace = filesWorkspace();
  workspace.objects.child.iconEmoji = "🧠";
  workspace.objects.home.iconColor = "blue";
  const index = buildFilesIndex(workspace);

  assert.equal(index.entryByObjectId.get("child").iconEmoji, "🧠");
  assert.equal(index.entryByObjectId.get("home").iconColor, "blue");
});
