import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  IconAdjustments,
  IconBrackets,
  IconCheck,
  IconCopy,
  IconDownload,
  IconFileTypeCsv,
  IconFolderOpen,
  IconKeyboard,
  IconLayoutList,
IconMoon,
  IconPalette,
  IconPlugConnected,
  IconPlus,
  IconRefresh,
  IconSparkles,
  IconSun,
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { allThemes } from "../themes.js";
import {
  TACTILE_CHANNEL,
  TACTILE_COMMIT_SHORT,
  TACTILE_PLATFORM,
  TACTILE_VERSION,
} from "../buildRevision.js";
import { ColorControl } from "./controls/ColorControl.jsx";
import { SelectMenu } from "./controls/SelectMenu.jsx";
import { Switch } from "./controls/Switch.jsx";
import { useObjectPlugins } from "../objects/registry/ObjectPluginProvider.jsx";
import { isPluginUpdateAvailable, marketplaceInstallSize } from "../objects/registry/marketplace.js";
import {
  WORKSPACE_AUTHORING_PROMPT,
  WORKSPACE_AUTHORING_PROMPT_VERSION,
} from "../workspaceAuthoringPrompt.js";

const colorTokens = [
  ["appBackground", "App background"],
  ["paper", "Paper"],
  ["paperElevated", "Raised paper"],
  ["tray", "Tile tray"],
  ["cell", "Tile face"],
  ["cellHover", "Hover face"],
  ["ink", "Ink"],
  ["defaultInk", "Default tile ink"],
  ["muted", "Muted ink"],
  ["faint", "Faint ink"],
  ["line", "Fine rule"],
  ["lineStrong", "Strong rule"],
  ["accent", "Focus accent"],
  ["focusRing", "Keyboard focus"],
  ["positive", "Positive data"],
  ["negative", "Negative data"],
];

const dimensionTokens = [
  ["cellHeight", "Tile height", 24, 44, "px"],
  ["columnWidth", "Tile width", 84, 220, "px"],
  ["cellRadius", "Tile radius", 0, 14, "px"],
  ["cellGap", "Tile seam", 0, 5, "px"],
  ["titleSize", "Title size", 17, 22, "px"],
  ["titleWeight", "Title weight", 400, 780, ""],
];

const themeFilters = [
  { id: "all", label: "All themes", icon: IconLayoutList },
  { id: "light", label: "Light themes", icon: IconSun },
  { id: "dark", label: "Dark themes", icon: IconMoon },
];

function boundedTokenValue(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : min;
}

function formatPluginSize(bytes) {
  const size = Math.max(0, Number(bytes) || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function transferLabel(transfer) {
  if (!transfer) return "";
  if (transfer.phase === "verifying" || transfer.phase === "verified") return "Verifying";
  if (transfer.phase === "installing") return "Installing";
  if (transfer.phase === "saving") return "Saving";
  return "Downloading";
}

function SettingTab({ active, icon: Icon, children, onClick, id, controls }) {
  return (
    <button
      className={active ? "is-active" : ""}
      type="button"
      role="tab"
      id={id}
      aria-controls={controls}
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
    >
      <Icon size={15} stroke={1.6} />
      {children}
    </button>
  );
}

function ThemeCard({ theme, selected, onSelect }) {
  return (
    <button className={`theme-card ${selected ? "is-selected" : ""}`} type="button" onClick={onSelect}>
      <span className="theme-swatch" style={{ background: theme.tokens.paper }}>
        <i style={{ background: theme.tokens.tray }} />
        <i style={{ background: theme.tokens.accent }} />
        <i style={{ background: theme.tokens.ink }} />
      </span>
      <span>
        <strong>{theme.name}</strong>
        <small>{theme.builtIn ? "Built in" : "Your theme"}</small>
      </span>
    </button>
  );
}

function PluginSettingsLoading({ contribution }) {
  return (
    <div className="plugin-settings-loading" role="status" aria-live="polite">
      <div className="plugin-settings-loading-mark" aria-hidden="true">
        <IconBrackets size={22} stroke={1.45} />
      </div>
      <div className="plugin-settings-loading-copy">
        <span>Plugin settings</span>
        <strong>{contribution.loadingLabel || `Loading ${contribution.label}`}</strong>
        <code aria-hidden="true">
          <i>&gt;</i> detect <b>runtime</b><em>_</em>
        </code>
      </div>
    </div>
  );
}

function PluginSettingsContent({ contribution }) {
  const Panel = useMemo(() => lazy(async () => {
    const loaded = await contribution.load();
    return { default: loaded?.default || loaded };
  }), [contribution]);
  return (
    <div className="plugin-settings-panel" id={contribution.panelId} role="tabpanel" aria-labelledby={contribution.tabId}>
      <Suspense fallback={<PluginSettingsLoading contribution={contribution} />}>
        <Panel />
      </Suspense>
    </div>
  );
}

export function SettingsPanel({
  activeTheme,
  customThemes,
  settings,
  onSelectTheme,
  onCloneTheme,
  onUpdateTheme,
  onDeleteTheme,
  onImportTheme,
  onExportTheme,
  onUpdateSettings,
  onExportWorkspace,
onChangeWorkspaceFolder,
  onOpenWorkspaceFolder,
  onGetUpdateChannel,
  onSetUpdateChannel,
  onCheckForUpdate,
  onDownloadAndInstallUpdate,
  onOpenGuide,
  onClose,
}) {
  const plugins = useObjectPlugins();
  const [tab, setTab] = useState("appearance");
  const [themeFilter, setThemeFilter] = useState("all");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [authoringPromptCopied, setAuthoringPromptCopied] = useState(false);
  const [updateState, setUpdateState] = useState("idle");
  const [updateInfo, setUpdateInfo] = useState(null);
  const [updateChannel, setUpdateChannel] = useState(null);
  const [channelChanging, setChannelChanging] = useState(false);
  const themeInputRef = useRef(null);
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const themes = useMemo(() => allThemes(customThemes), [customThemes]);
  const visibleThemes = useMemo(
    () => themeFilter === "all"
      ? themes
      : themes.filter((theme) => theme.tokens.colorScheme === themeFilter),
    [themeFilter, themes],
  );
  const editable = !activeTheme.builtIn;
  const activePluginSettings = plugins.settingsContributions.find((contribution) => `plugin:${contribution.key}` === tab);

  const updateToken = (token, value) => {
    if (!editable) return;
    onUpdateTheme(activeTheme.id, { tokens: { [token]: value } });
  };

  const copyAuthoringPrompt = async () => {
    try {
      await navigator.clipboard.writeText(WORKSPACE_AUTHORING_PROMPT);
    } catch {
      const fallback = document.createElement("textarea");
      fallback.value = WORKSPACE_AUTHORING_PROMPT;
      fallback.setAttribute("readonly", "true");
      fallback.style.position = "fixed";
      fallback.style.opacity = "0";
      document.body.appendChild(fallback);
      fallback.select();
      document.execCommand("copy");
      fallback.remove();
    }
    setAuthoringPromptCopied(true);
    window.setTimeout(() => setAuthoringPromptCopied(false), 1800);
  };

  useEffect(() => {
    closeRef.current?.focus();
    const keepFocusInside = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(panelRef.current?.querySelectorAll(
        'button:not(:disabled), a[href], input:not(:disabled):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])',
      ) || [])].filter((element) => !element.hidden && element.getClientRects().length);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", keepFocusInside, true);
    return () => window.removeEventListener("keydown", keepFocusInside, true);
  }, [onClose]);

  useEffect(() => setDeleteConfirm(false), [activeTheme.id]);
  useEffect(() => {
    if (tab.startsWith("plugin:") && !activePluginSettings) setTab("plugins");
  }, [activePluginSettings, tab]);

  useEffect(() => {
    if (tab !== "updates" || !onGetUpdateChannel) return undefined;
    let active = true;
    onGetUpdateChannel()
      .then((channel) => {
        if (active) setUpdateChannel(channel);
      })
      .catch(() => {
        if (active) setUpdateState("error");
      });
    return () => {
      active = false;
    };
  }, [onGetUpdateChannel, tab]);

  const runUpdateCheck = async () => {
    if (!onCheckForUpdate) return;
    setUpdateState("checking");
    try {
      const result = await onCheckForUpdate();
      if (!result) {
        setUpdateInfo(null);
        setUpdateState("current");
      } else {
        setUpdateInfo(result);
        setUpdateState("available");
      }
    } catch {
      setUpdateState("error");
    }
  };

  const runUpdateInstall = async () => {
    if (!onDownloadAndInstallUpdate) return;
    setUpdateState("installing");
    try {
      await onDownloadAndInstallUpdate();
    } catch {
      setUpdateState("error");
    }
  };

  const changeUpdateChannel = async (channel) => {
    if (!onSetUpdateChannel || channel === updateChannel) return;
    setChannelChanging(true);
    setUpdateInfo(null);
    try {
      const selected = await onSetUpdateChannel(channel);
      setUpdateChannel(selected);
      await runUpdateCheck();
    } catch {
      setUpdateState("error");
    } finally {
      setChannelChanging(false);
    }
  };

  return (
    <div className="settings-layer" role="presentation">
      <button className="settings-scrim" type="button" aria-label="Dismiss settings" onClick={onClose} />
      <section ref={panelRef} className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="tactile-settings-title">
        <header className="settings-header">
          <div>
            <span>Workspace preferences</span>
            <h2 id="tactile-settings-title">Settings</h2>
          </div>
          <button ref={closeRef} type="button" className="settings-close" onClick={onClose} aria-label="Close settings"><IconX size={17} /></button>
        </header>

        <nav
          className="settings-tabs"
          role="tablist"
          aria-label="Settings sections"
          aria-orientation="vertical"
          onKeyDown={(event) => {
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
            const tabs = [...event.currentTarget.querySelectorAll('[role="tab"]')];
            const activeIndex = Math.max(0, tabs.indexOf(document.activeElement));
            const nextIndex = event.key === "Home"
              ? 0
              : event.key === "End"
                ? tabs.length - 1
                : (activeIndex + (event.key === "ArrowDown" ? 1 : -1) + tabs.length) % tabs.length;
            event.preventDefault();
            tabs[nextIndex]?.focus();
            tabs[nextIndex]?.click();
          }}
        >
          <SettingTab id="settings-tab-appearance" controls="settings-panel-appearance" active={tab === "appearance"} icon={IconPalette} onClick={() => setTab("appearance")}>Appearance</SettingTab>
<SettingTab id="settings-tab-files" controls="settings-panel-files" active={tab === "files"} icon={IconFileTypeCsv} onClick={() => setTab("files")}>Files &amp; ownership</SettingTab>
          <SettingTab id="settings-tab-keyboard" controls="settings-panel-keyboard" active={tab === "keyboard"} icon={IconKeyboard} onClick={() => setTab("keyboard")}>Keyboard</SettingTab>
          <SettingTab id="settings-tab-plugins" controls="settings-panel-plugins" active={tab === "plugins"} icon={IconPlugConnected} onClick={() => setTab("plugins")}>Plugins</SettingTab>
          {plugins.settingsContributions.map((contribution) => (
            <SettingTab
              key={contribution.key}
              id={contribution.tabId}
              controls={contribution.panelId}
              active={tab === `plugin:${contribution.key}`}
              icon={contribution.icon}
              onClick={() => setTab(`plugin:${contribution.key}`)}
            >
              {contribution.label}
            </SettingTab>
          ))}
          {onCheckForUpdate ? (
            <SettingTab id="settings-tab-updates" controls="settings-panel-updates" active={tab === "updates"} icon={IconRefresh} onClick={() => setTab("updates")}>Updates</SettingTab>
          ) : null}
          <SettingTab id="settings-tab-agents" controls="settings-panel-agents" active={tab === "agents"} icon={IconSparkles} onClick={() => setTab("agents")}>Agents.md</SettingTab>
        </nav>

        <div className="settings-content">
          {activePluginSettings ? <PluginSettingsContent contribution={activePluginSettings} /> : null}
          {tab === "appearance" ? (
            <div className="appearance-settings" id="settings-panel-appearance" role="tabpanel" aria-labelledby="settings-tab-appearance">
              <aside className="theme-sidebar">
                <div className="settings-section-title">
                  <span>Themes</span>
                  <button type="button" onClick={() => themeInputRef.current?.click()} data-tooltip="Import theme"><IconUpload size={14} /></button>
                </div>
                <div className="theme-filter-row" role="group" aria-label="Filter themes">
                  {themeFilters.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      className={themeFilter === id ? "is-active" : ""}
                      type="button"
                      aria-label={label}
                      aria-pressed={themeFilter === id}
                      data-tooltip={label}
                      onClick={() => setThemeFilter(id)}
                    >
                      <Icon size={13} stroke={1.7} aria-hidden="true" />
                    </button>
                  ))}
                </div>
                <div className="theme-list">
                  {visibleThemes.map((theme) => (
                    <ThemeCard key={theme.id} theme={theme} selected={activeTheme.id === theme.id} onSelect={() => onSelectTheme(theme.id)} />
                  ))}
                  {!visibleThemes.length ? <p className="theme-filter-empty">No themes in this group.</p> : null}
                </div>
                <input
                  ref={themeInputRef}
                  className="native-file-input"
                  type="file"
                  accept=".json,.tactile-theme.json,application/json"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) onImportTheme(file);
                  }}
                />
              </aside>

              <div className="theme-editor">
                <div className="theme-editor-heading">
                  <div>
                    <span>{editable ? "Editing your theme" : "Built-in foundation"}</span>
                    {editable ? (
                      <input value={activeTheme.name} onChange={(event) => onUpdateTheme(activeTheme.id, { name: event.target.value })} aria-label="Theme name" />
                    ) : <h3>{activeTheme.name}</h3>}
                    <p>{activeTheme.description}</p>
                  </div>
                  <div className="theme-heading-actions">
                    {!editable ? <button type="button" onClick={() => onCloneTheme(activeTheme)}><IconPlus size={14} /> Customise</button> : null}
                    <button type="button" onClick={() => onExportTheme(activeTheme)}><IconDownload size={14} /> Export</button>
                    {editable && !deleteConfirm ? <button className="is-danger" type="button" onClick={() => setDeleteConfirm(true)} data-tooltip="Delete theme"><IconTrash size={14} /></button> : null}
                  </div>
                </div>

                {editable && deleteConfirm ? (
                  <div className="theme-delete-confirm" role="alert">
                    <span>Delete “{activeTheme.name}”? Export it first if you may need it again.</span>
                    <button type="button" onClick={() => setDeleteConfirm(false)}>Cancel</button>
                    <button className="is-danger" type="button" onClick={() => { onDeleteTheme(activeTheme.id); setDeleteConfirm(false); }}>Delete theme</button>
                  </div>
                ) : null}

                <fieldset disabled={!editable}>
                  <legend>Paper &amp; ink</legend>
                  <div className="color-token-grid">
                    {colorTokens.map(([token, label]) => (
                      <ColorControl
                        key={token}
                        label={label}
                        value={activeTheme.tokens[token]}
                        disabled={!editable}
                        onChange={(value) => updateToken(token, value)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset disabled={!editable}>
                  <legend>Density &amp; shape</legend>
                  <div className="dimension-token-grid">
                    {dimensionTokens.map(([token, label, min, max, unit]) => (
                      <label className="dimension-token" key={token}>
                        <span>{label}</span>
                        <input
                          type="range"
                          min={min}
                          max={max}
                          value={boundedTokenValue(activeTheme.tokens[token], min, max)}
                          onChange={(event) => updateToken(token, Number(event.target.value))}
                        />
                        <output>{boundedTokenValue(activeTheme.tokens[token], min, max)}{unit}</output>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset disabled={!editable}>
                  <legend>Typography</legend>
                  <label className="font-token">
                    <span>Interface family</span>
                    <SelectMenu
                      ariaLabel="Interface font family"
                      value={activeTheme.tokens.uiFont}
                      disabled={!editable}
                      onChange={(value) => updateToken("uiFont", value)}
                      options={[
                        { value: '"Public Sans Variable", "Segoe UI Variable", Arial, sans-serif', label: "Public Sans", detail: "Current lead" },
                        { value: 'system-ui, "Segoe UI Variable", sans-serif', label: "System UI", detail: "Native and fast" },
                        { value: '"Lilex Variable", "Cascadia Mono", monospace', label: "Lilex", detail: "Technical" },
                      ]}
                    />
                  </label>
                  <label className="font-token">
                    <span>Code &amp; coordinates</span>
                    <SelectMenu
                      ariaLabel="Coordinate font family"
                      value={activeTheme.tokens.monoFont}
                      disabled={!editable}
                      onChange={(value) => updateToken("monoFont", value)}
                      options={[
                        { value: '"Lilex Variable", "Cascadia Mono", Consolas, monospace', label: "Lilex", detail: "Zed-like clarity" },
                        { value: 'ui-monospace, "Cascadia Mono", Consolas, monospace', label: "System Mono", detail: "Platform default" },
                      ]}
                    />
                  </label>
                </fieldset>
                {!editable ? <p className="theme-edit-hint">Clone a built-in theme to edit every token without changing the original.</p> : null}
              </div>
            </div>
          ) : null}

          {tab === "files" ? (
            <div className="files-settings" id="settings-panel-files" role="tabpanel" aria-labelledby="settings-tab-files">
              <IconFileTypeCsv size={30} stroke={1.35} />
              <h3>Your files, not our cloud</h3>
              <p>A Tactile workspace is a portable bundle. Tiles are sparse CSV files; Markdown, PDFs, images, video, HTML and SVG stay separate and readable.</p>
              <pre><code>workspace.json{"\n"}objects/home/sheet.csv{"\n"}objects/text-…/content.md{"\n"}themes/your-theme.json</code></pre>
              <div className="files-actions">
                <button type="button" onClick={onExportWorkspace}><IconDownload size={15} /> Export .zip</button>
                {onOpenGuide ? <button type="button" onClick={onOpenGuide}><IconSparkles size={15} /> Open getting started guide</button> : null}
              </div>
              {onChangeWorkspaceFolder ? (
                <div className="native-workspace-settings">
                  <div className="native-workspace-heading">
                    <IconFolderOpen size={18} stroke={1.5} />
                    <span><strong>Home directory</strong><small>Every change is saved here as readable local files.</small></span>
                  </div>
                  <p className="native-workspace-location"><span>{settings.nativeWorkspacePath || "No home directory selected"}</span></p>
                  <div className="native-workspace-actions">
                    <button type="button" onClick={onChangeWorkspaceFolder}><IconFolderOpen size={14} /> Change folder</button>
                    {settings.nativeWorkspacePath ? <button type="button" onClick={onOpenWorkspaceFolder}><IconFolderOpen size={14} /> Open in file explorer</button> : null}
                  </div>
                </div>
              ) : null}
              <label className="settings-toggle">
                <span><strong>Reduced motion</strong><small>Keep navigation spatial, shorten all movement.</small></span>
                <Switch
                  label="Reduced motion"
                  checked={Boolean(settings.reduceMotion)}
                  onChange={(checked) => onUpdateSettings({ reduceMotion: checked })}
                />
              </label>
            </div>
          ) : null}

          {tab === "updates" && onCheckForUpdate ? (
            <div className="updates-settings" id="settings-panel-updates" role="tabpanel" aria-labelledby="settings-tab-updates">
              <div className="updates-settings-intro">
                <IconDownload size={30} stroke={1.35} />
                <div>
                  <h3>Updates</h3>
                  <p>Check GitHub for the latest Tactile release and install it right here.</p>
                  <small>
                    Tactile {TACTILE_VERSION} · {TACTILE_CHANNEL} · {TACTILE_PLATFORM} · {TACTILE_COMMIT_SHORT}
                  </small>
                </div>
              </div>
              <div className="updates-channel" aria-labelledby="updates-channel-label">
                <div>
                  <strong id="updates-channel-label">Update channel</strong>
                  <small>Nightly includes alpha and release-candidate builds and may be less reliable.</small>
                </div>
                <div className="updates-channel-options" role="group" aria-label="Update channel">
                  {["stable", "nightly"].map((channel) => (
                    <button
                      className={updateChannel === channel ? "is-selected" : ""}
                      type="button"
                      aria-pressed={updateChannel === channel}
                      disabled={!updateChannel || channelChanging || updateState === "checking" || updateState === "installing"}
                      onClick={() => changeUpdateChannel(channel)}
                      key={channel}
                    >
                      {channel === "stable" ? "Stable" : "Nightly"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="updates-status" role="status">
                {updateState === "idle" || updateState === "checking"
                  ? <em>{updateState === "checking" ? "Checking for updates…" : updateChannel ? "Not checked yet." : "Loading update channel…"}</em>
                  : updateState === "current"
                    ? <em>{updateChannel === "nightly" ? "No newer alpha or RC build is available." : "No newer stable version is available."}</em>
                    : updateState === "error"
                      ? <em className="is-error">Update failed. Try again.</em>
                      : updateState === "installing"
                        ? <em>Downloading &amp; installing…</em>
                        : <em>Version {updateInfo?.version} is available.</em>}
              </div>
              <div className="updates-actions">
                {updateState === "available" ? (
                  <button className="is-primary" type="button" onClick={runUpdateInstall}><IconDownload size={14} /> Download &amp; restart</button>
                ) : null}
                <button type="button" onClick={runUpdateCheck} disabled={updateState === "checking" || updateState === "installing"}>
                  <IconRefresh size={14} /> Check again
                </button>
              </div>
            </div>
          ) : null}

          {tab === "plugins" ? (
            <div className="plugins-settings" id="settings-panel-plugins" role="tabpanel" aria-labelledby="settings-tab-plugins">
              <section className="plugins-section" aria-labelledby="cell-objects-title">
                <div className="plugins-section-heading">
                  <div>
                    <span>Installed</span>
                    <h3 id="cell-objects-title">Cell Objects</h3>
                    <p>Active objects appear in the create menu. Existing cells remain readable when an object is disabled.</p>
                  </div>
                  <strong>{plugins.cellObjectDefinitions.filter((definition) => {
                    const record = definition.package?.id ? plugins.installed[definition.package.id] : null;
                    return record ? record.enabled !== false : plugins.isEnabled(definition.type);
                  }).length} active</strong>
                </div>
                <div className="plugin-list">
                  {plugins.cellObjectDefinitions.map((definition) => {
                    const Icon = definition.icon || IconPlugConnected;
                    const packageId = definition.package?.id;
                    const installedRecord = packageId ? plugins.installed[packageId] : null;
                    const isBuiltIn = definition.source === "built-in" && !packageId;
                    const enabled = installedRecord
                      ? installedRecord.enabled !== false
                      : plugins.isEnabled(definition.type);
                    return (
                      <div className="plugin-row" key={definition.type}>
                        <span className="plugin-icon"><Icon size={17} stroke={1.5} /></span>
                        <span className="plugin-copy">
                          <strong>{definition.label}</strong>
                          <small>{definition.description || `${definition.type} cell object`}</small>
                        </span>
                        <span className="plugin-source">{definition.source === "built-in" ? "Offline" : definition.package?.version || "Installed"}</span>
                        <span className="plugin-installed-actions">
                          <Switch
                            label={`${enabled ? "Disable" : "Enable"} ${definition.label}`}
                            checked={enabled}
                            disabled={isBuiltIn}
                            onChange={(checked) => {
                              if (installedRecord) void plugins.setInstalledEnabled(packageId, checked);
                              else plugins.setEnabled(definition.type, checked);
                            }}
                          />
                          {installedRecord ? (
                            <button
                              className="settings-close plugin-uninstall"
                              type="button"
                              aria-label={`Uninstall ${definition.label}`}
                              data-tooltip={`Uninstall ${definition.label}`}
                              onClick={() => void plugins.uninstallMarketplacePlugin(packageId)}
                            >
                              <IconTrash size={14} />
                            </button>
                          ) : null}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="plugins-section marketplace-section" aria-labelledby="marketplace-title">
                <div className="plugins-section-heading">
                  <div>
                    <span>Discover</span>
                    <h3 id="marketplace-title">Marketplace</h3>
                    <p>Optional first-party cell objects are downloaded, verified, and cached locally.</p>
                  </div>
                  <button className="plugins-refresh" type="button" onClick={() => void plugins.refreshCatalog()} data-tooltip="Refresh marketplace"><IconRefresh size={14} /></button>
                </div>
                {plugins.marketplaceError ? <p className="is-error" role="alert">{plugins.marketplaceError}</p> : null}
                <div className="plugin-list">
                  {plugins.catalog.map((entry) => {
                    const record = plugins.installed[entry.packageId];
                    const updateAvailable = isPluginUpdateAvailable(entry, record);
                    const transfer = plugins.pluginTransfers[entry.packageId];
                    const installSize = marketplaceInstallSize(entry);
                    const progress = transfer?.total
                      ? Math.max(0, Math.min(100, Math.round((transfer.loaded / transfer.total) * 100)))
                      : 0;
                    return (
                      <div className={`plugin-row marketplace-plugin-row${transfer ? " is-transferring" : ""}`} key={entry.packageId}>
                        <span className="plugin-icon"><IconPlugConnected size={17} stroke={1.5} /></span>
                        <span className="plugin-copy">
                          <strong>{entry.name}</strong>
                          <small>{entry.description}</small>
                          {transfer ? (
                            <span className="plugin-install-meta">
                              <strong>{transferLabel(transfer)}{transfer.phase === "downloading" ? ` ${progress}%` : ""}</strong>
                            </span>
                          ) : null}
                          {transfer ? (
                            <span
                              className={`plugin-transfer-track is-${transfer.phase}`}
                              role="progressbar"
                              aria-label={`${transferLabel(transfer)} ${entry.name}`}
                              aria-valuemin="0"
                              aria-valuemax="100"
                              aria-valuenow={transfer.phase === "downloading" ? progress : undefined}
                              aria-valuetext={transfer.phase === "downloading" ? `${progress}%` : transferLabel(transfer)}
                            >
                              <i style={transfer.phase === "downloading" ? { width: `${progress}%` } : undefined} />
                            </span>
                          ) : null}
                        </span>
                        <span className="plugin-source marketplace-plugin-meta">
                          <span>{updateAvailable ? `${record.version} → ${entry.version}` : entry.status === "available" ? entry.version : "Coming later"}</span>
                          {entry.status === "available" ? <i aria-hidden="true" /> : null}
                          {entry.status === "available" ? <span>{formatPluginSize(installSize)}</span> : null}
                        </span>
                        <span className="plugin-marketplace-actions">
                          {record ? (
                            <>
                              {updateAvailable ? (
                                <button className="settings-close" type="button" aria-label={`Update ${entry.name}`} data-tooltip={`Update ${entry.name}`} disabled={Boolean(transfer)} onClick={() => void plugins.updateMarketplacePlugin(entry)}><IconRefresh size={14} /></button>
                              ) : null}
                              <button className="settings-close" type="button" aria-label={`Delete ${entry.name}`} data-tooltip={`Delete ${entry.name}`} disabled={Boolean(transfer)} onClick={() => void plugins.uninstallMarketplacePlugin(entry.packageId)}><IconTrash size={14} /></button>
                            </>
                          ) : (
                            <button className="settings-close" type="button" aria-label={`Install ${entry.name}`} data-tooltip={`Install ${entry.name}`} disabled={entry.status !== "available" || Boolean(transfer)} onClick={() => void plugins.installFromMarketplace(entry)}><IconDownload size={14} /></button>
                          )}
                        </span>
                      </div>
                    );
                  })}
                  {plugins.marketplaceState === "loading" && !plugins.catalog.length ? <p className="marketplace-empty">Loading marketplace…</p> : null}
                </div>
              </section>
            </div>
          ) : null}

          {tab === "agents" ? (
            <div className="agents-settings" id="settings-panel-agents" role="tabpanel" aria-labelledby="settings-tab-agents">
              <div className="agents-settings-intro">
                <IconSparkles size={30} stroke={1.35} />
<div>
                  <h3>Workspace authoring</h3>
                  <p>Give this prompt to an LLM (e.g. ChatGPT) to build a complete workspace folder or .tactile/.zip bundle — or extend your own without altering anything you made.</p>
                </div>
              </div>
              <section className="workspace-authoring-prompt" aria-labelledby="workspace-authoring-prompt-title">
                <div className="workspace-authoring-prompt-heading">
                  <div>
                    <span>For AI-assisted setup</span>
                    <h4 id="workspace-authoring-prompt-title">Workspace authoring prompt</h4>
                    <p>Versioned against the current Tactile workspace model.</p>
                  </div>
                  <code>{WORKSPACE_AUTHORING_PROMPT_VERSION}</code>
                </div>
                <textarea
                  className="workspace-authoring-prompt-field"
                  aria-label="Workspace authoring prompt"
                  value={WORKSPACE_AUTHORING_PROMPT}
                  readOnly
                  rows={18}
                  onFocus={(event) => event.currentTarget.select()}
                />
                <button className="workspace-authoring-prompt-copy" type="button" onClick={copyAuthoringPrompt}>
                  {authoringPromptCopied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                  {authoringPromptCopied ? "Copied" : "Copy prompt"}
                </button>
              </section>
            </div>
          ) : null}

          {tab === "keyboard" ? (
            <div className="keyboard-settings" id="settings-panel-keyboard" role="tabpanel" aria-labelledby="settings-tab-keyboard">
              <div className="keyboard-intro"><IconBrackets size={28} stroke={1.4} /><div><h3>Fast paths stay familiar</h3><p>Navigation shortcuts work whenever you are not actively typing.</p></div></div>
              <dl>
                <div><dt>Open focused object</dt><dd><kbd>]</kbd></dd></div>
                <div><dt>Expand floating object</dt><dd><kbd>]</kbd></dd></div>
                <div><dt>Return to parent</dt><dd><kbd>[</kbd></dd></div>
                <div><dt>Move selection</dt><dd><kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd></dd></div>
                <div><dt>Edit a tile</dt><dd><kbd>Enter</kbd> <span className="keyboard-key-separator">or</span> <kbd>F2</kbd></dd></div>
                <div><dt>Clear a tile</dt><dd><kbd>Delete</kbd></dd></div>
                <div><dt>Text: bold / italic / link</dt><dd><kbd>Ctrl B</kbd> <kbd>Ctrl I</kbd> <kbd>Ctrl K</kbd></dd></div>
                <div><dt>Edit menu</dt><dd><kbd>Ctrl ]</kbd></dd></div>
              </dl>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
