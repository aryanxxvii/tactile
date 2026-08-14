import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./fonts.css";
import "./styles.css";
import { StartupLoader } from "./components/StartupLoader.jsx";

const nativeStartup = Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);
let startupTheme = nativeStartup ? "dark" : "light";
let startupDuration = nativeStartup ? 3000 : 1000;
try {
  const cached = JSON.parse(window.localStorage.getItem("tactile.workspace.v3") || "null");
  if (nativeStartup && cached?.activeThemeId === "paper-public") startupTheme = "light";
  if (nativeStartup && cached?.settings?.nativeWorkspacePath) startupDuration = 1000;
} catch {
  // The dark native startup surface remains the safe fallback.
}
document.documentElement.dataset.startupTheme = startupTheme;

const App = lazy(() => import("./App.jsx").then(({ App: Component }) => ({ default: Component })));

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <StartupLoader holdUntilReady minimumDuration={startupDuration} />
    <Suspense fallback={null}><App /></Suspense>
  </React.StrictMode>,
);
