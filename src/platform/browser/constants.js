export const BROWSER_DATABASE_NAME = "tactile-local-workspace-records";
export const BROWSER_DATABASE_VERSION = 1;

export const LEGACY_DATABASE_NAME = "tactile-local-workspace";
export const LEGACY_DATABASE_VERSION = 3;
export const LEGACY_STORE_NAME = "workspaces";
export const LEGACY_WORKSPACE_KEY = "current-v3";
export const LEGACY_CACHE_KEY = "tactile.workspace.v3";

export const BOOT_METADATA_KEY = "tactile.browser.boot.v1";
export const MAX_BOOT_METADATA_BYTES = 4 * 1024;

export const STORE_NAMES = Object.freeze({
  workspaceMeta: "workspaceMeta",
  objects: "objects",
  cells: "cells",
  assets: "assets",
  themes: "themes",
});

export const ALL_STORE_NAMES = Object.freeze(Object.values(STORE_NAMES));
