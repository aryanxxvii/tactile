/**
 * Small, browser-safe cloning and comparison helpers used by the normalized
 * engine.  Patches own their record values, while the live store keeps record
 * references stable until that record changes.
 */
export function cloneValue<T>(value: T): T {
  if (value === null || value === undefined || typeof value !== "object") return value;

  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // Some host objects cannot be structured-cloned.  The fallback below is
      // sufficient for the portable record shapes and preserves unknown keys.
    }
  }

  return cloneFallback(value, new WeakMap<object, unknown>()) as T;
}

function cloneFallback(value: unknown, seen: WeakMap<object, unknown>): unknown {
  if (value === null || value === undefined || typeof value !== "object") return value;
  if (seen.has(value)) return seen.get(value);

  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (value instanceof ArrayBuffer) return value.slice(0);
  if (value instanceof Map) {
    const copy = new Map<unknown, unknown>();
    seen.set(value, copy);
    value.forEach((entry, key) => copy.set(cloneFallback(key, seen), cloneFallback(entry, seen)));
    return copy;
  }
  if (value instanceof Set) {
    const copy = new Set<unknown>();
    seen.set(value, copy);
    value.forEach((entry) => copy.add(cloneFallback(entry, seen)));
    return copy;
  }
  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    seen.set(value, copy);
    value.forEach((entry) => copy.push(cloneFallback(entry, seen)));
    return copy;
  }

  const copy: Record<string, unknown> = {};
  seen.set(value, copy);
  Object.entries(value).forEach(([key, entry]) => {
    copy[key] = cloneFallback(entry, seen);
  });
  return copy;
}

export function deepEqual(left: unknown, right: unknown): boolean {
  return deepEqualInternal(left, right, new WeakMap<object, object>());
}

function deepEqualInternal(left: unknown, right: unknown, seen: WeakMap<object, object>): boolean {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;

  const previous = seen.get(left);
  if (previous === right) return true;
  seen.set(left, right);

  if (left instanceof Date || right instanceof Date) {
    return left instanceof Date && right instanceof Date && left.getTime() === right.getTime();
  }
  if (left instanceof Uint8Array || right instanceof Uint8Array) {
    if (!(left instanceof Uint8Array) || !(right instanceof Uint8Array) || left.length !== right.length) return false;
    return left.every((value, index) => value === right[index]);
  }
  if (left instanceof ArrayBuffer || right instanceof ArrayBuffer) {
    if (!(left instanceof ArrayBuffer) || !(right instanceof ArrayBuffer) || left.byteLength !== right.byteLength) {
      return false;
    }
    const leftBytes = new Uint8Array(left);
    const rightBytes = new Uint8Array(right);
    return leftBytes.every((value, index) => value === rightBytes[index]);
  }
  if (left instanceof Map || right instanceof Map) {
    if (!(left instanceof Map) || !(right instanceof Map) || left.size !== right.size) return false;
    for (const [key, value] of left) {
      if (!right.has(key) || !deepEqualInternal(value, right.get(key), seen)) return false;
    }
    return true;
  }
  if (left instanceof Set || right instanceof Set) {
    if (!(left instanceof Set) || !(right instanceof Set) || left.size !== right.size) return false;
    for (const value of left) if (!right.has(value)) return false;
    return true;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => deepEqualInternal(value, right[index], seen));
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(rightRecord, key) &&
      deepEqualInternal(leftRecord[key], rightRecord[key], seen),
  );
}
