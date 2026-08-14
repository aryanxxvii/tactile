import assert from "node:assert/strict";
import test from "node:test";

import { createBlankWorkspace, createCellRecord, normalizeWorkspace } from "../src/model.js";
import { commandsForWorkspaceTransition, createWave2Shadow } from "../src/core/engine/shadow.js";

function workspaceWithCell(workspace, cellId, patch) {
  const next = normalizeWorkspace(workspace);
  const sheet = next.objects.home;
  sheet.cells[cellId] = createCellRecord(0, 0, patch);
  return next;
}

function fakePersistence() {
  const calls = [];
  return {
    calls,
    async open(request) {
      calls.push({ type: "open", request });
    },
    async writeSnapshot(snapshot, options) {
      calls.push({ type: "snapshot", snapshot, options });
    },
    async commit(transaction) {
      calls.push({ type: "commit", transaction });
      return { revision: transaction.revision };
    },
    async close() {
      calls.push({ type: "close" });
    },
  };
}

test("shadow transition maps a cell edit to one normalized transaction and patch commit", async () => {
  const initial = createBlankWorkspace({ id: "workspace-wave2-shadow" });
  const next = workspaceWithCell(initial, "A1", { value: "42" });
  const transition = commandsForWorkspaceTransition(initial, next);

  assert.equal(transition.unsupported, false);
  assert.equal(transition.commands.length, 1);
  assert.equal(transition.commands[0].type, "set-cell");
  assert.equal(transition.commands[0].cellId, "A1");

  const persistence = fakePersistence();
  const shadow = createWave2Shadow(initial, { persistence });
  await shadow.reconcile(next);

  assert.equal(shadow.state.transactions, 1);
  assert.equal(shadow.state.differential.equal, true);
  assert.equal(persistence.calls.filter((call) => call.type === "commit").length, 1);
  assert.equal(
    persistence.calls
      .find((call) => call.type === "commit")
      .transaction.transaction.forwardPatch.operations.some(
        (operation) => operation.kind === "replace-cell" && operation.cellId === "r1c1",
      ),
    true,
  );
  shadow.dispose();
});

test("the normalized transaction engine is the only runtime mode", () => {
  const initial = createBlankWorkspace({ id: "workspace-wave3-default" });
  const defaultEngine = createWave2Shadow(initial, { persistence: fakePersistence() });

  assert.equal(defaultEngine.state.engine, "transaction");
  assert.equal(defaultEngine.state.mode, "default");

  defaultEngine.dispose();
});

test("shadow transition batches a rectangular edit and leaves unrelated objects out of the command", () => {
  const initial = createBlankWorkspace({ id: "workspace-wave2-batch" });
  const next = workspaceWithCell(initial, "A1", { value: "A" });
  next.objects.home.cells.B1 = createCellRecord(0, 1, { value: "B" });
  const transition = commandsForWorkspaceTransition(initial, next);

  assert.equal(transition.commands.length, 1);
  assert.equal(transition.commands[0].type, "set-range");
  assert.deepEqual(transition.commands[0].changes.map((change) => change.cellId).sort(), ["A1", "B1"]);
  assert.deepEqual([...transition.changedSheets.keys()], ["home"]);
});
