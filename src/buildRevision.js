const commit = String(import.meta.env.VITE_TACTILE_COMMIT || "unknown").trim();
const version = String(import.meta.env.VITE_TACTILE_VERSION || "development").trim();
const channel = String(import.meta.env.VITE_TACTILE_CHANNEL || "development").trim();
const platform = String(import.meta.env.VITE_TACTILE_PLATFORM || "web").trim();

export const TACTILE_COMMIT = commit || "unknown";
export const TACTILE_COMMIT_SHORT = TACTILE_COMMIT.slice(-4);
export const TACTILE_COMMIT_DIRTY = String(import.meta.env.VITE_TACTILE_DIRTY || "false") === "true";
export const TACTILE_VERSION = version || "development";
export const TACTILE_CHANNEL = channel || "development";
export const TACTILE_PLATFORM = platform || "web";
