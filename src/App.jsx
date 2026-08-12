import { useEffect, useMemo } from "react";
import { SettingsPanel } from "./components/SettingsPanel.jsx";
import { SpatialLayer } from "./components/SpatialLayer.jsx";
import { useLocalWorkspace } from "./hooks/useLocalWorkspace.js";
import { ObjectSurface } from "./shell/ObjectSurface.jsx";
import { useInOut } from "./shell/inOut.js";
import { useSelectionCommands } from "./shell/selectionCommands.js";
import { useShellState } from "./shell/useShellState.js";
import { useWorkspaceCommands } from "./shell/workspaceCommands.js";
import {
  cloneTheme,
  resolveTheme,
  themeSheetMetrics,
  themeStyle,
} from "./themes.js";

export function App() {
  const workspaceState = useLocalWorkspace();
  const {
    workspace,
    saveState,
    replaceWorkspace,
    updateObject,
    updateCell,
    updateCells,
    clearCell,
    clearCells,
    createEmbeddedObject,
    createEmbeddedFile,
    replaceObjectFile,
    insertSheetAxis,
    deleteSheetAxis,
    moveSheetAxis,
    setHomeObject,
    setActiveTheme,
    saveTheme,
    updateTheme,
    deleteTheme,
    updateSettings,
    undo,
    redo,
    canUndo,
    canRedo,
  } = workspaceState;
  const workspaceRootId = workspace.homeObjectId;
  const inOut = useInOut({ workspace, workspaceRootId });
  const shell = useShellState({ schedule: inOut.schedule });
  const selection = useSelectionCommands({
    workspace,
    layers: inOut.layers,
    openObject: inOut.openObject,
    showNotice: shell.showNotice,
    updateCells,
    clearCells,
    createEmbeddedFile,
    undo,
    redo,
  });
  const commands = useWorkspaceCommands({
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
    openObject: inOut.openObject,
    schedule: inOut.schedule,
    showNotice: shell.showNotice,
    setExportState: shell.setExportState,
    importInputRef: shell.importInputRef,
    resetSelection: selection.resetSelection,
  });

  useEffect(() => {
    const handleKeyDown = (event) => selection.handleKeyboard(
      event,
      shell.settingsOpen,
      shell.closeSettings,
      inOut.closeTopLayer,
      inOut.expandTopLayer,
    );
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [inOut.closeTopLayer, inOut.expandTopLayer, selection.handleKeyboard, shell.closeSettings, shell.settingsOpen]);

  const objectPaths = useMemo(() => inOut.layers.map((_, index) => [
    { id: workspace.id, title: workspace.name },
    ...inOut.layers.slice(0, index + 1).map((layer) => ({
      id: layer.objectId,
      title: workspace.objects[layer.objectId]?.title || "Untitled",
    })),
  ]), [inOut.layers, workspace]);

  const currentObject = workspace.objects[inOut.layers[inOut.layers.length - 1]?.objectId || workspaceRootId];
  const currentObjectTitle = currentObject?.title || workspace.name || "Home";

  useEffect(() => {
    document.title = `Tactile — ${currentObjectTitle}`;
  }, [currentObjectTitle]);

  const activeTheme = useMemo(
    () => resolveTheme(workspace.activeThemeId, workspace.themes),
    [workspace.activeThemeId, workspace.themes],
  );
  const sheetMetrics = useMemo(() => themeSheetMetrics(activeTheme), [activeTheme]);

  const renderObject = (layer, index) => {
    const object = workspace.objects[layer.objectId];
    if (!object) return null;
    const selectedAddress = selection.selectedByObject[object.id] || "A1";
    const selectionRange = selection.rangeByObject[object.id] || { anchor: selectedAddress, focus: selectedAddress };
    const sharedProps = {
      object,
      path: objectPaths[index],
      saveState,
      selectedAddress,
      selectionRange,
      workspaceObjects: workspace.objects,
      onSelectAddress: (address) => selection.selectAddress(object.id, address),
      onSelectRange: (anchor, focus, active) => selection.selectRange(object.id, anchor, focus, active),
      onUpdateObject: (patch) => updateObject(object.id, patch),
      onUpdateCell: (cellId, patch) => updateCell(object.id, cellId, patch),
      onUpdateCells: (changes, historyKey) => updateCells(object.id, changes, historyKey),
      onOpenObject: (payload) => inOut.openObject({ ...payload, sourceObjectId: object.id }),
      onCreateEmbedded: (cell, type, sourceElement) => commands.createInCell(object.id, cell, type, sourceElement),
      onCreateFile: (cell, file, sourceElement) => commands.createFileInCell(object.id, cell, file, sourceElement),
      onReplaceFile: (file) => commands.replaceFileObject(object.id, file),
      onClearCell: (cellId) => clearCell(object.id, cellId),
      onInsertAxis: (axis, indexToInsert) => insertSheetAxis(object.id, axis, indexToInsert),
      onDeleteAxis: (axis, indexToDelete) => deleteSheetAxis(object.id, axis, indexToDelete),
      onMoveAxis: (axis, from, to) => moveSheetAxis(object.id, axis, from, to),
      sheetMetrics,
      assets: workspace.assets,
      workspaceActions: {
        homeObjectId: workspace.homeObjectId,
        exportState: shell.exportState,
        onSetHome: (objectId) => {
          setHomeObject(objectId);
          shell.showNotice(`${workspace.objects[objectId]?.title || "Object"} is now home`);
        },
        onExport: commands.exportWorkspace,
        onImport: commands.importWorkspace,
      },
      onBack: inOut.closeTopLayer,
      canGoBack: index > 0,
      onOpenSettings: shell.openSettings,
      onUndo: undo,
      onRedo: redo,
      canUndo,
      canRedo,
    };

    return <ObjectSurface {...sharedProps} />;
  };

  return (
    <div
      className="tactile-app"
      data-paper-scheme
      data-reduce-motion={workspace.settings.reduceMotion ? "true" : "false"}
      style={themeStyle(activeTheme)}
    >
      <div className="workspace-shell" inert={shell.settingsOpen} aria-hidden={shell.settingsOpen ? "true" : undefined}>
        <input
          ref={shell.importInputRef}
          className="native-file-input"
          type="file"
          accept=".tactile,.zip,.json,application/zip,application/json"
          onChange={commands.handleImportFile}
          tabIndex={-1}
          aria-hidden="true"
        />
        <div className="base-object-layer">{renderObject(inOut.layers[0], 0)}</div>

        {inOut.layers.slice(1).map((layer, childIndex) => (
          <SpatialLayer
            layer={layer}
            depth={childIndex + 1}
            key={layer.key}
            onExpand={inOut.expandLayer}
            onClose={inOut.closeTopLayer}
          >
            {renderObject(layer, childIndex + 1)}
          </SpatialLayer>
        ))}
      </div>

      {shell.settingsOpen ? (
        <SettingsPanel
          activeTheme={activeTheme}
          customThemes={workspace.themes}
          settings={workspace.settings}
          onSelectTheme={setActiveTheme}
          onCloneTheme={(theme) => saveTheme(cloneTheme(theme))}
          onUpdateTheme={updateTheme}
          onDeleteTheme={deleteTheme}
          onImportTheme={commands.importTheme}
          onExportTheme={commands.downloadTheme}
          onUpdateSettings={updateSettings}
          onExportWorkspace={commands.exportWorkspace}
          onImportWorkspace={commands.importWorkspace}
          onClose={shell.closeSettings}
        />
      ) : null}

      {shell.notice ? <div className="app-notice" role="status">{shell.notice}</div> : null}
    </div>
  );
}
