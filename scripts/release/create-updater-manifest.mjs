import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { githubAssetName } from "./github-asset-name.mjs";

const TARGET_FOR = [
  { platform: "windows-x64", extension: ".msi", targets: ["windows-x86_64"] },
  { platform: "macos-universal", extension: ".tar.gz", targets: ["darwin-aarch64", "darwin-x86_64"] },
  { platform: "linux-x64", extension: ".appimage", targets: ["linux-x86_64"] },
];

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!["--dir", "--version", "--output", "--repo", "--tag"].includes(argument)) {
      fail(`Unknown argument: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      fail(`Missing value for ${argument}`);
    }
    options[argument.slice(2)] = value;
    index += 1;
  }
  if (!options.dir || !options.version || !options.repo || !options.tag) {
    fail("--dir, --version, --repo, and --tag are required");
  }
  return options;
}

async function walkFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const directory = path.resolve(options.dir);
  const directoryInfo = await stat(directory).catch(() => null);
  if (!directoryInfo?.isDirectory()) {
    fail(`Artifact directory does not exist: ${directory}`);
  }

  const files = await walkFiles(directory);
  const platforms = {};

  for (const { platform, extension, targets } of TARGET_FOR) {
    const bundle = files.find((filePath) => {
      const name = path.basename(filePath).toLowerCase();
      return name.includes(platform) && filePath.toLowerCase().endsWith(extension);
    });
    if (!bundle) {
      fail(`Missing ${platform} ${extension} bundle for the updater manifest`);
    }
    const signatureFile = `${bundle}.sig`;
    if (!(await stat(signatureFile).catch(() => null))) {
      fail(`Missing updater signature for ${path.basename(bundle)}`);
    }
    const signature = (await readFile(signatureFile, "utf8")).trim();
    const assetName = githubAssetName(path.basename(bundle));
    const url = `https://github.com/${options.repo}/releases/download/${options.tag}/${assetName}`;
    for (const target of targets) {
      platforms[target] = { signature, url };
    }
  }

  const manifest = {
    version: options.version,
    notes: "",
    pub_date: new Date().toISOString(),
    platforms,
  };

  const output = path.resolve(options.output ?? path.join(directory, "latest.json"));
  const { writeFile } = await import("node:fs/promises");
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Wrote updater manifest with platforms: ${Object.keys(platforms).join(", ")}`);
}

main().catch((error) => {
  console.error(`Updater manifest generation failed: ${error.message}`);
  process.exitCode = 1;
});
