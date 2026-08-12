import assert from "node:assert/strict";
import test from "node:test";

import { createBlankWorkspace, createCellRecord, createSheetObject, normalizeWorkspace } from "../src/model.js";
import { deriveObjectPath, homeStackFromWorkspace, resolveHomePath } from "../src/shell/inOut.js";

function nestedWorkspace() {
  const workspace = createBlankWorkspace({ id: "navigation-test" });
  const root = workspace.objects.home;
  const child = createSheetObject({ id: "child", title: "Child" });
  const grandchild = createSheetObject({ id: "grandchild", title: "Grandchild" });
  root.cells.r1c1 = createCellRecord(0, 0, {
    value: child.title,
    embed: { objectId: child.id, type: child.type },
  });
  child.cells.r2c2 = createCellRecord(1, 1, {
    value: grandchild.title,
    embed: { objectId: grandchild.id, type: grandchild.type },
  });
  workspace.objects = { [root.id]: root, [child.id]: child, [grandchild.id]: grandchild };
  return workspace;
}

test("derives the full containment path for an older nested home", () => {
  const workspace = nestedWorkspace();
  workspace.homeObjectId = "grandchild";

  assert.deepEqual(
    deriveObjectPath(workspace.objects, "grandchild").map(({ objectId, sourceObjectId, sourceAddress }) => ({
      objectId,
      sourceObjectId,
      sourceAddress,
    })),
    [
      { objectId: "child", sourceObjectId: "home", sourceAddress: "A1" },
      { objectId: "grandchild", sourceObjectId: "child", sourceAddress: "B2" },
    ],
  );
  const normalized = normalizeWorkspace(workspace);
  assert.equal(normalized.objects.child.parent.parentObjectId, "home");
  assert.equal(normalized.objects.grandchild.parent.parentObjectId, "child");
  assert.equal(normalized.objects.home.cells.r1c1.embed.relation, "containment");
  assert.deepEqual(
    homeStackFromWorkspace(workspace).map((entry) => entry.mode),
    ["full", "full"],
  );
});

test("preserves a saved home route when an object has multiple parents", () => {
  const workspace = nestedWorkspace();
  const alternate = createSheetObject({ id: "alternate", title: "Alternate" });
  alternate.cells.r3c3 = createCellRecord(2, 2, {
    value: "Grandchild",
    embed: { objectId: "grandchild", type: "sheet" },
  });
  workspace.objects = {
    home: workspace.objects.home,
    child: workspace.objects.child,
    alternate,
    grandchild: workspace.objects.grandchild,
  };

  assert.deepEqual(
    resolveHomePath(workspace.objects, "grandchild", [
      { objectId: "grandchild", sourceObjectId: "alternate", sourceAddress: "C3" },
    ]).map(({ objectId, sourceObjectId, sourceAddress }) => ({
      objectId,
      sourceObjectId,
      sourceAddress,
    })),
    [{ objectId: "grandchild", sourceObjectId: "alternate", sourceAddress: "C3" }],
  );
});
