import { useCallback, useSyncExternalStore } from "react";
import type { EngineSelector } from "../engine.ts";
import type { WorkspaceSnapshot } from "../domain.ts";
import type { ObjectId } from "../ids.ts";
import type { TransactionEngine } from "./transactionEngine.ts";

/**
 * React integration for the external engine.  Selector values are read from
 * the engine's stable per-revision snapshot, and the engine itself decides
 * whether a selector changed before notifying React.
 */
export function useEngineSelector<Value>(engine: TransactionEngine, selector: EngineSelector<Value>): Value {
  const subscribe = useCallback((listener: () => void) => engine.subscribe(selector, listener), [engine, selector]);
  const getSnapshot = useCallback(() => selector(engine.getSnapshot()), [engine, selector]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useEngineObject(engine: TransactionEngine, objectId: ObjectId) {
  return useEngineSelector(engine, (snapshot) => snapshot.objects[String(objectId)]);
}

export function useEngineWorkspaceMeta(engine: TransactionEngine) {
  const metaCache = workspaceMetaCache;
  return useEngineSelector(engine, (snapshot) => {
    const cached = metaCache.get(snapshot);
    if (cached) return cached;
    const meta = buildWorkspaceMeta(snapshot);
    metaCache.set(snapshot, meta);
    return meta;
  });
}

const workspaceMetaCache = new WeakMap<WorkspaceSnapshot, ReturnType<typeof buildWorkspaceMeta>>();

function buildWorkspaceMeta(snapshot: WorkspaceSnapshot) {
  return {
    format: snapshot.format,
    version: snapshot.version,
    id: snapshot.id,
    name: snapshot.name,
    homeObjectId: snapshot.homeObjectId,
    homePath: snapshot.homePath,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    activeThemeId: snapshot.activeThemeId,
    settings: snapshot.settings,
  };
}
