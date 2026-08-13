import assert from "node:assert/strict";
import test from "node:test";

import { buildFilesIndex, normalizeSearchText, validateObjectTitle } from "../src/shell/filesIndex.js";
import {
  createBlankWorkspace,
  createCellRecord,
  createMarkdownObject,
  createSheetObject,
  deleteObjectFromWorkspace,
  normalizeWorkspace,
} from "../src/model.js";
import { validateNavigationRoute } from "../src/core/topology.js";

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

test("Files deletion removes canonical descendants and aliases while protecting Home and Start", () => {
  const workspace = createBlankWorkspace({ id: "delete-files-test" });
  const home = workspace.objects.home;
  const other = createSheetObject({ id: "other", title: "Other" });
  const branch = createSheetObject({ id: "branch", title: "Branch" });
  const leaf = { ...createMarkdownObject({ id: "leaf", title: "Leaf" }), assetId: "leaf-asset" };
  const homeCell = createCellRecord(0, 0, {
    value: branch.title,
    embed: { objectId: branch.id, type: branch.type, linkId: "home-branch", relation: "containment" },
  });
  const aliasCell = createCellRecord(1, 1, {
    value: branch.title,
    embed: { objectId: branch.id, type: branch.type, linkId: "other-branch", relation: "alias" },
  });
  const leafCell = createCellRecord(2, 2, {
    value: leaf.title,
    embed: { objectId: leaf.id, type: leaf.type, linkId: "branch-leaf", relation: "containment" },
  });
  branch.parent = {
    linkId: "home-branch",
    parentObjectId: home.id,
    parentCellId: homeCell.id,
    sourceAddress: homeCell.address,
  };
  leaf.parent = {
    linkId: "branch-leaf",
    parentObjectId: branch.id,
    parentCellId: leafCell.id,
    sourceAddress: leafCell.address,
  };
  home.cells = { [homeCell.id]: homeCell };
  other.cells = { [aliasCell.id]: aliasCell };
  branch.cells = { [leafCell.id]: leafCell };
  workspace.objects = { home, other, branch, leaf };
  workspace.assets = { "leaf-asset": { id: "leaf-asset", fileName: "leaf.pdf" } };

  const normalized = normalizeWorkspace(workspace);
  const index = buildFilesIndex(normalized);
  const oldRoute = index.entryByObjectId.get("branch").canonical.segments;

  assert.equal(index.entryByObjectId.get("branch").canDelete, true);
  assert.equal(index.entryByObjectId.get("home").canDelete, false);

  const deleted = deleteObjectFromWorkspace(normalized, "branch");
  assert.deepEqual(Object.keys(deleted.objects).sort(), ["home", "other"]);
  assert.equal(deleted.objects.home.cells.r1c1, undefined);
  assert.equal(deleted.objects.other.cells.r2c2, undefined);
  assert.equal(deleted.assets["leaf-asset"], undefined);
  assert.equal(buildFilesIndex(deleted).entryByObjectId.has("branch"), false);
  assert.equal(validateNavigationRoute(deleted.objects, oldRoute).valid, false);

  const startedInBranch = normalizeWorkspace({ ...normalized, homeObjectId: "branch", homePath: [] });
  assert.equal(buildFilesIndex(startedInBranch).entryByObjectId.get("branch").canDelete, false);
  assert.equal(buildFilesIndex(startedInBranch).entryByObjectId.get("home").canDelete, false);
  assert.strictEqual(deleteObjectFromWorkspace(startedInBranch, "branch"), startedInBranch);

  const startedInLeaf = normalizeWorkspace({ ...normalized, homeObjectId: "leaf", homePath: [] });
  assert.equal(buildFilesIndex(startedInLeaf).entryByObjectId.get("branch").canDelete, false);
  assert.equal(buildFilesIndex(startedInLeaf).entryByObjectId.get("branch").deleteReason, "Contains current start");
  assert.equal(buildFilesIndex(startedInLeaf).entryByObjectId.get("leaf").canDelete, false);
  assert.strictEqual(deleteObjectFromWorkspace(startedInLeaf, "branch"), startedInLeaf);
});

test("Files rename validation trims names and rejects empty or duplicate titles", () => {
  const index = buildFilesIndex(filesWorkspace());

  assert.equal(validateObjectTitle(index, "child", "  ").code, "empty");
  assert.equal(validateObjectTitle(index, "child", " HOME ").code, "duplicate");
  assert.deepEqual(validateObjectTitle(index, "child", "  Project notes  "), {
    valid: true,
    code: "",
    title: "Project notes",
    message: "",
  });
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
