import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { AppDock } from "./components/AppDock.jsx";
import { SpatialLayer } from "./components/SpatialLayer.jsx";
import { useLocalWorkspace } from "./hooks/useLocalWorkspace.js";
import { ObjectSurface } from "./shell/ObjectSurface.jsx";
import { layerHistoryEntry, MAX_VISIBLE_LAYERS, useInOut } from "./shell/inOut.js";
import { useSelectionCommands } from "./shell/selectionCommands.js";
import { useShellState } from "./shell/useShellState.js";
import { buildFilesIndex } from "./shell/filesIndex.js";
import { useWorkspaceCommands } from "./shell/workspaceCommands.js";
import { reparentReasonMessage } from "./core/reparenting.js";
import {
  cloneTheme,
  resolveTheme,
  themeSheetMetrics,
  themeStyle,
} from "./themes.js";

const FilesPanel = lazy(() => import("./components/FilesPanel.jsx").then(({ FilesPanel: Component }) => ({ default: Component })));
const SettingsPanel = lazy(() => import("./components/SettingsPanel.jsx").then(({ SettingsPanel: Component }) => ({ default: Component })));
const TooltipLayer = lazy(() => import("./components/TooltipLayer.jsx").then(({ TooltipLayer: Component }) => ({ default: Component })));

function FilesPanelFallback({ pinned = false }) {
  return (
    <div className={`files-layer ${pinned ? "is-pinned" : ""}`} aria-hidden="true">
      <div className="files-scrim" aria-hidden={pinned ? "true" : undefined} />
    </div>
  );
}

export function App() {
  const workspaceState = useLocalWorkspace();
  const {
      workspace,
      hydrated,
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
    reparentObject,
    deleteObject,
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
  const inOut = useInOut({ workspace, workspaceRootId, workspaceHydrated: hydrated });
  const shell = useShellState({
    schedule: inOut.schedule,
    settings: workspace.settings,
    onUpdateSettings: updateSettings,
    workspaceHydrated: hydrated,
  });
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const pasteProxyRef = useRef(null);
  const pasteRequestRef = useRef(null);
  const pasteRequestTimeoutRef = useRef(null);
  useEffect(() => {
    const handleResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const filesIndexRef = useRef(null);
  const filesIndex = useMemo(() => {
    const next = buildFilesIndex(workspace, filesIndexRef.current);
    filesIndexRef.current = next;
    return next;
  }, [workspace]);
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
    const handleKeyDown = (event) => {
      const command = event.ctrlKey || event.metaKey;
      if (command && event.key.toLowerCase() === "p") {
        event.preventDefault();
        if (shell.filesOpen) shell.closeFiles();
        else shell.openFiles(event.target);
        return;
      }
      // Let focused controls keep their native keyboard activation. Global
      // sheet navigation should never consume Enter/Space from a toolbar or
      // menu button before the browser dispatches its click.
      if (!command && event.target?.closest?.("button, [role=\"button\"]")) return;
      const historyShortcut = command && (event.key.toLowerCase() === "z" || event.key.toLowerCase() === "y");
      const typingTarget = event.target?.closest?.("input, textarea, [contenteditable=\"true\"]");
      const isPasteProxy = event.target?.dataset?.tactilePasteProxy === "true";
      const nativeTypingTarget = typingTarget && !isPasteProxy;
      const activeGridCell = [...document.querySelectorAll('.sheet-grid-shell .sheet-cell[aria-selected="true"]')]
        .reverse()
        .find((cell) => cell.getClientRects().length > 0)
        || document.querySelector('.sheet-grid-shell .sheet-cell[aria-selected="true"]');
      const gridSurface = event.target?.closest?.(".sheet-grid-shell") || activeGridCell;
      const inFilesPanel = Boolean(event.target?.closest?.(".files-panel"));
      const gridShortcutsAvailable = Boolean(shell.filesPinned && gridSurface && !inFilesPanel);
      const formulaEditorTarget = event.target?.closest?.(".formula-editor");
      if (shell.filesOpen && !gridShortcutsAvailable && !(historyShortcut && !typingTarget)) return;
      if (command && event.key === "]" && activeGridCell && !inFilesPanel && (!nativeTypingTarget || formulaEditorTarget) && !shell.settingsOpen) {
        event.preventDefault();
        const box = activeGridCell.getBoundingClientRect();
        activeGridCell.dispatchEvent(new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: box.left + Math.min(box.width, 28),
          clientY: box.bottom,
        }));
        return;
      }
      if ((event.key === "Control" || event.key === "Meta") && gridSurface && !nativeTypingTarget && (!shell.filesOpen || gridShortcutsAvailable) && !shell.settingsOpen) {
        pasteProxyRef.current?.focus({ preventScroll: true });
        return;
      }
      if (command && event.key.toLowerCase() === "v" && gridSurface && !nativeTypingTarget && (!shell.filesOpen || gridShortcutsAvailable) && !shell.settingsOpen) {
        const request = { handled: false };
        pasteRequestRef.current = request;
        if (pasteRequestTimeoutRef.current != null) window.clearTimeout(pasteRequestTimeoutRef.current);
        pasteRequestTimeoutRef.current = window.setTimeout(() => {
          if (pasteRequestRef.current === request) pasteRequestRef.current = null;
        }, 1500);
        pasteProxyRef.current?.focus({ preventScroll: true });
        // Native ClipboardEvent data is preferred, but some preview/webview
        // hosts do not dispatch that event for a focused grid cell. Start an
        // async clipboard read from this user gesture as a coordinated fallback.
        void selection.clipboardSelectedCell("paste", request);
        return;
      }
      selection.handleKeyboard(
        event,
        shell.settingsOpen,
        shell.closeSettings,
        inOut.closeTopLayer,
        inOut.expandTopLayer,
      );
    };
    const handlePaste = (event) => {
      const activeGridCell = document.querySelector('.sheet-grid-shell .sheet-cell[aria-selected="true"]');
      const inFilesPanel = Boolean(event.target?.closest?.(".files-panel"));
      const gridPasteAvailable = Boolean(shell.filesPinned && activeGridCell && !inFilesPanel);
      if (shell.settingsOpen || (shell.filesOpen && !gridPasteAvailable)) return;
      const proxy = event.target?.dataset?.tactilePasteProxy === "true" ? event.target : null;
      const request = pasteRequestRef.current;
      Promise.resolve(selection.handlePaste(event, request)).finally(() => {
        if (proxy) proxy.value = "";
        if (request?.handled && pasteRequestRef.current === request) pasteRequestRef.current = null;
      });
    };
    const handleKeyUp = (event) => {
      if (event.key !== "Control" && event.key !== "Meta") return;
      if (document.activeElement?.dataset?.tactilePasteProxy !== "true") return;
      if (pasteRequestRef.current) return;
      document.querySelector('.sheet-grid-shell .sheet-cell[aria-selected="true"]')?.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("paste", handlePaste);
      if (pasteRequestTimeoutRef.current != null) window.clearTimeout(pasteRequestTimeoutRef.current);
    };
  }, [inOut.closeTopLayer, inOut.expandTopLayer, inOut.layers.length, selection.clipboardSelectedCell, selection.handleKeyboard, selection.handlePaste, shell.closeFiles, shell.closeSettings, shell.filesOpen, shell.filesPinned, shell.openFiles, shell.settingsOpen]);

  const objectPaths = useMemo(() => inOut.layers.map((_, index) => {
    const rootLayer = inOut.layers[0];
    // Keep the actual navigation root in the dock path even when it is the
    // workspace's ordinary Home object. The dock intentionally removes the
    // workspace shell entry, so omitting this layer made Home disappear from
    // routes such as Home / Text C18.
    const includeRoot = Boolean(rootLayer?.objectId);
    const rootObjectId = rootLayer?.objectId || workspaceRootId;
    const routeForIndex = (targetIndex) => ({
      rootObjectId,
      segments: inOut.layers.slice(1, targetIndex + 1).map((layer) => ({
        ...layerHistoryEntry(layer),
        mode: "full",
      })),
    });
    return [
      { id: workspace.id, title: workspace.name, route: routeForIndex(-1) },
      ...(includeRoot ? [{
        id: rootLayer.objectId,
        title: workspace.objects[rootLayer.objectId]?.title || "Untitled",
        route: routeForIndex(0),
      }] : []),
      ...inOut.layers.slice(1, index + 1).map((layer) => ({
      id: layer.objectId,
      title: workspace.objects[layer.objectId]?.title || "Untitled",
      route: routeForIndex(inOut.layers.indexOf(layer)),
      })),
    ];
  }), [inOut.layers, workspace, workspaceRootId]);

  const currentObject = workspace.objects[inOut.layers[inOut.layers.length - 1]?.objectId || workspaceRootId];
  const currentObjectTitle = currentObject?.title || workspace.name || "Home";
  const activeObjectId = currentObject?.id || workspaceRootId;
  const fullDockPath = objectPaths.at(-1) || [{ id: workspace.id, title: workspace.name }];
  // The root sheet is already named in the header; keep the root dock quiet,
  // while nested navigation still exposes Home as the first breadcrumb.
  const activeDockPath = inOut.layers.length === 1 && inOut.layers[0]?.objectId === workspaceRootId
    ? fullDockPath.slice(0, 1)
    : fullDockPath;

  const handleReparentObject = (payload, target) => {
    const result = reparentObject({
      objectId: payload?.objectId,
      source: payload,
      target,
    });
    if (!result?.ok) {
      shell.showNotice(reparentReasonMessage(result?.reason));
      return false;
    }
    const objectTitle = workspace.objects[result.objectId]?.title || "Object";
    const targetTitle = workspace.objects[result.targetObjectId]?.title || "Tiles";
    shell.showNotice(`${objectTitle} moved to ${targetTitle} ${result.targetAddress}`);
    return true;
  };

  useEffect(() => {
    document.title = `Tactile — ${currentObjectTitle}`;
  }, [currentObjectTitle]);

  const activeTheme = useMemo(
    () => resolveTheme(workspace.activeThemeId, workspace.themes),
    [workspace.activeThemeId, workspace.themes],
  );
  const sheetMetrics = useMemo(() => themeSheetMetrics(activeTheme), [activeTheme]);
  const visibleLayerStart = Math.max(0, inOut.layers.length - MAX_VISIBLE_LAYERS);
  const visibleLayers = inOut.layers.slice(visibleLayerStart);
  const topLayer = inOut.layers.at(-1);
  const floatingLayerActive = topLayer?.phase === "floating";
  // The worksheet and ancestor layers become inert under a floating child,
  // but the global dock remains available for direct breadcrumb navigation.
  const dockBlocked = shell.settingsOpen;
  const parentLayerSuspended = visibleLayers.length > 1;
  const parentContextVisible = parentLayerSuspended && topLayer?.phase !== "full";
  const filesSidebarWidth = shell.filesPinned && shell.filesOpen && viewport.width > 620
    ? Math.min(shell.filesWidth, Math.max(0, viewport.width - 24))
    : 0;

  const renderObject = (layer, index) => {
    const object = workspace.objects[layer.objectId];
    if (!object) return null;
    const isTopLayer = index > 0 && index === inOut.layers.length - 1;
    const isVisibleParentLayer = parentContextVisible && index === inOut.layers.length - 2;
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
      onReparentObject: handleReparentObject,
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
          setHomeObject(objectId, inOut.homePathForObject(objectId));
          shell.showNotice(`${workspace.objects[objectId]?.title || "Object"} is now the start object`);
        },
        onExport: commands.exportWorkspace,
        onImport: commands.importWorkspace,
      },
      onBack: inOut.closeTopLayer,
      canGoBack: isTopLayer
        || (isVisibleParentLayer && index > 0)
        || (index === 0 && Boolean(object.parent?.parentObjectId)),
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
      className={`tactile-app ${shell.filesPinned && shell.filesOpen ? "files-is-pinned" : ""} ${floatingLayerActive ? "has-floating-layer" : ""} ${shell.settingsOpen ? "settings-open" : ""}`}
        data-paper-scheme
      data-files-pinned={shell.filesPinned ? "true" : undefined}
      data-files-resizing={shell.filesResizing ? "true" : undefined}
      data-reduce-motion={workspace.settings.reduceMotion ? "true" : "false"}
      style={{ ...themeStyle(activeTheme), "--files-sidebar-width": `${shell.filesWidth}px` }}
    >
      <div
        className="workspace-shell"
        data-logical-layer-count={inOut.layers.length}
        data-rendered-layer-count={visibleLayers.length}
        inert={shell.settingsOpen || (shell.filesOpen && !shell.filesPinned)}
        aria-hidden={shell.settingsOpen || (shell.filesOpen && !shell.filesPinned) ? "true" : undefined}
      >
        <input
          ref={shell.importInputRef}
          className="native-file-input"
          type="file"
          accept=".tactile,.zip,.json,application/zip,application/json"
          onChange={commands.handleImportFile}
          tabIndex={-1}
          aria-hidden="true"
        />
        <textarea
          ref={pasteProxyRef}
          className="native-paste-proxy"
          data-tactile-paste-proxy="true"
          aria-hidden="true"
          tabIndex={-1}
          defaultValue=""
          spellCheck="false"
        />
        <div
          className="base-object-layer"
          inert={parentLayerSuspended}
          data-under-floating-layer={parentContextVisible ? "true" : undefined}
        >
          {renderObject(visibleLayers[0], visibleLayerStart)}
        </div>

        {visibleLayers.slice(1).map((layer, childIndex) => (
          <SpatialLayer
            layer={layer}
            depth={childIndex + 1}
            viewportInsetLeft={filesSidebarWidth}
            key={layer.key}
            onExpand={inOut.expandLayer}
            onClose={inOut.closeTopLayer}
          >
            {renderObject(layer, visibleLayerStart + childIndex + 1)}
          </SpatialLayer>
        ))}
      </div>

      <div
        className="app-bottom-bar"
        aria-label="Tactile bottom bar"
        inert={dockBlocked || undefined}
        data-interaction-blocked={dockBlocked ? "true" : undefined}
      >
        <AppDock
          path={activeDockPath}
          onNavigatePath={(item) => inOut.navigateToRoute(item.route, { mode: "full" })}
          filesOpen={shell.filesOpen}
          onOpenFiles={shell.toggleFiles}
          onOpenSettings={shell.openSettings}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
        />
      </div>

      {shell.filesOpen ? (
        <Suspense fallback={<FilesPanelFallback pinned={shell.filesPinned} />}>
          <FilesPanel
            index={filesIndex}
            activeObjectId={activeObjectId}
            pinned={shell.filesPinned}
            width={shell.filesWidth}
            onOpenRoute={(route) => inOut.navigateToRoute(route, { mode: "full", immediate: true })}
            onUpdateObject={updateObject}
            onReparentObject={handleReparentObject}
            onDeleteObject={(objectId) => {
              const title = workspace.objects[objectId]?.title || "Object";
              deleteObject(objectId);
              shell.showNotice(`${title} deleted`);
            }}
            onSetHome={(objectId, route) => {
              setHomeObject(objectId, route?.segments || inOut.homePathForObject(objectId));
              shell.showNotice(`${workspace.objects[objectId]?.title || "Object"} is now the start object`);
            }}
            onNotice={shell.showNotice}
            onTogglePinned={shell.toggleFilesPinned}
            onResize={shell.updateFilesWidth}
            onResizeStateChange={shell.setFilesResizing}
            onClose={shell.closeFiles}
          />
        </Suspense>
      ) : null}

      {shell.settingsOpen ? (
        <Suspense fallback={null}>
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
        </Suspense>
      ) : null}

      {shell.notice ? <div className="app-notice" role="status">{shell.notice}</div> : null}
      <Suspense fallback={null}>
        <TooltipLayer />
      </Suspense>
    </div>
  );
}
