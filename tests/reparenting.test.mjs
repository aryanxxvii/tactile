import assert from "node:assert/strict";
import test from "node:test";

import {
  createBlankWorkspace,
  createCellRecord,
  createMarkdownObject,
  createSheetObject,
  normalizeWorkspace,
} from "../src/model.js";
import { reparentWorkspace, REPARENT_REASONS } from "../src/core/reparenting.js";
import { canonicalPathForObject, validateNavigationRoute } from "../src/core/topology.js";
import { buildFilesIndex } from "../src/shell/filesIndex.js";
import { historyStackFromState, HISTORY_KIND } from "../src/shell/inOut.js";

function embeddedCell(row, column, object, linkId, relation = "containment") {
  return createCellRecord(row, column, {
    value: object.title,
    embed: {
      objectId: object.id,
      type: object.type,
      linkId,
      relation,
    },
  });
}

function reparentFixture() {
  const home = createSheetObject({ id: "home", title: "Home" });
  const parent = createSheetObject({ id: "parent", title: "Parent" });
  const alternate = createSheetObject({ id: "alternate", title: "Alternate" });
  const destination = createSheetObject({ id: "destination", title: "Destination" });
  const child = createSheetObject({ id: "child", title: "Child" });
  const leaf = createMarkdownObject({ id: "leaf", title: "Leaf", content: "Nested content" });

  const homeParent = embeddedCell(0, 0, parent, "home-parent");
  const parentChild = embeddedCell(0, 0, child, "parent-child");
  const alternateChild = embeddedCell(0, 0, child, "alternate-child", "alias");
  const childLeaf = embeddedCell(0, 0, leaf, "child-leaf");
  home.cells = { [homeParent.id]: homeParent };
  parent.cells = { [parentChild.id]: parentChild };
  alternate.cells = { [alternateChild.id]: alternateChild };
  child.cells = { [childLeaf.id]: childLeaf };
  parent.parent = {
    linkId: "home-parent",
    parentObjectId: "home",
    parentCellId: homeParent.id,
    sourceAddress: homeParent.address,
  };
  child.parent = {
    linkId: "parent-child",
    parentObjectId: "parent",
    parentCellId: parentChild.id,
    sourceAddress: parentChild.address,
  };
  leaf.parent = {
    linkId: "child-leaf",
    parentObjectId: "child",
    parentCellId: childLeaf.id,
    sourceAddress: childLeaf.address,
  };

  return normalizeWorkspace({
    ...createBlankWorkspace({ id: "reparent-test" }),
    name: "Reparent test",
    homeObjectId: home.id,
    objects: {
      [home.id]: home,
      [parent.id]: parent,
      [alternate.id]: alternate,
      [destination.id]: destination,
      [child.id]: child,
      [leaf.id]: leaf,
    },
  });
}

function canonicalSource(objectId, linkId, sourceObjectId, sourceCellId, sourceAddress) {
  return { objectId, linkId, sourceObjectId, sourceCellId, sourceAddress };
}

test("canonical reparenting moves one embed, keeps link identity, descendants, Files paths, and routes", () => {
  const workspace = reparentFixture();
  const result = reparentWorkspace(workspace, {
    objectId: "child",
    source: canonicalSource("child", "parent-child", "parent", "r1c1", "A1"),
    target: { parentObjectId: "destination", address: "B2" },
  });

  assert.equal(result.ok, true);
  assert.equal(result.linkId, "parent-child");
  assert.equal(result.workspace.objects.parent.cells.r1c1, undefined);
  assert.equal(result.workspace.objects.destination.cells.r2c2.embed.objectId, "child");
  assert.equal(result.workspace.objects.destination.cells.r2c2.embed.linkId, "parent-child");
  assert.equal(result.workspace.objects.destination.cells.r2c2.embed.relation, "containment");
  assert.deepEqual(result.workspace.objects.child.parent, {
    linkId: "parent-child",
    parentObjectId: "destination",
    parentCellId: "r2c2",
    sourceAddress: "B2",
  });
  assert.equal(result.workspace.objects.child.cells.r1c1.embed.linkId, "child-leaf");
  assert.equal(result.workspace.objects.leaf.parent.parentObjectId, "child");

  const path = canonicalPathForObject(result.workspace.objects, "leaf");
  assert.deepEqual(
    path.map(({ objectId, linkId, sourceObjectId, sourceAddress }) => ({
      objectId,
      linkId,
      sourceObjectId,
      sourceAddress,
    })),
    [
      { objectId: "child", linkId: "parent-child", sourceObjectId: "destination", sourceAddress: "B2" },
      { objectId: "leaf", linkId: "child-leaf", sourceObjectId: "child", sourceAddress: "A1" },
    ],
  );
  assert.equal(validateNavigationRoute(result.workspace.objects, path).valid, true);

  const filesChild = buildFilesIndex(result.workspace).entryByObjectId.get("child");
  assert.equal(filesChild.canonical.pathLabel, "Destination / Child");
  assert.equal(filesChild.aliases[0].pathLabel, "Alternate / Child");

  const rebased = historyStackFromState(
    {
      tactile: HISTORY_KIND,
      tactileWorkspaceId: workspace.id,
      tactileStack: [
        {
          objectId: "child",
          linkId: "parent-child",
          sourceObjectId: "parent",
          sourceCellId: "r1c1",
          sourceAddress: "A1",
          mode: "full",
        },
      ],
    },
    result.workspace.objects,
    workspace.id,
  );
  assert.deepEqual(rebased[0], {
    objectId: "child",
    linkId: "parent-child",
    sourceObjectId: "destination",
    sourceCellId: "r2c2",
    sourceAddress: "B2",
    sourceLabel: "Child",
    sourceType: "sheet",
    mode: "full",
  });
});

test("alias reparenting moves only the selected location and leaves canonical parent navigation intact", () => {
  const workspace = reparentFixture();
  const result = reparentWorkspace(workspace, {
    objectId: "child",
    source: canonicalSource("child", "alternate-child", "alternate", "r1c1", "A1"),
    target: { parentObjectId: "destination", address: "C3" },
  });

  assert.equal(result.ok, true);
  assert.equal(result.linkId, "alternate-child");
  assert.equal(result.relation, "alias");
  assert.equal(result.workspace.objects.alternate.cells.r1c1, undefined);
  assert.equal(result.workspace.objects.destination.cells.r3c3.embed.linkId, "alternate-child");
  assert.equal(result.workspace.objects.destination.cells.r3c3.embed.relation, "alias");
  assert.equal(result.workspace.objects.child.parent.parentObjectId, "parent");
  assert.equal(result.workspace.objects.child.parent.linkId, "parent-child");

  const childEntry = buildFilesIndex(result.workspace).entryByObjectId.get("child");
  assert.equal(childEntry.canonical.pathLabel, "Home / Parent / Child");
  assert.equal(
    childEntry.aliases.some((location) => location.pathLabel === "Destination / Child"),
    true,
  );
});

test("reparenting rejects cycles and occupied sheet positions without mutating the workspace", () => {
  const workspace = reparentFixture();
  const cycle = reparentWorkspace(workspace, {
    objectId: "parent",
    source: canonicalSource("parent", "home-parent", "home", "r1c1", "A1"),
    target: { parentObjectId: "child", address: "A2" },
  });
  assert.equal(cycle.ok, false);
  assert.equal(cycle.reason, REPARENT_REASONS.CYCLE);
  assert.strictEqual(cycle.workspace, workspace);

  const occupiedDestination = {
    ...workspace.objects.destination,
    cells: { r1c1: createCellRecord(0, 0, { value: "Taken" }) },
  };
  const occupiedWorkspace = normalizeWorkspace({
    ...workspace,
    objects: { ...workspace.objects, destination: occupiedDestination },
  });
  const occupied = reparentWorkspace(occupiedWorkspace, {
    objectId: "child",
    source: canonicalSource("child", "parent-child", "parent", "r1c1", "A1"),
    target: { parentObjectId: "destination", address: "A1" },
  });
  assert.equal(occupied.ok, false);
  assert.equal(occupied.reason, REPARENT_REASONS.TARGET_OCCUPIED);
  assert.strictEqual(occupied.workspace, occupiedWorkspace);
});

test("a parentless object gets a stable link when placed, and keeps it on later moves", () => {
  const workspace = reparentFixture();
  const loose = createMarkdownObject({ id: "loose", title: "Loose" });
  const withLoose = normalizeWorkspace({
    ...workspace,
    objects: { ...workspace.objects, loose },
  });
  const first = reparentWorkspace(withLoose, {
    objectId: "loose",
    target: { parentObjectId: "destination" },
  });
  assert.equal(first.ok, true);
  assert.equal(first.targetAddress, "A1");
  assert.match(first.linkId, /^link-/);
  assert.equal(first.workspace.objects.loose.parent.parentObjectId, "destination");

  const second = reparentWorkspace(first.workspace, {
    objectId: "loose",
    source: canonicalSource("loose", first.linkId, "destination", "r1c1", "A1"),
    target: { parentObjectId: "destination", address: "B1" },
  });
  assert.equal(second.ok, true);
  assert.equal(second.linkId, first.linkId);
  assert.equal(second.workspace.objects.destination.cells.r1c1, undefined);
  assert.equal(second.workspace.objects.destination.cells.r1c2.embed.linkId, first.linkId);
});
