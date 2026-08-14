import { useCallback } from "react";
import { cloneTheme, downloadTheme, themeFromFile } from "../themes.js";
import { readLocalFile } from "./selectionCommands.js";

let portableCommandsPromise;

function loadPortableCommands() {
  portableCommandsPromise ||= import("../export.js");
  return portableCommandsPromise;
}

export function useWorkspaceCommands({
  workspace,
  replaceWorkspace,
  updateObject,
  updateCell,
  createEmbeddedObject,
  createEmbeddedFile,
  replaceObjectFile,
  setHomeObject,
  setActiveTheme,
  saveTheme,
  updateTheme,
  deleteTheme,
  updateSettings,
  openObject,
  schedule,
  showNotice,
  setExportState,
  importInputRef,
  resetSelection,
}) {
  const exportWorkspace = useCallback(async () => {
    setExportState("exporting");
    try {
      const { downloadWorkspaceZip } = await loadPortableCommands();
      await downloadWorkspaceZip(workspace);
      showNotice("Portable .zip workspace exported");
    } catch (error) {
      showNotice(error?.message || "Export failed");
    } finally {
      setExportState("idle");
    }
  }, [setExportState, showNotice, workspace]);

  const importWorkspace = useCallback(() => {
    importInputRef.current?.click();
  }, [importInputRef]);

  const handleImportFile = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const { importWorkspaceFile } = await loadPortableCommands();
      const imported = await importWorkspaceFile(file);
      replaceWorkspace(imported);
      resetSelection();
      showNotice(`Imported ${imported.name}`);
    } catch (error) {
      showNotice(error?.message || "That file could not be imported");
    }
  }, [replaceWorkspace, resetSelection, showNotice]);

  const createInCell = useCallback((parentObjectId, cell, type, sourceElement) => {
    const created = createEmbeddedObject(parentObjectId, cell.id, type);
    if (!created || !sourceElement) return;
    schedule(() => {
      openObject({
        objectId: created.id,
        sourceObjectId: parentObjectId,
        sourceAddress: cell.address,
        sourceLabel: created.title,
        sourceType: created.type,
        sourceElement,
        mode: "floating",
      });
    }, 20);
  }, [createEmbeddedObject, openObject, schedule]);

  const createFileInCell = useCallback(async (parentObjectId, cell, file, sourceElement) => {
    try {
      const asset = await readLocalFile(file);
      const created = createEmbeddedFile(parentObjectId, cell.id, asset);
      if (!created || !sourceElement) return;
      schedule(() => {
        openObject({
          objectId: created.id,
          sourceObjectId: parentObjectId,
          sourceAddress: cell.address,
          sourceLabel: created.title,
          sourceType: created.type,
          sourceElement,
          mode: "floating",
        });
      }, 20);
    } catch (error) {
      showNotice(error?.message || "That file could not be attached");
    }
  }, [createEmbeddedFile, openObject, schedule, showNotice]);

  const replaceFileObject = useCallback(async (objectId, file) => {
    try {
      const asset = await readLocalFile(file);
      replaceObjectFile(objectId, asset);
      showNotice(`Replaced with ${file.name}`);
    } catch (error) {
      showNotice(error?.message || "That local file could not be opened");
    }
  }, [replaceObjectFile, showNotice]);

  const importTheme = useCallback(async (file) => {
    try {
      const theme = await themeFromFile(file);
      saveTheme(theme);
      showNotice(`Imported theme: ${theme.name}`);
    } catch (error) {
      showNotice(error?.message || "That theme could not be imported");
    }
  }, [saveTheme, showNotice]);

  return {
    exportWorkspace,
    importWorkspace,
    handleImportFile,
    createInCell,
    createFileInCell,
    replaceFileObject,
    importTheme,
    cloneTheme,
    downloadTheme,
    updateObject,
    updateCell,
    setHomeObject,
    setActiveTheme,
    saveTheme,
    updateTheme,
    deleteTheme,
    updateSettings,
  };
}
