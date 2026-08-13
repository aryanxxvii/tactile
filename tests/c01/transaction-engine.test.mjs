import assert from "node:assert/strict";
import test from "node:test";

import { createBlankWorkspace, createObjectForType } from "../../src/core/model.ts";
import {
  compareEngineSnapshots,
  createLegacySnapshotAdapter,
  createWorkspaceEngine,
  runDifferentialSequence,
} from "../../src/core/engine/index.ts";

function command(type, payload, sequence = 1, source = "keyboard") {
  return {
    commandId: `command-${sequence}`,
    issuedAt: `2026-08-13T10:00:${String(sequence).padStart(2, "0")}.000Z`,
    source,
    type,
    ...payload,
  };
}

function workspaceWithSibling() {
  const workspace = createBlankWorkspace({ id: "c01-workspace", name: "C01" });
  const sibling = createObjectForType("markdown", { id: "notes", title: "Notes" });
  workspace.objects[sibling.id] = sibling;
  return workspace;
}

test("cell writes stay normalized and avoid cloning unrelated records or the sparse cell map", async () => {
  const engine = createWorkspaceEngine(workspaceWithSibling());
  const normalizedSheet = engine.store.getSheet("home");
  const beforeSibling = engine.getObject("notes");
  const beforeSnapshot = engine.getSnapshot();

  await engine.dispatch(
    command("set-cell", {
      objectId: "home",
      cellId: "r1c1",
      patch: { value: "Hello" },
    }),
  );

  assert.equal(engine.store.getSheet("home"), normalizedSheet);
  assert.equal(engine.store.getSheet("home").cells, normalizedSheet.cells);
  assert.equal(engine.getObject("notes"), beforeSibling);
  assert.notEqual(engine.getSnapshot(), beforeSnapshot);
  assert.equal(engine.getObject("home").cells.r1c1.value, "Hello");
  assert.equal(engine.getStoreCounts().cells, 1);
});

test("patch compression keeps one final operation when a record returns to baseline", async () => {
  const engine = createWorkspaceEngine(workspaceWithSibling());

  const result = await engine.dispatchBatch([
    command("set-cell", { objectId: "home", cellId: "r1c1", patch: { value: "A" } }, 1),
    command("set-cell", { objectId: "home", cellId: "r1c1", patch: { value: "" } }, 2),
    command("set-cell", { objectId: "home", cellId: "r1c1", patch: { value: "B" } }, 3),
  ]);

  assert.equal(result.forwardPatch.operations.length, 2);
  const cellOperation = result.forwardPatch.operations.find((operation) => operation.kind === "replace-cell");
  assert.ok(cellOperation);
  assert.equal(cellOperation.before, null);
  assert.equal(cellOperation.after.value, "B");
  assert.equal(engine.getUndoDepth(), 1);
});

test("selector listeners are batched and unrelated object selectors stay quiet", async () => {
  const engine = createWorkspaceEngine(workspaceWithSibling());
  let homeNotifications = 0;
  let siblingNotifications = 0;
  const stopHome = engine.subscribe(
    (snapshot) => snapshot.objects.home,
    () => {
      homeNotifications += 1;
    },
  );
  const stopSibling = engine.subscribe(
    (snapshot) => snapshot.objects.notes,
    () => {
      siblingNotifications += 1;
    },
  );

  await engine.dispatchBatch([
    command("set-cell", { objectId: "home", cellId: "r1c1", patch: { value: "A" } }, 1),
    command("set-cell", { objectId: "home", cellId: "r1c2", patch: { value: "B" } }, 2),
  ]);

  assert.equal(homeNotifications, 1);
  assert.equal(siblingNotifications, 0);
  stopHome();
  stopSibling();
});

test("one explicit text edit session produces one patch-history entry", async () => {
  const engine = createWorkspaceEngine(workspaceWithSibling());
  const session = engine.beginTextEditSession("home", "r1c1", "title-edit");

  await engine.dispatch(command("set-cell", { objectId: "home", cellId: "r1c1", patch: { value: "T" } }, 1));
  await engine.dispatch(command("set-cell", { objectId: "home", cellId: "r1c1", patch: { value: "Ta" } }, 2));
  await engine.dispatch(command("set-cell", { objectId: "home", cellId: "r1c1", patch: { value: "Tactile" } }, 3));
  engine.endTextEditSession(session);

  assert.equal(engine.getUndoDepth(), 1);
  await engine.undo();
  assert.equal(engine.getObject("home").cells.r1c1, undefined);
  assert.equal(engine.getRedoDepth(), 1);
  await engine.redo();
  assert.equal(engine.getObject("home").cells.r1c1.value, "Tactile");
});

test("forward and inverse patches expose dirty record scope", async () => {
  const engine = createWorkspaceEngine(workspaceWithSibling());
  const result = await engine.dispatch(
    command("set-cell", {
      objectId: "home",
      cellId: "r3c4",
      patch: { value: "Scoped" },
    }),
  );

  assert.equal(
    result.forwardPatch.operations.some((operation) => operation.kind === "replace-cell"),
    true,
  );
  assert.equal(
    result.inversePatch.operations.some((operation) => operation.kind === "replace-cell"),
    true,
  );
  assert.deepEqual(result.changedObjectIds, ["home"]);
  assert.deepEqual(result.changedCellIds, ["r3c4"]);
  assert.equal(
    result.dirtyRecords.some((record) => record.recordType === "cell" && record.objectId === "home"),
    true,
  );
  assert.equal(engine.getDirtyRecords().length >= 2, true);
});

test("the new engine matches the legacy reference adapter across golden commands", async () => {
  const initial = workspaceWithSibling();
  const engine = createWorkspaceEngine(initial);
  const legacy = createLegacySnapshotAdapter(initial);
  const commands = [
    command("set-cell", { objectId: "home", cellId: "r1c1", patch: { value: "A" } }, 1),
    command(
      "set-range",
      {
        objectId: "home",
        changes: [
          { cellId: "r1c2", patch: { value: "B" } },
          { cellId: "r2c1", patch: { formula: "=A1", value: "" } },
        ],
      },
      2,
    ),
    command("update-object", { objectId: "notes", patch: { title: "Renamed" } }, 3),
    command("resize-axis", { objectId: "home", axis: "column", targets: [0], sizes: { 0: 140 } }, 4),
    command(
      "apply-formatting",
      { objectId: "home", cellIds: ["r1c1", "r1c2"], patch: { bold: true, highlight: "#efe2d5" } },
      5,
    ),
    command(
      "create-embedded-object",
      {
        parentObjectId: "home",
        parentCellId: "r3c3",
        objectType: "markdown",
        objectId: "child",
        title: "Child",
        linkId: "link-child",
      },
      6,
      "menu",
    ),
  ];

  const run = await runDifferentialSequence(engine, legacy, commands);
  assert.equal(run.equal, true, run.steps.find((step) => !step.equal)?.firstDifference || run.final.firstDifference);
  assert.equal(compareEngineSnapshots(legacy.getSnapshot(), engine.getSnapshot()).equal, true);
});

test("differential adapter agrees when a command is a no-op", async () => {
  const initial = workspaceWithSibling();
  initial.themes.paper = {
    id: "paper",
    name: "Paper",
    description: "",
    version: 1,
    tokens: { ink: "#1f1d1a" },
  };
  initial.assets.asset = { id: "asset", mime: "image/png" };
  initial.objects.image = createObjectForType("image", { id: "image", title: "Image", assetId: "asset" });

  const engine = createWorkspaceEngine(initial);
  const legacy = createLegacySnapshotAdapter(initial);
  const commands = [
    command("set-cell", { objectId: "home", cellId: "r1c1", patch: { value: "" } }, 1),
    command("update-object", { objectId: "notes", patch: { title: "Notes" } }, 2),
    command("resize-axis", { objectId: "home", axis: "row", targets: [0], sizes: {} }, 3),
    command("move-axis", { objectId: "home", axis: "row", from: 0, to: 0 }, 4),
    command("delete-axis", { objectId: "home", axis: "row", index: 0 }, 5),
    command("update-theme", { themeId: "paper", patch: { tokens: { ink: "#1f1d1a" } } }, 6),
    command("replace-asset", { objectId: "image", assetId: "asset", asset: { id: "asset", mime: "image/png" } }, 7),
  ];

  const run = await runDifferentialSequence(engine, legacy, commands);

  assert.equal(run.equal, true, run.steps.find((step) => !step.equal)?.firstDifference || run.final.firstDifference);
  assert.equal(engine.getUndoDepth(), 0);
});
