const commit = String(import.meta.env.VITE_TACTILE_COMMIT || "unknown").trim();

export const TACTILE_COMMIT = commit || "unknown";
export const TACTILE_COMMIT_SHORT = TACTILE_COMMIT.slice(-4);
export const TACTILE_COMMIT_DIRTY = String(import.meta.env.VITE_TACTILE_DIRTY || "false") === "true";
