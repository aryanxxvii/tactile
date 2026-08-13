import assert from "node:assert/strict";
import test from "node:test";

import { createBlankWorkspace } from "../../src/core/model.ts";
import {
  TAURI_COMMANDS,
  StaleAcknowledgementError,
  TauriPersistenceError,
  TauriPersistencePort,
  TauriProtocolError,
} from "../../src/platform/tauri/index.ts";

function transaction(revision) {
  return {
    revision,
    changedObjectIds: [],
    changedCellIds: [],
    invalidatedFormulaIds: [],
    forwardPatch: {
      id: `patch-${revision}`,
      baseRevision: "r0",
      targetRevision: revision,
      operations: [],
    },
    inversePatch: {
      id: `inverse-${revision}`,
      baseRevision: revision,
      targetRevision: "r0",
      operations: [],
    },
    dirtyRecords: [],
  };
}

test("a malformed native acknowledgement can be rejected and recovered by the next commit", async () => {
  const calls = [];
  const workspace = createBlankWorkspace({ id: "native-recovery-ack" });
  let applyCount = 0;
  const invoke = async (command, payload) => {
    calls.push({ command, payload });
    if (command === TAURI_COMMANDS.openWorkspace) {
      return { workspace, acknowledgedRevision: "r0" };
    }
    if (command === TAURI_COMMANDS.applyDelta) {
      applyCount += 1;
      return applyCount === 1
        ? { revision: "wrong-revision" }
        : { revision: payload.revision, persistedAt: "2026-08-14T00:00:02.000Z", dirtyRecordIds: [] };
    }
    throw new Error(`Unexpected command ${command}`);
  };
  const port = new TauriPersistencePort({ invoke, now: () => "fallback-time" });

  await port.open();
  await assert.rejects(
    port.commit({ revision: "r1", transaction: transaction("r1") }),
    (error) => error instanceof TauriProtocolError && error.command === TAURI_COMMANDS.applyDelta,
  );
  assert.equal(port.acknowledgedRevision, "r0");

  const recovered = await port.commit({ revision: "r2", transaction: transaction("r2") });
  assert.equal(recovered.revision, "r2");
  assert.equal(port.acknowledgedRevision, "r2");
  assert.deepEqual(
    calls.filter(({ command }) => command === TAURI_COMMANDS.applyDelta).map(({ payload }) => payload.revision),
    ["r1", "r2"],
  );
});

test("closing and reopening a native workspace clears stale acknowledgement state and scope", async () => {
  const calls = [];
  const firstWorkspace = createBlankWorkspace({ id: "native-recovery-first" });
  const secondWorkspace = createBlankWorkspace({ id: "native-recovery-second" });
  const invoke = async (command, payload) => {
    calls.push({ command, payload });
    if (command === TAURI_COMMANDS.openWorkspace) {
      return payload.workspaceId === secondWorkspace.id
        ? { workspace: secondWorkspace, acknowledgedRevision: "second-r4" }
        : { workspace: firstWorkspace, acknowledgedRevision: "first-r3" };
    }
    if (command === TAURI_COMMANDS.closeWorkspace || command === TAURI_COMMANDS.checkpoint) return null;
    throw new Error(`Unexpected command ${command}`);
  };
  const port = new TauriPersistencePort({ invoke, now: () => "fallback-time" });

  await port.open({ workspaceId: firstWorkspace.id });
  assert.equal(port.activeWorkspaceId, firstWorkspace.id);
  assert.equal(port.acknowledgedRevision, "first-r3");

  await port.close();
  assert.equal(port.activeWorkspaceId, null);
  assert.equal(port.acknowledgedRevision, null);
  await assert.rejects(port.checkpoint("first-r3"), (error) => {
    assert.ok(error instanceof TauriPersistenceError);
    assert.equal(error.code, "workspace-closed");
    return true;
  });

  await port.open({ workspaceId: secondWorkspace.id });
  assert.equal(port.activeWorkspaceId, secondWorkspace.id);
  assert.equal(port.acknowledgedRevision, "second-r4");
  await port.checkpoint("second-r4");

  assert.deepEqual(
    calls.filter(({ command }) => command === TAURI_COMMANDS.closeWorkspace),
    [{ command: TAURI_COMMANDS.closeWorkspace, payload: { workspaceId: firstWorkspace.id } }],
  );
  assert.deepEqual(
    calls.filter(({ command }) => command === TAURI_COMMANDS.checkpoint),
    [{ command: TAURI_COMMANDS.checkpoint, payload: { workspaceId: secondWorkspace.id, revision: "second-r4" } }],
  );
});

test("checkpoint rejects an older revision before it can cross the native boundary", async () => {
  const calls = [];
  const workspace = createBlankWorkspace({ id: "native-recovery-checkpoint" });
  const invoke = async (command, payload) => {
    calls.push({ command, payload });
    if (command === TAURI_COMMANDS.openWorkspace) return { workspace };
    if (command === TAURI_COMMANDS.applyDelta) {
      return { revision: payload.revision, persistedAt: "2026-08-14T00:00:03.000Z", dirtyRecordIds: [] };
    }
    if (command === TAURI_COMMANDS.checkpoint) return null;
    throw new Error(`Unexpected command ${command}`);
  };
  const port = new TauriPersistencePort({ invoke });

  await port.open();
  await port.commit({ revision: "r2", transaction: transaction("r2") });
  await assert.rejects(port.checkpoint("r1"), (error) => {
    assert.ok(error instanceof StaleAcknowledgementError);
    assert.equal(error.revision, "r1");
    assert.equal(error.latestRevision, "r2");
    return true;
  });
  assert.equal(calls.filter(({ command }) => command === TAURI_COMMANDS.checkpoint).length, 0);

  await port.checkpoint("r2");
  assert.equal(calls.filter(({ command }) => command === TAURI_COMMANDS.checkpoint).length, 1);
});
