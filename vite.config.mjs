import { execFile, execFileSync } from "node:child_process";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";

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

function marketplaceDevServer() {
  let rebuildTimer = null;
  let rebuilding = false;
  let rebuildQueued = false;

  return {
    name: "tactile-marketplace-dev-server",
    configureServer(server) {
      const marketplaceSources = [path.resolve("marketplace", "plugins"), path.resolve("marketplace", "sdk")];
      const rebuild = () => {
        if (rebuilding) {
          rebuildQueued = true;
          return;
        }
        rebuilding = true;
        execFile(
          process.execPath,
          [path.resolve("scripts", "build-marketplace.mjs")],
          { cwd: process.cwd() },
          (error, stdout, stderr) => {
            rebuilding = false;
            if (stdout) server.config.logger.info(stdout.trim());
            if (error) {
              server.config.logger.error(stderr?.trim() || error.message);
            } else {
              server.ws.send({ type: "full-reload" });
            }
            if (rebuildQueued) {
              rebuildQueued = false;
              rebuild();
            }
          },
        );
      };
      const scheduleRebuild = (file) => {
        const absolute = path.resolve(file);
        if (!marketplaceSources.some((source) => absolute === source || absolute.startsWith(`${source}${path.sep}`)))
          return;
        if (rebuildTimer) clearTimeout(rebuildTimer);
        rebuildTimer = setTimeout(rebuild, 80);
      };

      server.watcher.add(marketplaceSources);
      server.watcher.on("add", scheduleRebuild);
      server.watcher.on("change", scheduleRebuild);
      server.watcher.on("unlink", scheduleRebuild);
      server.middlewares.use("/marketplace", (request, response, next) => {
        const relative = decodeURIComponent((request.url || "/").split("?")[0]).replace(/^\/+/, "");
        const file = path.resolve("marketplace", "dist", relative || "catalog.json");
        const root = path.resolve("marketplace", "dist");
        if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) return next();
        response.setHeader("Content-Type", file.endsWith(".json") ? "application/json" : "text/javascript");
        response.setHeader("Cache-Control", "no-store");
        createReadStream(file).pipe(response);
      });
      return () => {
        if (rebuildTimer) clearTimeout(rebuildTimer);
        server.watcher.off("add", scheduleRebuild);
        server.watcher.off("change", scheduleRebuild);
        server.watcher.off("unlink", scheduleRebuild);
      };
    },
  };
}

export default defineConfig({
  define: {
    "import.meta.env.VITE_TACTILE_COMMIT": JSON.stringify(tactileCommit),
    "import.meta.env.VITE_TACTILE_DIRTY": JSON.stringify(String(tactileDirty)),
  },
  build: {
    outDir: "dist/client",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/katex/")) return "katex";
          return undefined;
        },
      },
    },
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
  plugins: [marketplaceDevServer(), react()],
});
