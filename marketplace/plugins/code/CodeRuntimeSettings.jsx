import {
  CODE_RUNTIME_TOOLS,
  React,
  getCodeRuntimeProfile,
  resolveTauriInvoke,
  setCodeRuntimeDiscovery,
  setCodeRuntimePath,
  setCodeRuntimeSelected,
  subscribeCodeRuntimeProfile,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "tactile:host";
import { IconAlertCircle, IconCircleCheck, IconRefresh, IconTerminal2 } from "@tabler/icons-react";
import "./CodeRuntimeSettings.css";

const DEVICE_LANGUAGES = [
  { id: "python", label: "Python", tools: ["python"] },
  { id: "c", label: "C", tools: ["gcc"] },
  { id: "cpp", label: "C++", tools: ["gpp"] },
  { id: "java", label: "Java", tools: ["javac", "java"] },
  { id: "rust", label: "Rust", tools: ["rustc"] },
  { id: "go", label: "Go", tools: ["go"] },
  { id: "ruby", label: "Ruby", tools: ["ruby"] },
  { id: "bash", label: "Bash", tools: ["bash"] },
];

function languageAvailability(language, discoveredByTool, scannedTools) {
  const tools = language.tools.map((tool) => discoveredByTool.get(tool));
  if (tools.some((tool) => !tool)) {
    return { state: scannedTools ? "checking" : "not-selected", detail: scannedTools ? "Checking" : "Not selected" };
  }
  const missing = tools.filter((tool) => !tool.available);
  if (missing.length) return { state: "missing", detail: `Missing ${missing.map((tool) => tool.command).join(" + ")}` };
  return { state: "ready", detail: tools.map((tool) => tool.version || tool.command).join(" · ") };
}

export function CodeRuntimeSettings() {
  const profile = useSyncExternalStore(subscribeCodeRuntimeProfile, getCodeRuntimeProfile, getCodeRuntimeProfile);
  const [selected, setSelected] = useState(() => new Set(profile.selected));
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scanTools, setScanTools] = useState(() => profile.discovery?.tools || []);
  const invoke = resolveTauriInvoke();
  const discoveredByTool = useMemo(
    () => new Map(scanTools.map((tool) => [tool.tool, tool])),
    [scanTools],
  );

  const selectedTools = useMemo(() => {
    const tools = [];
    for (const language of DEVICE_LANGUAGES) {
      if (selected.has(language.id)) tools.push(...language.tools);
    }
    return tools;
  }, [selected]);

  const toggleLanguage = (languageId) => {
    const next = new Set(selected);
    if (next.has(languageId)) next.delete(languageId);
    else next.add(languageId);
    setSelected(next);
    setCodeRuntimeSelected([...next]);
  };

  const refresh = async () => {
    if (!invoke || selectedTools.length === 0) return;
    setScanning(true);
    setScanError(null);
    setScanTools([]);
    const results = [];
    try {
      for (const tool of selectedTools) {
        const info = await invoke("workspace_probe_code_runtime", {
          tool,
          executablePaths: profile.paths,
        });
        results.push(info);
        setScanTools([...results]);
      }
      setCodeRuntimeDiscovery({ cachedAt: new Date().toISOString(), tools: results });
    } catch (error) {
      setScanError(String(error || "Runtime discovery failed."));
      setCodeRuntimeDiscovery({ cachedAt: new Date().toISOString(), tools: results });
    } finally {
      setScanning(false);
    }
  };

  // Only scan the first time a workspace is visited. Afterwards the cached
  // results are shown until the user explicitly refreshes.
  useEffect(() => {
    if (!invoke || profile.discovery?.tools?.length) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scannedTools = new Set(scanTools.map((tool) => tool.tool));

  return (
    <div className="code-runtime-settings">
      <header className="code-runtime-heading">
        <div>
          <span>{invoke ? "Native execution" : "Browser preview"}</span>
          <h3>Code runtimes</h3>
          <p>
            {invoke
              ? "Pick the languages to inspect, then scan for installed tools. Scanning only probes what you selected, one tool at a time."
              : "The browser cannot access programs installed on your device. Open Tactile Desktop to detect and run device toolchains."}
          </p>
        </div>
        {invoke ? (
          <button
            className="code-runtime-refresh"
            type="button"
            aria-label="Refresh code runtimes"
            data-tooltip="Refresh"
            disabled={scanning || selectedTools.length === 0}
            onClick={() => void refresh()}
          >
            <IconRefresh size={14} />
          </button>
        ) : null}
      </header>
      {!invoke ? (
        <div className="code-runtime-banner" role="status">
          <IconTerminal2 size={16} stroke={1.5} />
          <span>
            <strong>Desktop app required</strong>
            <small>
              Python, C, C++, Java, Rust, Go, Ruby and Bash use local tools that only native applications can launch.
              JavaScript, JSX, TypeScript and TSX can still run in this browser preview.
            </small>
          </span>
        </div>
      ) : null}
      {scanError ? (
        <p className="code-runtime-banner is-error" role="alert">
          {scanError}
        </p>
      ) : null}
      {invoke ? (
        <>
          <section className="code-runtime-section" aria-labelledby="language-status-title">
            <div className="code-runtime-section-heading">
              <div>
                <span>Execution</span>
                <h4 id="language-status-title">Languages</h4>
              </div>
              <strong>
                {selected.size} of {DEVICE_LANGUAGES.length} selected
              </strong>
            </div>
            <div className="code-runtime-language-grid">
              <div className="code-runtime-language is-ready">
                <span>
                  <IconCircleCheck size={14} stroke={1.7} />
                  <strong>JavaScript · JSX · TypeScript · TSX</strong>
                </span>
                <small>Always available in the browser worker</small>
              </div>
              {DEVICE_LANGUAGES.map((language) => {
                const checked = selected.has(language.id);
                const availability = languageAvailability(language, discoveredByTool, scanning);
                return (
                  <button
                    key={language.id}
                    type="button"
                    className={`code-runtime-language is-${availability.state}${checked ? " is-selected" : ""}`}
                    aria-pressed={checked}
                    onClick={() => toggleLanguage(language.id)}
                    data-tooltip={checked ? "Remove from scan" : "Add to scan"}
                  >
                    <span>
                      <i className="code-language-check" aria-hidden="true" />
                      {availability.state === "ready" ? (
                        <IconCircleCheck size={14} stroke={1.7} />
                      ) : (
                        <IconAlertCircle size={14} stroke={1.6} />
                      )}
                      <strong>{language.label}</strong>
                    </span>
                    <small>{availability.detail}</small>
                  </button>
                );
              })}
              <div className="code-runtime-language is-editor">
                <span>
                  <IconAlertCircle size={14} stroke={1.6} />
                  <strong>JSON · SQL · HTML · CSS · Plain text</strong>
                </span>
                <small>Editor only</small>
              </div>
            </div>
          </section>
          <section className="code-runtime-section" aria-labelledby="runtime-tools-title">
            <div className="code-runtime-section-heading">
              <div>
                <span>Toolchain</span>
                <h4 id="runtime-tools-title">Installed tools</h4>
              </div>
              <strong>
                {scanning
                  ? `Scanning ${scannedTools.size + 1} of ${selectedTools.length}`
                  : scanTools.length > 0
                    ? `${scanTools.filter((tool) => tool.available).length} found`
                    : profile.discovery?.tools?.length
                      ? "0 found"
                      : "Not scanned yet"}
              </strong>
            </div>
            {selectedTools.length > 0 ? (
              <div className="code-runtime-list">
                {CODE_RUNTIME_TOOLS.filter((tool) => selectedTools.includes(tool.id)).map((tool) => {
                  const detected = discoveredByTool.get(tool.id);
                  const available = Boolean(detected?.available);
                  return (
                    <label key={tool.id} className="code-runtime-row">
                      <span className="code-runtime-tool">
                        <i className={available ? "is-available" : ""} aria-hidden="true">
                          {available ? (
                            <IconCircleCheck size={15} stroke={1.7} />
                          ) : (
                            <IconAlertCircle size={15} stroke={1.6} />
                          )}
                        </i>
                        <span>
                          <strong>{tool.label}</strong>
                          <small>
                            {available
                              ? detected.version || detected.command
                              : detected
                                ? `Not found: ${detected.command}`
                                : tool.command}
                          </small>
                        </span>
                      </span>
                      <input
                        type="text"
                        value={profile.paths[tool.id] || ""}
                        placeholder={`Automatic (${tool.command})`}
                        spellCheck="false"
                        aria-invalid={detected && !detected.available ? "true" : undefined}
                        aria-label={`${tool.label} executable path`}
                        onChange={(event) => setCodeRuntimePath(tool.id, event.target.value)}
                      />
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="code-runtime-note">Select at least one language above, then press Refresh.</p>
            )}
          </section>
          <p className="code-runtime-note">
            {profile.discovery?.cachedAt && !scanning
              ? `Results cached from ${new Date(profile.discovery.cachedAt).toLocaleString()}. Press Refresh to rescan.`
              : "Tactile inherits PATH when it starts. Restart the desktop app after installing a tool or changing PATH."}
          </p>
        </>
      ) : (
        <section className="code-runtime-section" aria-labelledby="browser-runtime-title">
          <div className="code-runtime-section-heading">
            <div>
              <span>Execution</span>
              <h4 id="browser-runtime-title">Available in this preview</h4>
            </div>
          </div>
          <div className="code-runtime-list">
            <div className="code-runtime-capability">
              <span className="code-runtime-tool">
                <i className="is-available" aria-hidden="true">
                  <IconCircleCheck size={15} stroke={1.7} />
                </i>
                <span>
                  <strong>Browser worker</strong>
                  <small>JavaScript, JSX, TypeScript and TSX</small>
                </span>
              </span>
              <strong>Ready</strong>
            </div>
            <div className="code-runtime-capability">
              <span className="code-runtime-tool">
                <i aria-hidden="true">
                  <IconAlertCircle size={15} stroke={1.6} />
                </i>
                <span>
                  <strong>Device toolchains</strong>
                  <small>Python · C · C++ · Java · Rust · Go · Ruby · Bash</small>
                </span>
              </span>
              <strong>Not checked here</strong>
            </div>
            <div className="code-runtime-capability">
              <span className="code-runtime-tool">
                <i aria-hidden="true">
                  <IconAlertCircle size={15} stroke={1.6} />
                </i>
                <span>
                  <strong>Editor-only formats</strong>
                  <small>JSON · SQL · HTML · CSS · Plain text</small>
                </span>
              </span>
              <strong>No Run action</strong>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}