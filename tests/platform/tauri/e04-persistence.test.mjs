import assert from "node:assert/strict";
import test from "node:test";

import { createBlankWorkspace, createCellRecord } from "../../../src/core/model.ts";
import { BrowserPersistenceAdapter } from "../../../src/platform/browser/persistence.js";
import {
  TAURI_COMMANDS,
  StaleAcknowledgementError,
  TauriDialogProtocolError,
  TauriFileDialogAdapter,
  TauriPersistencePort,
  createPersistencePort,
  detectNativeRuntime,
} from "../../../src/platform/tauri/index.ts";

function transaction(revision, operations = [], dirtyRecords = []) {
  return {
    revision,
    changedObjectIds: [],
    changedCellIds: [],
    invalidatedFormulaIds: [],
    forwardPatch: {
      id: `patch-${revision}`,
      baseRevision: "r0",
      targetRevision: revision,
      operations,
    },
    inversePatch: {
      id: `inverse-${revision}`,
      baseRevision: revision,
      targetRevision: "r0",
      operations: [{ kind: "replace-cell", before: { value: "must-not-cross-ipc" }, after: null }],
    },
    dirtyRecords,
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

test("native runtime detection and factory selection stay at the platform boundary", () => {
  const invoke = async () => null;
  const nativeRuntime = { __TAURI_INTERNALS__: { invoke } };
  const browserRuntime = {};
  const browserPort = { marker: "browser-port" };

  assert.equal(detectNativeRuntime(nativeRuntime), "tauri");
  assert.equal(detectNativeRuntime(browserRuntime), "browser");
  assert.equal(createPersistencePort({ runtime: nativeRuntime, browserPort }).constructor, TauriPersistencePort);
  assert.equal(createPersistencePort({ runtime: browserRuntime, browserPort }), browserPort);
});

test("native numeric revisions are normalized without losing acknowledgement state", async () => {
  const workspace = createBlankWorkspace({ id: "e04-numeric-revision" });
  const invoke = async (command, payload) => {
    if (command === TAURI_COMMANDS.openWorkspace) return { workspace, acknowledgedRevision: 0 };
    if (command === TAURI_COMMANDS.applyDelta) {
      return { revision: Number(payload.revision), persistedAt: "2026-08-14T00:00:01.000Z", dirtyRecordIds: [] };
    }
    throw new Error(`Unexpected command ${command}`);
  };
  const port = new TauriPersistencePort({ invoke });

  await port.open();
  assert.equal(port.acknowledgedRevision, "0");
  const acknowledgement = await port.commit({ revision: "1", transaction: transaction("1") });

  assert.equal(acknowledgement.revision, "1");
  assert.equal(port.acknowledgedRevision, "1");
});

test("Tauri commit sends a forward-only compact delta and returns its acknowledgement", async () => {
  const calls = [];
  const workspace = createBlankWorkspace({ id: "e04-workspace" });
  const cell = createCellRecord(0, 0, { value: "after" });
  const invoke = async (command, payload) => {
    calls.push({ command, payload });
    if (command === TAURI_COMMANDS.openWorkspace) return workspace;
    if (command === TAURI_COMMANDS.applyDelta) {
      return { revision: "r1", persistedAt: "2026-08-14T00:00:01.000Z", dirtyRecordIds: ["A1"] };
    }
    throw new Error(`Unexpected command ${command}`);
  };
  const port = new TauriPersistencePort({ invoke });
  await port.open({ workspaceId: workspace.id });

  const result = await port.commit({
    revision: "r1",
    transaction: transaction(
      "r1",
      [
        {
          kind: "replace-cell",
          objectId: "home",
          cellId: cell.id,
          before: { ...cell, value: "before" },
          after: cell,
        },
        {
          kind: "replace-asset",
          assetId: "asset-1",
          before: { id: "asset-1", dataUrl: "data:text/plain,old" },
          after: { id: "asset-1", mime: "text/plain", dataUrl: "data:text/plain,new", bytes: [1, 2, 3] },
        },
      ],
      [{ recordType: "cell", recordId: cell.id, reason: "command" }],
    ),
  });

  const commitCall = calls.find(({ command }) => command === TAURI_COMMANDS.applyDelta);
  assert.deepEqual(result, {
    revision: "r1",
    persistedAt: "2026-08-14T00:00:01.000Z",
    dirtyRecordIds: ["A1"],
  });
  assert.equal(commitCall.payload.workspaceId, workspace.id);
  assert.equal(commitCall.payload.revision, "r1");
  assert.equal(commitCall.payload.delta.patchId, "patch-r1");
  assert.equal("inversePatch" in commitCall.payload, false);
  assert.equal("before" in commitCall.payload.delta.operations[0], false);
  assert.deepEqual(commitCall.payload.delta.operations[0].after, cell);
  assert.equal("dataUrl" in commitCall.payload.delta.operations[1].after, false);
  assert.equal("bytes" in commitCall.payload.delta.operations[1].after, false);
});

test("an acknowledgement from an older in-flight revision is rejected without regressing state", async () => {
  const pending = new Map();
  const workspace = createBlankWorkspace({ id: "e04-stale" });
  const acknowledgements = [];
  const invoke = async (command, payload) => {
    if (command === TAURI_COMMANDS.openWorkspace) return workspace;
    if (command === TAURI_COMMANDS.applyDelta) {
      const wait = deferred();
      pending.set(payload.revision, wait);
      return wait.promise;
    }
    throw new Error(`Unexpected command ${command}`);
  };
  const port = new TauriPersistencePort({ invoke, onAcknowledged: (ack) => acknowledgements.push(ack.revision) });
  await port.open();

  const first = port.commit({ revision: "r1", transaction: transaction("r1") });
  const second = port.commit({ revision: "r2", transaction: transaction("r2") });
  pending.get("r2").resolve({ revision: "r2", persistedAt: "t2", dirtyRecordIds: [] });
  assert.equal((await second).revision, "r2");
  pending.get("r1").resolve({ revision: "r1", persistedAt: "t1", dirtyRecordIds: [] });

  await assert.rejects(first, (error) => {
    assert.ok(error instanceof StaleAcknowledgementError);
    assert.equal(error.revision, "r1");
    assert.equal(error.latestRevision, "r2");
    return true;
  });
  assert.equal(port.acknowledgedRevision, "r2");
  assert.deepEqual(acknowledgements, ["r2"]);
});

test("an in-flight acknowledgement from a replaced workspace session is ignored", async () => {
  const pending = deferred();
  const firstWorkspace = createBlankWorkspace({ id: "e04-session-first" });
  const secondWorkspace = createBlankWorkspace({ id: "e04-session-second" });
  let opened = 0;
  const invoke = async (command) => {
    if (command === TAURI_COMMANDS.openWorkspace)
      return { workspace: opened++ === 0 ? firstWorkspace : secondWorkspace };
    if (command === TAURI_COMMANDS.applyDelta) return pending.promise;
    if (command === TAURI_COMMANDS.closeWorkspace) return null;
    throw new Error(`Unexpected command ${command}`);
  };
  const port = new TauriPersistencePort({ invoke });

  await port.open({ workspaceId: firstWorkspace.id });
  const oldCommit = port.commit({ revision: "r1", transaction: transaction("r1") });
  await port.close();
  await port.open({ workspaceId: secondWorkspace.id });
  pending.resolve({ revision: "r1", persistedAt: "t1", dirtyRecordIds: [] });

  await assert.rejects(oldCommit, (error) => {
    assert.ok(error instanceof StaleAcknowledgementError);
    assert.equal(error.revision, "r1");
    assert.equal(error.latestRevision, null);
    return true;
  });
  assert.equal(port.activeWorkspaceId, secondWorkspace.id);
  assert.equal(port.acknowledgedRevision, null);
});

test("import responses retain the native acknowledgement for the imported workspace", async () => {
  const workspace = createBlankWorkspace({ id: "e04-imported" });
  const invoke = async (command) => {
    if (command === TAURI_COMMANDS.openWorkspace) return { workspace };
    if (command === TAURI_COMMANDS.importPortable) return { workspace, acknowledgedRevision: 7 };
    throw new Error(`Unexpected command ${command}`);
  };
  const port = new TauriPersistencePort({ invoke });

  await port.open();
  await port.importPortable({ kind: "json", data: "{}" });

  assert.equal(port.activeWorkspaceId, workspace.id);
  assert.equal(port.acknowledgedRevision, "7");
});

test("native assets cross IPC as bytes and opaque handles, never data URLs", async () => {
  const calls = [];
  const workspace = createBlankWorkspace({ id: "e04-assets" });
  const invoke = async (command, payload) => {
    calls.push({ command, payload });
    if (command === TAURI_COMMANDS.openWorkspace) return workspace;
    if (command === TAURI_COMMANDS.readAsset) {
      return { assetId: "asset-1", mime: "image/png", bytes: [3, 4], handle: "asset://asset-1" };
    }
    if (command === TAURI_COMMANDS.writeAsset) return { id: "asset-1", mime: "image/png", size: 2 };
    if (command === TAURI_COMMANDS.acquireAssetHandle) return { handle: "asset://asset-1", mime: "image/png", size: 2 };
    if (command === TAURI_COMMANDS.releaseAssetHandle) return null;
    throw new Error(`Unexpected command ${command}`);
  };
  const port = new TauriPersistencePort({ invoke });
  await port.open();

  const read = await port.readAsset({ assetId: "asset-1" });
  assert.ok(read.data instanceof Uint8Array);
  assert.deepEqual([...read.data], [3, 4]);
  assert.equal(read.nativeHandle, "asset://asset-1");
  const written = await port.writeAsset({
    record: { id: "asset-1", mime: "image/png", dataUrl: "data:image/png;base64,not-here" },
    data: new Uint8Array([3, 4]),
  });
  assert.equal(written.id, "asset-1");
  const writeCall = calls.find(({ command }) => command === TAURI_COMMANDS.writeAsset);
  assert.deepEqual(writeCall.payload.bytes, [3, 4]);
  assert.equal("dataUrl" in writeCall.payload.record, false);

  const handle = await port.acquireAssetHandle("asset-1");
  assert.equal(handle.handle, "asset://asset-1");
  await handle.release();
  assert.equal(calls.at(-1).command, TAURI_COMMANDS.releaseAssetHandle);
});

test("custom dialog adapter normalizes native selection without owning any UI", async () => {
  const calls = [];
  const invoke = async (command, payload) => {
    calls.push({ command, payload });
    if (command === TAURI_COMMANDS.openFileDialog) return ["C:\\one.md", "C:\\two.md"];
    if (command === TAURI_COMMANDS.saveFileDialog) return null;
    throw new Error(`Unexpected command ${command}`);
  };
  const dialogs = new TauriFileDialogAdapter({ invoke });
  const open = await dialogs.openFile({ multiple: false, filters: [{ name: "Markdown", extensions: ["md"] }] });
  const save = await dialogs.saveFile({ suggestedFileName: "notes.md" });

  assert.deepEqual(open, { cancelled: false, paths: ["C:\\one.md"] });
  assert.deepEqual(save, { cancelled: true, paths: [] });
  assert.deepEqual(calls[0], {
    command: TAURI_COMMANDS.openFileDialog,
    payload: { multiple: false, filters: [{ name: "Markdown", extensions: ["md"] }] },
  });
  assert.deepEqual(calls[1], {
    command: TAURI_COMMANDS.saveFileDialog,
    payload: { suggestedFileName: "notes.md" },
  });
});

test("browser and Tauri adapters expose the same persistence surface for preview wiring", () => {
  const methods = [
    "open",
    "commit",
    "checkpoint",
    "importPortable",
    "exportPortable",
    "readAsset",
    "writeAsset",
    "acquireAssetHandle",
    "releaseAssetHandle",
    "close",
  ];
  const browserPrototype = BrowserPersistenceAdapter.prototype;
  const tauriPrototype = TauriPersistencePort.prototype;
  methods.forEach((method) => {
    assert.equal(typeof browserPrototype[method], "function", `browser adapter is missing ${method}`);
    assert.equal(typeof tauriPrototype[method], "function", `Tauri adapter is missing ${method}`);
  });
});

test("dialog adapter rejects malformed native paths at the boundary", async () => {
  const dialogs = new TauriFileDialogAdapter({ invoke: async () => ({ paths: [42] }) });
  await assert.rejects(dialogs.openFile(), TauriDialogProtocolError);
});

test("dialog adapter rejects malformed filters and accepts explicit cancellation", async () => {
  const malformed = new TauriFileDialogAdapter({ invoke: async () => ({ paths: [""] }) });
  await assert.rejects(
    malformed.openFile({ filters: [{ name: "Markdown", extensions: [""] }] }),
    TauriDialogProtocolError,
  );

  const cancelled = new TauriFileDialogAdapter({ invoke: async () => ({ canceled: true }) });
  assert.deepEqual(await cancelled.openFile(), { cancelled: true, paths: [] });
});
