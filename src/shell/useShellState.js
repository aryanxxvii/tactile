import { useCallback, useRef, useState } from "react";

export function useShellState({ schedule }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportState, setExportState] = useState("idle");
  const [notice, setNotice] = useState("");
  const settingsReturnFocusRef = useRef(null);
  const importInputRef = useRef(null);

  const showNotice = useCallback((message) => {
    setNotice(message);
    schedule(() => setNotice(""), 2800);
  }, [schedule]);

  const openSettings = useCallback((sourceElement) => {
    settingsReturnFocusRef.current = sourceElement || document.activeElement;
    setSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    window.requestAnimationFrame(() => settingsReturnFocusRef.current?.focus?.());
  }, []);

  return {
    settingsOpen,
    setSettingsOpen,
    exportState,
    setExportState,
    notice,
    importInputRef,
    showNotice,
    openSettings,
    closeSettings,
  };
}
