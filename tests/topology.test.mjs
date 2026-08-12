import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalPathForObject,
  repairObjectTopology,
  routeFromLinkIds,
  validateNavigationRoute,
} from "../src/core/topology.js";
import { createBlankWorkspace, createCellRecord, createSheetObject, normalizeWorkspace } from "../src/model.js";

function workspaceWithObjects(order = ["home", "alpha", "beta", "child"]) {
  const objects = {
    home: createSheetObject({ id: "home", title: "Home" }),
    alpha: createSheetObject({ id: "alpha", title: "Alpha" }),
    beta: createSheetObject({ id: "beta", title: "Beta" }),
    child: createSheetObject({ id: "child", title: "Child" }),
  };
  objects.home.cells.r1c1 = createCellRecord(0, 0, {
    value: "Alpha",
    embed: { objectId: "alpha", type: "sheet" },
  });
  objects.beta.cells.r2c2 = createCellRecord(1, 1, {
    value: "Child",
    embed: { objectId: "child", type: "sheet" },
  });
  objects.alpha.cells.r3c3 = createCellRecord(2, 2, {
    value: "Child",
    embed: { objectId: "child", type: "sheet" },
  });
  return {
    ...createBlankWorkspace({ id: "topology-test" }),
    objects: Object.fromEntries(order.map((id) => [id, objects[id]])),
  };
}

test("legacy embeds receive stable link ids and explicit parent records", () => {
  const workspace = normalizeWorkspace(workspaceWithObjects());
  const child = workspace.objects.child;
  const parentCell = workspace.objects[child.parent.parentObjectId].cells[child.parent.parentCellId];

  assert.equal(child.parent.parentObjectId, "alpha");
  assert.equal(child.parent.sourceAddress, "C3");
  assert.equal(parentCell.embed.linkId, child.parent.linkId);
  assert.equal(parentCell.embed.relation, "containment");
  assert.equal(workspace.homePath.length, 0);
  assert.deepEqual(normalizeWorkspace(workspace).objects.child.parent, child.parent);
});

test("multiple parents are deterministic and a saved route can select an alias", () => {
  const first = normalizeWorkspace(workspaceWithObjects(["home", "alpha", "beta", "child"]));
  const reordered = normalizeWorkspace(workspaceWithObjects(["child", "beta", "home", "alpha"]));
  assert.equal(first.objects.child.parent.parentObjectId, reordered.objects.child.parent.parentObjectId);

  const preferred = normalizeWorkspace({
    ...workspaceWithObjects(),
    homeObjectId: "child",
    homePath: [{ objectId: "child", sourceObjectId: "beta", sourceAddress: "B2" }],
  });
  assert.equal(preferred.objects.child.parent.parentObjectId, "beta");
  assert.equal(preferred.objects.beta.cells.r2c2.embed.relation, "containment");
  assert.equal(preferred.objects.alpha.cells.r3c3.embed.relation, "alias");
  assert.equal(preferred.homePath[0].linkId, preferred.objects.child.parent.linkId);
});

test("cycle repair demotes the edge that would close the cycle", () => {
  const objects = {
    a: createSheetObject({ id: "a" }),
    b: createSheetObject({ id: "b" }),
  };
  objects.a.cells.r1c1 = createCellRecord(0, 0, { embed: { objectId: "b", type: "sheet" } });
  objects.b.cells.r1c1 = createCellRecord(0, 0, { embed: { objectId: "a", type: "sheet" } });
  const repaired = repairObjectTopology(objects);

  assert.equal(repaired.objects.a.parent.parentObjectId, "b");
  assert.equal(repaired.objects.b.parent, null);
  assert.equal(repaired.objects.a.cells.r1c1.embed.relation, "alias");
  assert.equal(repaired.objects.b.cells.r1c1.embed.relation, "containment");
});

test("moving a source cell keeps its link and updates the child parent address", () => {
  const workspace = normalizeWorkspace(workspaceWithObjects());
  const child = workspace.objects.child;
  const oldEmbed = workspace.objects.alpha.cells.r3c3.embed;
  const movedAlpha = {
    ...workspace.objects.alpha,
    cells: {
      r8c4: createCellRecord(7, 3, { value: "Child", embed: oldEmbed }),
    },
  };
  const moved = normalizeWorkspace({
    ...workspace,
    objects: { ...workspace.objects, alpha: movedAlpha },
  });

  assert.equal(moved.objects.child.parent.linkId, child.parent.linkId);
  assert.equal(moved.objects.child.parent.parentCellId, "r8c4");
  assert.equal(moved.objects.child.parent.sourceAddress, "D8");
});

test("route validation rejects stale or non-adjacent history and link routes reopen exactly", () => {
  const workspace = normalizeWorkspace(workspaceWithObjects());
  const path = canonicalPathForObject(workspace.objects, "child");
  const route = validateNavigationRoute(workspace.objects, path);
  assert.equal(route.valid, true);
  assert.deepEqual(
    route.stack.map((entry) => entry.linkId),
    path.map((entry) => entry.linkId),
  );
  assert.equal(
    routeFromLinkIds(
      workspace.objects,
      path.map((entry) => entry.linkId),
      "full",
    ).valid,
    true,
  );

  const stale = validateNavigationRoute(workspace.objects, [
    ...path.slice(0, 1),
    { ...path[1], sourceObjectId: "missing-parent" },
  ]);
  assert.equal(stale.valid, false);
  assert.equal(stale.stack.length, 1);
  assert.equal(validateNavigationRoute(workspace.objects, [{ ...path[1], linkId: "missing-link" }]).valid, false);
});
