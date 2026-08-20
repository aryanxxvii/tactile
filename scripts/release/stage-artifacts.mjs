import { chmod, copyFile, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { githubAssetName } from "./github-asset-name.mjs";

const PLATFORM_BUNDLES = Object.freeze({
  "windows-x64": ["msi"],
  "macos-universal": ["dmg", "tar.gz"],
  "linux-x64": ["appimage", "deb"],
});

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = { artifactSuffix: "" };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];

    if (argument === "--platform") {
      options.platform = value;
    } else if (argument === "--source") {
      options.source = value;
    } else if (argument === "--output") {
      options.output = value;
    } else if (argument === "--artifact-suffix") {
      options.artifactSuffix = value ?? "";
    } else {
      fail(`Unknown argument: ${argument}`);
    }

    if (argument !== "--artifact-suffix") {
      if (!value || value.startsWith("--")) {
        fail(`Missing value for ${argument}`);
      }
      index += 1;
    } else {
      index += 1;
    }
  }

  if (!options.platform || !PLATFORM_BUNDLES[options.platform]) {
    fail("--platform must be one of windows-x64, macos-universal, or linux-x64");
  }
  if (!options.source) {
    fail("--source is required");
  }
  if (!options.output) {
    fail("--output is required");
  }
  if (options.artifactSuffix && !/^[a-z0-9-]+$/i.test(options.artifactSuffix)) {
    fail("--artifact-suffix may contain only letters, numbers, and hyphens");
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

function extension(filePath) {
  if (filePath.toLowerCase().endsWith(".tar.gz")) return "tar.gz";
  return path.extname(filePath).toLowerCase().replace(".", "");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const source = path.resolve(options.source);
  const output = path.resolve(options.output);
  const expectedBundles = PLATFORM_BUNDLES[options.platform];

  const sourceInfo = await stat(source).catch(() => null);
  if (!sourceInfo?.isDirectory()) {
    fail(`Bundle directory does not exist: ${source}`);
  }

  await mkdir(output, { recursive: true });
  const existingOutput = await walkFiles(output);
  if (existingOutput.length > 0) {
    fail(`Output directory must be empty before staging: ${output}`);
  }

  const sourceFiles = await walkFiles(source);
  const selected = [];

  for (const expectedBundle of expectedBundles) {
    const matches = sourceFiles.filter((filePath) => extension(filePath) === expectedBundle);
    if (matches.length !== 1) {
      fail(
        `Expected exactly one .${expectedBundle} bundle for ${options.platform}; found ${matches.length} in ${source}`,
      );
    }
    selected.push(matches[0]);
  }

  const prefix = options.artifactSuffix
    ? `tactile-${options.platform}-${options.artifactSuffix}-`
    : `tactile-${options.platform}-`;

  for (const sourceFile of selected) {
    const destination = path.join(output, `${prefix}${githubAssetName(path.basename(sourceFile))}`);
    await copyFile(sourceFile, destination);

    if (process.platform !== "win32") {
      const sourceMode = (await stat(sourceFile)).mode & 0o777;
      await chmod(destination, sourceMode || 0o644);
    }

    console.log(`${path.basename(destination)} <= ${sourceFile}`);

    const signatureFile = `${sourceFile}.sig`;
    if (extension(signatureFile) === "sig" && (await stat(signatureFile).catch(() => null))) {
      const signatureDestination = `${destination}.sig`;
      await copyFile(signatureFile, signatureDestination);
      console.log(`${path.basename(signatureDestination)} <= ${signatureFile}`);
    }
  }
}

main().catch((error) => {
  console.error(`Artifact staging failed: ${error.message}`);
  process.exitCode = 1;
});
