import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./fonts.css";
import "./styles.css";

const App = lazy(() => import("./App.jsx").then(({ App: Component }) => ({ default: Component })));

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Suspense fallback={null}>
      <App />
    </Suspense>
  </React.StrictMode>,
);
