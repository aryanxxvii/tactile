import type { WorkspaceCommand } from "../commands.ts";

export interface CommandDispatchOptions {
  /** Stable key supplied by a caller that wants explicit history coalescing. */
  historyKey?: string;
  /** Stable key for a single title/cell/formula/Markdown edit session. */
  editSessionId?: string;
  /** Treat this dispatch as part of a text edit session. */
  coalesce?: boolean | "text-edit";
}

export type DispatchableWorkspaceCommand = WorkspaceCommand & {
  historyKey?: string;
  editSessionId?: string;
  linkId?: string;
};

export function commandHistoryKey(
  command: DispatchableWorkspaceCommand,
  options: CommandDispatchOptions = {},
): string | undefined {
  const editSessionId = options.editSessionId || command.editSessionId;
  if (editSessionId) return `text-edit:${editSessionId}`;
  if (options.historyKey || command.historyKey) return options.historyKey || command.historyKey;
  return undefined;
}
