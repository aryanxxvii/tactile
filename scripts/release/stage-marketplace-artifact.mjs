import { copyFile, mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument !== "--package-id" && argument !== "--output") {
      fail(`Unknown argument: ${argument}`);
    }
    if (!value || value.startsWith("--")) {
      fail(`Missing value for ${argument}`);
    }
    options[argument.slice(2).replace("-", "_")] = value;
  }
  if (!options.package_id) fail("--package-id is required");
  if (!options.output) fail("--output is required");
  return options;
}

async function walkFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walkFiles(entryPath)));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const pluginDirectories = await readdir(path.resolve("marketplace", "plugins"), { withFileTypes: true });
  let manifestPath = "";
  let manifest;

  for (const entry of pluginDirectories) {
    if (!entry.isDirectory()) continue;
    const candidate = path.resolve("marketplace", "plugins", entry.name, "manifest.json");
    const parsed = JSON.parse(await readFile(candidate, "utf8"));
    if (parsed.packageId === options.package_id) {
      manifestPath = candidate;
      manifest = parsed;
      break;
    }
  }

  if (!manifestPath) fail(`No marketplace plugin has packageId ${options.package_id}.`);

  const source = path.resolve("marketplace", "dist", "plugins", options.package_id, manifest.version);
  const sourceInfo = await stat(source).catch(() => null);
  if (!sourceInfo?.isDirectory()) fail(`Built plugin directory does not exist: ${source}`);

  const sourceFiles = await walkFiles(source);
  if (!sourceFiles.some((filePath) => path.basename(filePath) === "plugin.js")) {
    fail(`Built plugin ${options.package_id} does not contain plugin.js.`);
  }

  const output = path.resolve(options.output);
  await mkdir(output, { recursive: true });
  if ((await walkFiles(output)).length > 0) fail(`Output directory must be empty before staging: ${output}`);

  for (const sourceFile of sourceFiles) {
    const destination = path.join(output, path.relative(source, sourceFile));
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(sourceFile, destination);
  }
  await copyFile(manifestPath, path.join(output, "manifest.json"));
  console.log(`Staged ${options.package_id} ${manifest.version} in ${output}`);
}

main().catch((error) => {
  console.error(`Marketplace artifact staging failed: ${error.message}`);
  process.exitCode = 1;
});
