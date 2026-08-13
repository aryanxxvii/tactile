import type { PersistencePort } from "../../core/persistence.ts";
import { BrowserPersistenceAdapter } from "../browser/persistence.js";
import { TauriPersistencePort, type TauriPersistenceOptions } from "./persistence.ts";
import { isTauriRuntime } from "./runtime.ts";

export interface PersistencePortFactoryOptions extends TauriPersistenceOptions {
  browserPort?: PersistencePort;
  browserOptions?: Record<string, unknown>;
}

/** Chooses the platform port once at the shell boundary; object code stays platform-agnostic. */
export function createPersistencePort(options: PersistencePortFactoryOptions = {}): PersistencePort {
  if (options.invoke || isTauriRuntime(options.runtime)) return new TauriPersistencePort(options);
  if (options.browserPort) return options.browserPort;
  return new BrowserPersistenceAdapter(options.browserOptions || {}) as unknown as PersistencePort;
}

export const createPlatformPersistence = createPersistencePort;
