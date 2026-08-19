import { useCallback, useRef } from "react";
import { downloadWorkspaceZip, importWorkspaceFile } from "../export.js";
import { cloneTheme, downloadTheme, themeFromFile } from "../themes.js";
import { inferFileObjectType, isBareUrlValue } from "../model.js";
import { readLocalFile } from "./selectionCommands.js";
import { useObjectPluginCommands } from "../objects/registry/ObjectPluginProvider.jsx";

export function useWorkspaceCommands({
  workspace,
  replaceWorkspace,
  updateObject,
  updateCell,
  createEmbeddedObject,
  createEmbeddedLink,
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
  const openObjectRef = useRef(openObject);
  openObjectRef.current = openObject;
  const plugins = useObjectPluginCommands();
  const exportWorkspace = useCallback(async () => {
    setExportState("exporting");
    try {
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
      const imported = await importWorkspaceFile(file);
      replaceWorkspace(imported);
      resetSelection();
      showNotice(`Imported ${imported.name}`);
    } catch (error) {
      showNotice(error?.message || "That file could not be imported");
    }
  }, [replaceWorkspace, resetSelection, showNotice]);

  const createInCell = useCallback((parentObjectId, cell, type, sourceElement) => {
    if (!plugins.isEnabled(type)) {
      showNotice("Enable that cell object in Settings â†’ Plugins first");
      return;
    }
    const created = createEmbeddedObject(parentObjectId, cell.id, type);
    if (!created || !sourceElement) return;
    schedule(() => {
      openObjectRef.current({
        objectId: created.id,
        sourceObjectId: parentObjectId,
        sourceAddress: cell.address,
        sourceLabel: created.title,
        sourceType: created.type,
        sourceElement,
        mode: "floating",
      });
    }, 20);
  }, [createEmbeddedObject, plugins, schedule, showNotice]);

  const createFileInCell = useCallback(async (parentObjectId, cell, file, sourceElement) => {
    try {
      const asset = await readLocalFile(file);
      const type = inferFileObjectType(asset);
      if (!plugins.isEnabled(type)) {
        const catalogEntry = plugins.catalogEntryForType(type);
        const action = catalogEntry?.status === "available" ? "Install" : "This file type needs";
        showNotice(`${action} the ${catalogEntry?.name || type} plugin in Settings â†’ Plugins before attaching this file`);
        return;
      }
      const created = createEmbeddedFile(parentObjectId, cell.id, asset);
      if (!created || !sourceElement) return;
      schedule(() => {
        openObjectRef.current({
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
  }, [createEmbeddedFile, plugins, schedule, showNotice]);

  const openLinkCell = useCallback((parentObjectId, payload) => {
    const parent = workspace.objects[parentObjectId];
    if (parent?.type !== "sheet" || !isBareUrlValue(payload?.linkUrl)) return;
    const sourceElement = payload.sourceElement || null;
    if (!sourceElement && !payload.sourceRect) return;
    const existingEmbed = parent.cells?.[payload.sourceCellId]?.embed;
    if (existingEmbed?.objectId && workspace.objects[existingEmbed.objectId]) {
      openObject({
        ...payload,
        objectId: existingEmbed.objectId,
        linkId: existingEmbed.linkId,
        sourceObjectId: parentObjectId,
        sourceType: existingEmbed.type,
      });
      return;
    }
    // Pasted links always open in the built-in in-app browser, which fetches
    // the page through the local proxy and renders it in an iframe. No plugin
    // is required for this.
    const created = createEmbeddedLink(parentObjectId, payload.sourceCellId, payload.linkUrl);
    if (!created) return;
    schedule(() => {
      openObjectRef.current?.({
        ...payload,
        objectId: created.id,
        sourceObjectId: parentObjectId,
        sourceLabel: created.title,
        sourceType: "link",
      });
    }, 20);
  }, [createEmbeddedLink, schedule, workspace.objects]);

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
    openLinkCell,
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
