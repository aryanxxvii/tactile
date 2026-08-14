import { execFileSync } from "node:child_process";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function gitValue(args, fallback) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || fallback;
  } catch {
    return fallback;
  }
}

const tactileCommit = gitValue(["rev-parse", "--short=7", "HEAD"], "unknown");
// Ignore unrelated workspace files (for example local package experiments)
// so the badge only marks source/test changes that can affect the preview.
const tactileDirty = Boolean(
  gitValue(["status", "--porcelain", "--untracked-files=no", "--", "src", "tests", "public", "vite.config.mjs"], ""),
);

export default defineConfig({
  define: {
    "import.meta.env.VITE_TACTILE_COMMIT": JSON.stringify(tactileCommit),
    "import.meta.env.VITE_TACTILE_DIRTY": JSON.stringify(String(tactileDirty)),
  },
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react()],
});
