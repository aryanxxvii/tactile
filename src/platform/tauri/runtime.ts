export type TauriInvoke = (command: string, payload?: unknown) => Promise<unknown>;
export type NativeRuntimeKind = "tauri" | "browser";

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function defaultRuntime(): Record<string, unknown> {
  return typeof globalThis === "undefined" ? {} : (globalThis as Record<string, unknown>);
}

function invokeFromRuntime(runtime: unknown): TauriInvoke | null {
  const source = recordOf(runtime);
  const internals = recordOf(source?.__TAURI_INTERNALS__);
  const internalInvoke = internals?.invoke;
  if (typeof internalInvoke === "function") return internalInvoke.bind(internals) as TauriInvoke;

  const legacy = recordOf(source?.__TAURI__);
  const legacyInvoke = legacy?.invoke;
  if (typeof legacyInvoke === "function") return legacyInvoke.bind(legacy) as TauriInvoke;

  return null;
}

export class TauriRuntimeUnavailableError extends Error {
  constructor(message = "Tauri IPC is unavailable in this runtime.") {
    super(message);
    this.name = "TauriRuntimeUnavailableError";
  }
}

export function resolveTauriInvoke(
  runtime: unknown = defaultRuntime(),
  explicitInvoke?: TauriInvoke,
): TauriInvoke | null {
  if (typeof explicitInvoke === "function") return explicitInvoke;
  return invokeFromRuntime(runtime);
}

export function detectNativeRuntime(runtime: unknown = defaultRuntime()): NativeRuntimeKind {
  return invokeFromRuntime(runtime) ? "tauri" : "browser";
}

export function isTauriRuntime(runtime: unknown = defaultRuntime()): boolean {
  return detectNativeRuntime(runtime) === "tauri";
}

export const isNativeTauriRuntime = isTauriRuntime;

export function requireTauriInvoke(runtime: unknown = defaultRuntime(), explicitInvoke?: TauriInvoke): TauriInvoke {
  const invoke = resolveTauriInvoke(runtime, explicitInvoke);
  if (!invoke) throw new TauriRuntimeUnavailableError();
  return invoke;
}
