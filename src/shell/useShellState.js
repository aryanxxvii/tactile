import { useCallback, useEffect, useRef, useState } from "react";

const LEGACY_FILES_PINNED_STORAGE_KEY = "tactile.files.pinned";
const LEGACY_FILES_WIDTH_STORAGE_KEY = "tactile.files.width";
export const FILES_DEFAULT_WIDTH = 360;
export const FILES_MIN_WIDTH = 280;
export const FILES_MAX_WIDTH = 560;

function readLegacyFilesPreferences() {
  try {
    const pinned = window.localStorage.getItem(LEGACY_FILES_PINNED_STORAGE_KEY);
    const width = window.localStorage.getItem(LEGACY_FILES_WIDTH_STORAGE_KEY);
    if (pinned == null && width == null) return null;
    return {
      filesPinned: pinned === "true",
      filesWidth: width == null ? FILES_DEFAULT_WIDTH : clampFilesWidth(width),
    };
  } catch {
    return null;
  }
}

function clearLegacyFilesPreferences() {
  try {
    window.localStorage.removeItem(LEGACY_FILES_PINNED_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_FILES_WIDTH_STORAGE_KEY);
  } catch {
    // Local storage may be unavailable in a restricted browser context.
  }
}

function clampFilesWidth(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return FILES_DEFAULT_WIDTH;
  return Math.min(FILES_MAX_WIDTH, Math.max(FILES_MIN_WIDTH, Math.round(numericValue)));
}

export function useShellState({ schedule, settings, onUpdateSettings, workspaceHydrated = false }) {
  const [legacyPreferences] = useState(readLegacyFilesPreferences);
  const legacyMigrationRef = useRef(false);
  const hasPinnedSetting = Object.prototype.hasOwnProperty.call(settings || {}, "filesPinned");
  const hasWidthSetting = Object.prototype.hasOwnProperty.call(settings || {}, "filesWidth");
  const filesPinned = hasPinnedSetting
    ? settings.filesPinned === true
    : legacyPreferences?.filesPinned || false;
  const filesWidth = hasWidthSetting
    ? clampFilesWidth(settings.filesWidth)
    : legacyPreferences?.filesWidth || FILES_DEFAULT_WIDTH;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(filesPinned);
  const [filesResizing, setFilesResizing] = useState(false);
  const [exportState, setExportState] = useState("idle");
  const [notice, setNotice] = useState("");
  const settingsReturnFocusRef = useRef(null);
  const filesReturnFocusRef = useRef(null);
  const importInputRef = useRef(null);

  useEffect(() => {
    if (!workspaceHydrated || legacyMigrationRef.current) return;
    const patch = {};
    if (!hasPinnedSetting) patch.filesPinned = legacyPreferences?.filesPinned ?? false;
    if (!hasWidthSetting) patch.filesWidth = legacyPreferences?.filesWidth ?? FILES_DEFAULT_WIDTH;
    if (Object.keys(patch).length && !onUpdateSettings) return;
    legacyMigrationRef.current = true;
    if (Object.keys(patch).length) onUpdateSettings(patch);
    if (legacyPreferences) clearLegacyFilesPreferences();
  }, [hasPinnedSetting, hasWidthSetting, legacyPreferences, onUpdateSettings, workspaceHydrated]);

  useEffect(() => {
    if (filesPinned) setFilesOpen(true);
  }, [filesPinned]);

  const showNotice = useCallback((message) => {
    setNotice(message);
    schedule(() => setNotice(""), 2800);
  }, [schedule]);

  const openSettings = useCallback((sourceElement) => {
    settingsReturnFocusRef.current = sourceElement || document.activeElement;
    setFilesOpen(false);
    setSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    if (filesPinned) setFilesOpen(true);
    window.requestAnimationFrame(() => settingsReturnFocusRef.current?.focus?.());
  }, [filesPinned]);

  const openFiles = useCallback((sourceElement) => {
    filesReturnFocusRef.current = sourceElement || document.activeElement;
    setSettingsOpen(false);
    setFilesOpen(true);
  }, []);

  const closeFiles = useCallback(() => {
    setFilesOpen(false);
    window.requestAnimationFrame(() => filesReturnFocusRef.current?.focus?.());
  }, []);

  const toggleFiles = useCallback((sourceElement) => {
    if (filesOpen) {
      closeFiles();
      return;
    }
    openFiles(sourceElement);
  }, [closeFiles, filesOpen, openFiles]);

  const toggleFilesPinned = useCallback(() => {
    const next = !filesPinned;
    onUpdateSettings?.({ filesPinned: next });
    setSettingsOpen(false);
    setFilesOpen(true);
  }, [filesPinned, onUpdateSettings]);

  const updateFilesWidth = useCallback((value) => {
    const next = clampFilesWidth(value);
    onUpdateSettings?.({ filesWidth: next });
  }, [onUpdateSettings]);

  return {
    settingsOpen,
    setSettingsOpen,
    filesOpen,
    setFilesOpen,
    filesPinned,
    toggleFilesPinned,
    filesWidth,
    updateFilesWidth,
    filesResizing,
    setFilesResizing,
    exportState,
    setExportState,
    notice,
    importInputRef,
    showNotice,
    openSettings,
    closeSettings,
    openFiles,
    closeFiles,
    toggleFiles,
  };
}
