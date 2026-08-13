import type {
  TauriFileDialogSelection,
  TauriFileFilter,
  TauriOpenFileDialogPayload,
  TauriSaveFileDialogPayload,
} from "./contracts.ts";
import { TAURI_COMMANDS } from "./contracts.ts";
import { requireTauriInvoke, type TauriInvoke } from "./runtime.ts";

export interface OpenFileDialogRequest extends TauriOpenFileDialogPayload {}
export interface SaveFileDialogRequest extends TauriSaveFileDialogPayload {}

export interface TactileFileDialogPort {
  openFile(request?: OpenFileDialogRequest): Promise<TauriFileDialogSelection>;
  saveFile(request?: SaveFileDialogRequest): Promise<TauriFileDialogSelection>;
}

export class TauriDialogProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TauriDialogProtocolError";
  }
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function filters(filters: readonly TauriFileFilter[] | undefined): readonly TauriFileFilter[] | undefined {
  if (!filters) return undefined;
  return filters.map((filter) => ({
    name: String(filter.name),
    extensions: filter.extensions.map((extension) => String(extension)),
  }));
}

function compact<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

function normalizeDialogSelection(value: unknown, multiple = false): TauriFileDialogSelection {
  const source = recordOf(value);
  const candidate = source?.paths ?? source?.path ?? source?.selected ?? value;
  if (candidate === null || candidate === undefined || candidate === false) {
    return { cancelled: true, paths: [] };
  }
  const paths = Array.isArray(candidate) ? candidate : [candidate];
  if (paths.some((path) => typeof path !== "string")) {
    throw new TauriDialogProtocolError("Native file dialog returned a non-string path.");
  }
  return {
    cancelled: paths.length === 0,
    paths: (multiple ? paths : paths.slice(0, 1)) as string[],
  };
}

export class TauriFileDialogAdapter implements TactileFileDialogPort {
  private readonly invoke: TauriInvoke;
  private readonly commands: Pick<typeof TAURI_COMMANDS, "openFileDialog" | "saveFileDialog">;

  constructor(
    options: {
      invoke?: TauriInvoke;
      runtime?: unknown;
      commands?: Partial<Pick<typeof TAURI_COMMANDS, "openFileDialog" | "saveFileDialog">>;
    } = {},
  ) {
    this.invoke = requireTauriInvoke(options.runtime, options.invoke);
    this.commands = {
      openFileDialog: options.commands?.openFileDialog || TAURI_COMMANDS.openFileDialog,
      saveFileDialog: options.commands?.saveFileDialog || TAURI_COMMANDS.saveFileDialog,
    };
  }

  async openFile(request: OpenFileDialogRequest = {}): Promise<TauriFileDialogSelection> {
    const payload = compact({
      title: request.title,
      multiple: request.multiple,
      directory: request.directory,
      defaultPath: request.defaultPath,
      filters: filters(request.filters),
    });
    const result = await this.invoke(this.commands.openFileDialog, payload);
    return normalizeDialogSelection(result, request.multiple === true);
  }

  async saveFile(request: SaveFileDialogRequest = {}): Promise<TauriFileDialogSelection> {
    const payload = compact({
      title: request.title,
      defaultPath: request.defaultPath,
      suggestedFileName: request.suggestedFileName,
      filters: filters(request.filters),
    });
    const result = await this.invoke(this.commands.saveFileDialog, payload);
    return normalizeDialogSelection(result, false);
  }

  pickFile(request: OpenFileDialogRequest = {}): Promise<TauriFileDialogSelection> {
    return this.openFile(request);
  }
}

export const TactileDialogAdapter = TauriFileDialogAdapter;
