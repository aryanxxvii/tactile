import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(fullPath)));
    else files.push(fullPath);
  }
  return files;
}

async function measureKind(rootDirectory, extension) {
  const files = (await filesUnder(rootDirectory)).filter((filePath) => filePath.endsWith(extension));
  const entries = [];
  for (const filePath of files) {
    const data = await readFile(filePath);
    entries.push({
      file: path.relative(rootDirectory, filePath).replaceAll("\\", "/"),
      rawBytes: data.length,
      gzipBytes: gzipSync(data).length,
    });
  }
  return {
    files: entries,
    rawBytes: entries.reduce((total, entry) => total + entry.rawBytes, 0),
    gzipBytes: entries.reduce((total, entry) => total + entry.gzipBytes, 0),
  };
}

export async function measureBundle(rootDirectory = "dist/client") {
  const resolvedRoot = path.resolve(rootDirectory);
  const rootStats = await stat(resolvedRoot);
  if (!rootStats.isDirectory()) throw new Error(`Bundle directory is not a directory: ${resolvedRoot}`);
  return {
    root: resolvedRoot,
    javascript: await measureKind(resolvedRoot, ".js"),
    css: await measureKind(resolvedRoot, ".css"),
  };
}
