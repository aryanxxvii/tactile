import {
  CODE_RUNTIME_TOOLS,
  React,
  getCodeRuntimeProfile,
  resolveTauriInvoke,
  setCodeRuntimePath,
  subscribeCodeRuntimeProfile,
  useEffect,
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

function languageAvailability(language, discoveredByTool) {
  const tools = language.tools.map((tool) => discoveredByTool.get(tool));
  if (tools.some((tool) => !tool)) return { state: "checking", detail: "Checking" };
  const missing = tools.filter((tool) => !tool.available);
  if (missing.length) return { state: "missing", detail: `Missing ${missing.map((tool) => tool.command).join(" + ")}` };
  return { state: "ready", detail: tools.map((tool) => tool.version || tool.command).join(" · ") };
}

export function CodeRuntimeSettings() {
  const profile = useSyncExternalStore(subscribeCodeRuntimeProfile, getCodeRuntimeProfile, getCodeRuntimeProfile);
  const [discovery, setDiscovery] = useState({ state: "idle", tools: [] });
  const invoke = resolveTauriInvoke();
  const discoveredByTool = new Map(discovery.tools.map((tool) => [tool.tool, tool]));

  const refresh = async () => {
    if (!invoke) return;
    setDiscovery((current) => ({ ...current, state: "loading" }));
    try {
      const tools = await invoke("workspace_discover_code_runtimes", { executablePaths: profile.paths });
      setDiscovery({ state: "ready", tools: Array.isArray(tools) ? tools : [] });
    } catch (error) {
      setDiscovery({ state: "error", tools: [], error: String(error || "Runtime discovery failed.") });
    }
  };

  useEffect(() => {
    void refresh();
  }, [profile]);

  return (
    <div className="code-runtime-settings">
      <header className="code-runtime-heading">
        <div>
          <span>{invoke ? "Native execution" : "Browser preview"}</span>
          <h3>Code runtimes</h3>
          <p>
            {invoke
              ? "Use programming tools installed on this device. Leave a path empty to resolve the command from PATH."
              : "The browser cannot access programs installed on your device. Open Tactile Desktop to detect and run device toolchains."}
          </p>
        </div>
        {invoke ? (
          <button
            className="code-runtime-refresh"
            type="button"
            aria-label="Refresh code runtimes"
            data-tooltip="Refresh"
            disabled={discovery.state === "loading"}
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
      {discovery.state === "error" ? (
        <p className="code-runtime-banner is-error" role="alert">
          {discovery.error}
        </p>
      ) : null}
      {invoke ? (
        <>
          <section className="code-runtime-section" aria-labelledby="language-status-title">
            <div className="code-runtime-section-heading">
              <div>
                <span>Execution</span>
                <h4 id="language-status-title">Language availability</h4>
              </div>
            </div>
            <div className="code-runtime-language-grid">
              <div className="code-runtime-language is-ready">
                <span>
                  <IconCircleCheck size={14} stroke={1.7} />
                  <strong>JavaScript · JSX · TypeScript · TSX</strong>
                </span>
                <small>Browser worker</small>
              </div>
              {DEVICE_LANGUAGES.map((language) => {
                const availability = languageAvailability(language, discoveredByTool);
                return (
                  <div key={language.id} className={`code-runtime-language is-${availability.state}`}>
                    <span>
                      {availability.state === "ready" ? (
                        <IconCircleCheck size={14} stroke={1.7} />
                      ) : (
                        <IconAlertCircle size={14} stroke={1.6} />
                      )}
                      <strong>{language.label}</strong>
                    </span>
                    <small>{availability.detail}</small>
                  </div>
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
                {discovery.state === "ready"
                  ? `${discovery.tools.filter((tool) => tool.available).length} found`
                  : "Checking"}
              </strong>
            </div>
            <div className="code-runtime-list">
              {CODE_RUNTIME_TOOLS.map((tool) => {
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
          </section>
          <p className="code-runtime-note">
            Tactile inherits PATH when it starts. Restart the desktop app after installing a tool or changing PATH.
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
