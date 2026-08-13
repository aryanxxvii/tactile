import type {
  ReplaceAssetOperation,
  ReplaceCellOperation,
  ReplaceObjectOperation,
  ReplaceThemeOperation,
  ReplaceWorkspaceMetaOperation,
  WorkspacePatch,
  WorkspacePatchOperation,
} from "../patches.ts";
import type { PatchId, RevisionId } from "../ids.ts";
import { asPatchId } from "../ids.ts";
import { cloneValue, deepEqual } from "../engine/clone.ts";

let patchSequence = 0;

export function createPatchId(prefix = "patch"): PatchId {
  patchSequence += 1;
  return asPatchId(`${prefix}-${patchSequence.toString(36)}`);
}

export function operationKey(operation: WorkspacePatchOperation): string {
  switch (operation.kind) {
    case "replace-workspace-meta":
      return "workspace-meta";
    case "replace-object":
      return `object:${String(operation.objectId)}`;
    case "replace-cell":
      return `cell:${String(operation.objectId)}:${String(operation.cellId)}`;
    case "replace-asset":
      return `asset:${String(operation.assetId)}`;
    case "replace-theme":
      return `theme:${String(operation.themeId)}`;
    default:
      return String((operation as { kind: string }).kind);
  }
}

export function clonePatchOperation(operation: WorkspacePatchOperation): WorkspacePatchOperation {
  return cloneValue(operation);
}

export function invertOperation(operation: WorkspacePatchOperation): WorkspacePatchOperation {
  switch (operation.kind) {
    case "replace-workspace-meta":
      return {
        ...operation,
        before: cloneValue(operation.after),
        after: cloneValue(operation.before),
      } satisfies ReplaceWorkspaceMetaOperation;
    case "replace-object":
      return {
        ...operation,
        before: cloneValue(operation.after),
        after: cloneValue(operation.before),
      } satisfies ReplaceObjectOperation;
    case "replace-cell":
      return {
        ...operation,
        before: cloneValue(operation.after),
        after: cloneValue(operation.before),
      } satisfies ReplaceCellOperation;
    case "replace-asset":
      return {
        ...operation,
        before: cloneValue(operation.after),
        after: cloneValue(operation.before),
      } satisfies ReplaceAssetOperation;
    case "replace-theme":
      return {
        ...operation,
        before: cloneValue(operation.after),
        after: cloneValue(operation.before),
      } satisfies ReplaceThemeOperation;
    default:
      throw new Error(`Unsupported patch operation ${(operation as { kind: string }).kind}.`);
  }
}

export function invertPatch(
  patch: WorkspacePatch,
  baseRevision: RevisionId = patch.targetRevision,
  targetRevision: RevisionId = patch.baseRevision,
  id = createPatchId("inverse"),
): WorkspacePatch {
  return {
    id,
    baseRevision,
    targetRevision,
    operations: patch.operations.slice().reverse().map(invertOperation),
  };
}

function combineOperations(first: WorkspacePatchOperation, second: WorkspacePatchOperation): WorkspacePatchOperation {
  switch (first.kind) {
    case "replace-workspace-meta":
      return {
        ...first,
        before: cloneValue(first.before),
        after: cloneValue((second as ReplaceWorkspaceMetaOperation).after),
      };
    case "replace-object":
      return {
        ...first,
        before: cloneValue(first.before),
        after: cloneValue((second as ReplaceObjectOperation).after),
      };
    case "replace-cell":
      return {
        ...first,
        before: cloneValue(first.before),
        after: cloneValue((second as ReplaceCellOperation).after),
      };
    case "replace-asset":
      return {
        ...first,
        before: cloneValue(first.before),
        after: cloneValue((second as ReplaceAssetOperation).after),
      };
    case "replace-theme":
      return {
        ...first,
        before: cloneValue(first.before),
        after: cloneValue((second as ReplaceThemeOperation).after),
      };
    default:
      throw new Error(`Unsupported patch operation ${(first as { kind: string }).kind}.`);
  }
}

/**
 * Coalesces repeated writes to the same normalized record while retaining the
 * original before value and the final after value.  This is what makes a text
 * edit session one reversible patch instead of one entry per keystroke.
 */
export function mergePatchOperations(operations: readonly WorkspacePatchOperation[]): WorkspacePatchOperation[] {
  const order: string[] = [];
  const orderedKeys = new Set<string>();
  const merged = new Map<string, WorkspacePatchOperation>();
  operations.forEach((operation) => {
    const key = operationKey(operation);
    const current = merged.get(key);
    if (!current) {
      if (!orderedKeys.has(key)) {
        order.push(key);
        orderedKeys.add(key);
      }
      merged.set(key, clonePatchOperation(operation));
      return;
    }
    const combined = combineOperations(current, operation);
    if (hasChanged(combined)) merged.set(key, combined);
    else merged.delete(key);
  });
  return order
    .map((key) => merged.get(key))
    .filter((operation): operation is WorkspacePatchOperation => Boolean(operation));
}

function hasChanged(operation: WorkspacePatchOperation): boolean {
  switch (operation.kind) {
    case "replace-workspace-meta":
    case "replace-object":
    case "replace-cell":
    case "replace-asset":
    case "replace-theme":
      return !deepEqual(operation.before, operation.after);
    default:
      return true;
  }
}

export function makePatch(
  operations: readonly WorkspacePatchOperation[],
  baseRevision: RevisionId,
  targetRevision: RevisionId,
  id = createPatchId(),
): WorkspacePatch {
  return {
    id,
    baseRevision,
    targetRevision,
    operations: mergePatchOperations(operations),
  };
}
