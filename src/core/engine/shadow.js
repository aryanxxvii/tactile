import { createBrowserPersistence } from "../../platform/browser/persistence.js";
import { createFormulaWorker } from "../../workers/formula/index.js";
import { createTransactionEngine, compareEngineSnapshots } from "./index.ts";
import { normalizeWorkspace } from "../model.ts";

const COMMAND_SOURCE = "system";

function commandEnvelope(sequence) {
  return {
    commandId: `wave2-shadow-${sequence}`,
    issuedAt: new Date().toISOString(),
    source: COMMAND_SOURCE,
  };
}

function changed(left, right) {
  return JSON.stringify(left) !== JSON.stringify(right);
}

function without(source, keys) {
  const next = { ...(source || {}) };
  keys.forEach((key) => delete next[key]);
  return next;
}

function cellPatch(cell) {
  if (!cell) {
    return {
      value: "",
      formula: "",
      embed: null,
      note: null,
      style: null,
      validation: null,
      role: null,
    };
  }
  return without(cell, ["id", "address", "row", "column"]);
}

function objectPatch(object) {
  return without(object, ["id", "type", "cells"]);
}

function themePatch(theme) {
  return without(theme, ["id"]);
}

function workspaceMeta(snapshot) {
  const {
    objects: _objects,
    assets: _assets,
    themes: _themes,
    ...meta
  } = snapshot || {};
  return meta;
}

function changedCellIds(previous, next) {
  const ids = new Set([
    ...Object.keys(previous?.cells || {}),
    ...Object.keys(next?.cells || {}),
  ]);
  return [...ids].filter((id) => changed(previous?.cells?.[id] || null, next?.cells?.[id] || null));
}

function changedAssetIds(previous, next) {
  const ids = new Set([
    ...Object.keys(previous?.assets || {}),
    ...Object.keys(next?.assets || {}),
  ]);
  return [...ids].filter((id) => changed(previous?.assets?.[id] || null, next?.assets?.[id] || null));
}

function changedThemeIds(previous, next) {
  const ids = new Set([
    ...Object.keys(previous?.themes || {}),
    ...Object.keys(next?.themes || {}),
  ]);
  return [...ids].filter((id) => changed(previous?.themes?.[id] || null, next?.themes?.[id] || null));
}

function metaChanged(previous, next) {
  return changed(
    without(previous, ["updatedAt"]),
    without(next, ["updatedAt"]),
  );
}

function objectIds(previous, next) {
  return new Set([
    ...Object.keys(previous?.objects || {}),
    ...Object.keys(next?.objects || {}),
  ]);
}

/**
 * Convert one legacy snapshot transition into one or more typed commands.
 * The visible app still owns the legacy snapshot; this adapter makes the
 * normalized engine and record persistence observe the same user action.
 */
export function commandsForWorkspaceTransition(previous, next, sequence = 1) {
  const commands = [];
  const changedSheets = new Map();
  let unsupported = false;
  let commandSequence = sequence;

  const push = (command) => {
    commands.push({ ...commandEnvelope(commandSequence++), ...command });
  };

  objectIds(previous, next).forEach((objectId) => {
    const before = previous?.objects?.[objectId] || null;
    const after = next?.objects?.[objectId] || null;
    if (!before && after) {
      const parent = after.parent;
      const parentObject = parent ? next?.objects?.[String(parent.parentObjectId)] : null;
      if (!parent || parentObject?.type !== "sheet") {
        unsupported = true;
        return;
      }
      push({
        type: "create-embedded-object",
        parentObjectId: parent.parentObjectId,
        parentCellId: parent.parentCellId,
        objectType: after.type,
        objectId: after.id,
        title: after.title,
        linkId: parent.linkId,
      });
      const patch = objectPatch(after);
      if (Object.keys(patch).length) {
        push({ type: "update-object", objectId, patch });
      }
      return;
    }
    if (before && !after) {
      unsupported = true;
      return;
    }
    if (!before || !after) return;

    if (before.type !== after.type) {
      push({ type: "update-object", objectId, patch: { type: after.type, ...objectPatch(after) } });
    } else if (changed(objectPatch(before), objectPatch(after))) {
      push({ type: "update-object", objectId, patch: objectPatch(after) });
    }

    if (before.type !== "sheet" || after.type !== "sheet") return;
    const cellIds = changedCellIds(before, after);
    if (!cellIds.length) return;
    changedSheets.set(String(objectId), cellIds.map((cellId) => ({
      address: after.cells?.[cellId]?.address || before.cells?.[cellId]?.address || cellId,
      ...(after.cells?.[cellId]
        ? { patch: cellPatch(after.cells[cellId]) }
        : { delete: true }),
    })));
    const changes = cellIds.map((cellId) => ({
      cellId,
      patch: cellPatch(after.cells?.[cellId]),
    }));
    if (changes.length === 1) {
      push({ type: "set-cell", objectId, cellId: changes[0].cellId, patch: changes[0].patch });
    } else {
      push({ type: "set-range", objectId, changes });
    }
  });

  changedAssetIds(previous, next).forEach((assetId) => {
    const asset = next?.assets?.[assetId] || null;
    if (!asset) {
      unsupported = true;
      return;
    }
    push({ type: "replace-asset", assetId, asset });
  });

  changedThemeIds(previous, next).forEach((themeId) => {
    const theme = next?.themes?.[themeId] || null;
    if (!theme) {
      unsupported = true;
      return;
    }
    push({ type: "update-theme", themeId, patch: themePatch(theme) });
  });

  return {
    commands,
    changedSheets,
    unsupported,
    metadataChanged: metaChanged(previous, next),
  };
}

function comparableSnapshot(snapshot, target) {
  return normalizeWorkspace({
    ...snapshot,
    updatedAt: target.updatedAt,
  });
}

function exposeState(state) {
  const host = typeof window !== "undefined"
    ? window
    : (typeof globalThis !== "undefined" ? globalThis : null);
  try {
    if (host) host.__TACTILE_WAVE2__ = state;
  } catch {
    // Some preview harnesses freeze the page global; diagnostics must never
    // prevent the shadow path from running.
  }
}

function disposeFormulaClients(clients) {
  clients.forEach((client) => client.dispose?.());
  clients.clear();
}

export function createWave2Shadow(initialWorkspace, options = {}) {
  let engine = createTransactionEngine(normalizeWorkspace(initialWorkspace), { initialRevision: "0" });
  const persistence = options.persistence || createBrowserPersistence();
  const useInitialSnapshot = options.useInitialSnapshot === true;
  const formulaClients = new Map();
  const state = {
    enabled: true,
    engine: "transaction",
    mode: "default",
    persistence: "initializing",
    formulaWorker: "idle",
    revision: "0",
    transactions: 0,
    differential: { equal: true },
    lastError: null,
  };
  let previous = normalizeWorkspace(initialWorkspace);
  let commandSequence = 1;
  let disposed = false;
  let queue = Promise.resolve();

  exposeState(state);

  const ready = (async () => {
    try {
      const stored = useInitialSnapshot
        ? null
        : await persistence.open({ workspaceId: previous.id });
      if (stored) {
        previous = normalizeWorkspace(stored);
        engine = createTransactionEngine(previous, { initialRevision: "0" });
      } else {
        await persistence.open({ workspaceId: previous.id });
        await persistence.writeSnapshot(previous, { revision: "0", activate: true });
      }
      state.persistence = "active";
    } catch (error) {
      state.persistence = "unavailable";
      state.lastError = error?.message || String(error);
    }
    exposeState(state);
    return previous;
  })();

  async function ensureFormulaClient(sheetId, sheet, revision) {
    if (!sheet?.cells || formulaClients.has(String(sheetId))) return formulaClients.get(String(sheetId));
    if (typeof Worker === "undefined") {
      state.formulaWorker = "unavailable";
      return null;
    }
    try {
      const client = createFormulaWorker();
      await client.initialize(sheet, { revision: Math.max(0, revision - 1), includeGraph: true });
      formulaClients.set(String(sheetId), client);
      state.formulaWorker = "active";
      return client;
    } catch (error) {
      state.formulaWorker = "error";
      state.lastError = error?.message || String(error);
      exposeState(state);
      return null;
    }
  }

  async function refreshFormulaClients(previousSnapshot, next, changedSheets, revision) {
    for (const [sheetId, changes] of changedSheets) {
      const sheet = next.objects?.[sheetId];
      if (sheet?.type !== "sheet") continue;
      const priorSheet = previousSnapshot.objects?.[sheetId];
      const client = await ensureFormulaClient(sheetId, priorSheet || sheet, revision);
      if (!client) continue;
      if (!formulaClients.has(String(sheetId))) continue;
      try {
        const result = await client.update(changes, { revision, includeGraph: false });
        state.formulaWorker = "active";
        state.lastFormula = {
          sheetId,
          revision,
          evaluatedAddresses: result.evaluatedAddresses || [],
          affectedAddresses: result.affectedAddresses || [],
        };
      } catch (error) {
        state.formulaWorker = "error";
        state.lastError = error?.message || String(error);
      }
    }
  }

  async function resetTo(next) {
    disposeFormulaClients(formulaClients);
    engine = createTransactionEngine(next, { initialRevision: String(state.revision || "0") });
    await persistence.writeSnapshot(next, {
      revision: `shadow-${++state.transactions}`,
      activate: true,
    });
    state.revision = engine.getRevision();
    state.differential = { equal: true, mode: "reset" };
  }

  function reconcile(nextWorkspace) {
    const next = normalizeWorkspace(nextWorkspace);
    const prior = previous;
    previous = next;
    queue = queue.then(async () => {
      if (disposed) return;
      await ready;
      const transition = commandsForWorkspaceTransition(prior, next, commandSequence);
      commandSequence += transition.commands.length + 1;

      if (transition.unsupported) {
        try {
          await resetTo(next);
        } catch (error) {
          state.lastError = error?.message || String(error);
        }
        exposeState(state);
        return;
      }

      if (transition.commands.length) {
        const transaction = await engine.dispatchBatch(transition.commands, {
          historyKey: transition.commands.length === 1
            ? transition.commands[0].historyKey
            : `wave2:${state.transactions + 1}`,
        });
        state.revision = String(transaction.revision);
        state.transactions += 1;
        if (state.persistence === "active") {
          try {
            await persistence.commit({ revision: transaction.revision, transaction });
          } catch (error) {
            state.persistence = "error";
            state.lastError = error?.message || String(error);
          }
        }
        await refreshFormulaClients(prior, next, transition.changedSheets, Number(transaction.revision) || state.transactions);
      } else if (transition.metadataChanged && state.persistence === "active") {
        try {
          await persistence.writeSnapshot(next, {
            revision: `shadow-meta-${++state.transactions}`,
            activate: true,
          });
        } catch (error) {
          state.persistence = "error";
          state.lastError = error?.message || String(error);
        }
      }

      // Metadata-only legacy actions are intentionally outside the Wave 2
      // command union. Keep the shadow store aligned without changing the
      // transaction contract or the visible legacy rollback path.
      engine.store.replaceWorkspaceMeta(workspaceMeta(next));
      const comparison = compareEngineSnapshots(
        comparableSnapshot(next, next),
        comparableSnapshot(engine.getSnapshot(), next),
      );
      state.differential = {
        equal: comparison.equal,
        ...(comparison.firstDifference ? { firstDifference: comparison.firstDifference } : {}),
      };
      exposeState(state);
    }).catch((error) => {
      state.lastError = error?.message || String(error);
      exposeState(state);
    });
    return queue;
  }

  function dispose() {
    disposed = true;
    disposeFormulaClients(formulaClients);
    persistence.close?.().catch?.(() => {});
    const host = typeof window !== "undefined"
      ? window
      : (typeof globalThis !== "undefined" ? globalThis : null);
    try {
      if (host?.__TACTILE_WAVE2__ === state) delete host.__TACTILE_WAVE2__;
    } catch {
      // A frozen page global has no mutable diagnostic slot to clean up.
    }
  }

  return {
    state,
    engine: () => engine,
    ready,
    reconcile,
    dispose,
  };
}
