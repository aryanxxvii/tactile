#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(root, "marketplace", "plugins");
const outputRoot = path.join(root, "marketplace", "dist");
const selector = process.argv[2] || "";

function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function packageDirectories() {
  return readdirSync(sourceRoot, { withFileTypes: true }).filter(
    (entry) => entry.isDirectory() && existsSync(path.join(sourceRoot, entry.name, "manifest.json")),
  );
}

function hostSdkPlugin() {
  return {
    name: "tactile-host-sdk",
    setup(compilation) {
      compilation.onResolve({ filter: /^tactile:host$/ }, () => ({ path: "tactile:host", namespace: "tactile-host" }));
      compilation.onResolve({ filter: /^react$/ }, () => ({ path: "react", namespace: "tactile-host" }));
      compilation.onLoad({ filter: /.*/, namespace: "tactile-host" }, () => ({
        loader: "js",
        contents: `
          const host = globalThis.__TACTILE_PLUGIN_HOST__;
          if (!host) throw new Error("Tactile plugin host is unavailable.");
          export default host.React;
          export const React = host.React;
          export const Children = host.React.Children;
          export const Component = host.React.Component;
          export const Fragment = host.React.Fragment;
          export const PureComponent = host.React.PureComponent;
          export const cloneElement = host.React.cloneElement;
          export const createContext = host.React.createContext;
          export const createElement = host.React.createElement;
          export const createRef = host.React.createRef;
          export const forwardRef = host.React.forwardRef;
          export const isValidElement = host.React.isValidElement;
          export const lazy = host.React.lazy;
          export const memo = host.React.memo;
          export const startTransition = host.React.startTransition;
          export const useContext = host.React.useContext;
          export const createId = host.createId;
          export const ObjectHeader = host.ObjectHeader;
          export const ObjectGlyph = host.ObjectGlyph;
          export const PaperPortal = host.PaperPortal;
          export const useLocalDraft = host.useLocalDraft;
          export const codeLanguageForExtension = host.codeLanguageForExtension;
          export const resolveTauriInvoke = host.resolveTauriInvoke;
          export const CODE_RUNTIME_TOOLS = host.CODE_RUNTIME_TOOLS;
          export const getCodeRuntimeProfile = host.getCodeRuntimeProfile;
          export const setCodeRuntimePath = host.setCodeRuntimePath;
          export const setCodeRuntimeSelected = host.setCodeRuntimeSelected;
          export const setCodeRuntimeDiscovery = host.setCodeRuntimeDiscovery;
          export const subscribeCodeRuntimeProfile = host.subscribeCodeRuntimeProfile;
          export const objectTypeFor = host.objectTypeFor;
          export const pluginAssetUrl = host.pluginAssetUrl;
          export const installStyle = host.installStyle;
          export const useCallback = host.React.useCallback;
          export const useDeferredValue = host.React.useDeferredValue;
          export const useEffect = host.React.useEffect;
          export const useId = host.React.useId;
          export const useLayoutEffect = host.React.useLayoutEffect;
          export const useMemo = host.React.useMemo;
          export const useReducer = host.React.useReducer;
          export const useRef = host.React.useRef;
          export const useState = host.React.useState;
          export const useSyncExternalStore = host.React.useSyncExternalStore;
          export const useTransition = host.React.useTransition;
        `,
      }));
      compilation.onLoad({ filter: /\.css$/ }, (args) => ({
        loader: "js",
        contents: `import { installStyle } from "tactile:host"; installStyle(${JSON.stringify(readFileSync(args.path, "utf8").replace(/\r\n?/g, "\n"))});`,
      }));
    },
  };
}

async function compilePackage(directory) {
  const packageRoot = path.join(sourceRoot, directory.name);
  const manifest = JSON.parse(readFileSync(path.join(packageRoot, "manifest.json"), "utf8"));
  for (const field of ["packageId", "type", "name", "version", "entry"]) {
    if (!manifest[field]) throw new Error(`${directory.name} manifest is missing ${field}.`);
  }
  if (manifest.schemaVersion !== 1) throw new Error(`${manifest.packageId} has an unsupported schema version.`);
  if (selector && selector !== manifest.packageId && selector !== manifest.type && selector !== directory.name)
    return null;

  const artifactDirectory = path.join(outputRoot, "plugins", manifest.packageId, manifest.version);
  rmSync(artifactDirectory, { recursive: true, force: true });
  mkdirSync(artifactDirectory, { recursive: true });
  const result = await build({
    entryPoints: [path.join(packageRoot, manifest.entry)],
    bundle: true,
    format: "esm",
    platform: "browser",
    target: ["es2022"],
    write: false,
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    define: { __TACTILE_PLUGIN_MANIFEST__: JSON.stringify(manifest) },
    plugins: [hostSdkPlugin()],
    minify: true,
    legalComments: "none",
  });
  const javascript = result.outputFiles.find((file) => !file.path.endsWith(".css"));
  if (!javascript) throw new Error(`${manifest.packageId} did not emit JavaScript.`);
  writeFileSync(path.join(artifactDirectory, "plugin.js"), javascript.contents);

  const assets = [];
  for (const asset of manifest.assets || []) {
    const sourceFile = asset.source.startsWith(".")
      ? path.resolve(packageRoot, asset.source)
      : path.resolve(root, "node_modules", asset.source);
    const bytes = readFileSync(sourceFile);
    writeFileSync(path.join(artifactDirectory, asset.file), bytes);
    assets.push({
      file: asset.file,
      artifact: `plugins/${manifest.packageId}/${manifest.version}/${asset.file}`,
      sha256: hash(bytes),
      size: bytes.byteLength,
    });
  }
  return {
    ...manifest,
    status: "available",
    artifact: `plugins/${manifest.packageId}/${manifest.version}/plugin.js`,
    sha256: hash(javascript.contents),
    size: javascript.contents.byteLength,
    assets,
  };
}

if (!selector) rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });

const compiled = (await Promise.all(packageDirectories().map(compilePackage))).filter(Boolean);
if (selector && !compiled.length) throw new Error(`Unknown marketplace package: ${selector}`);

const catalogFile = path.join(outputRoot, "catalog.json");
const previous = existsSync(catalogFile) ? JSON.parse(readFileSync(catalogFile, "utf8")) : { plugins: [] };
const compiledIds = new Set(compiled.map((entry) => entry.packageId));
const retained = selector ? (previous.plugins || []).filter((entry) => !compiledIds.has(entry.packageId)) : [];
const plugins = [...retained, ...compiled].sort((left, right) => left.name.localeCompare(right.name));
writeFileSync(catalogFile, `${JSON.stringify({ schemaVersion: 1, plugins }, null, 2)}\n`);
writeFileSync(path.join(outputRoot, "README.md"), readFileSync(path.join(root, "marketplace", "README.md")));
console.log(`Marketplace: compiled ${compiled.map((entry) => entry.packageId).join(", ")}`);
