import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const ARTIFACT_EXTENSIONS = new Map([
  ["msi", ".msi"],
  ["dmg", ".dmg"],
  ["tar.gz", ".tar.gz"],
  ["appimage", ".appimage"],
  ["deb", ".deb"],
  ["sig", ".sig"],
]);

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = { expected: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!["--dir", "--expected", "--checksums"].includes(argument)) {
      fail(`Unknown argument: ${argument}`);
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      fail(`Missing value for ${argument}`);
    }

    if (argument === "--expected") {
      options.expected.push(
        ...value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      );
    } else {
      options[argument.slice(2)] = value;
    }
    index += 1;
  }

  if (!options.dir) {
    fail("--dir is required");
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

function relativePath(directory, filePath) {
  return path.relative(directory, filePath).split(path.sep).join("/");
}

function extensionKey(filePath) {
  if (filePath.toLowerCase().endsWith(".tar.gz")) return "tar.gz";
  const extension = path.extname(filePath).toLowerCase();
  for (const [key, expectedExtension] of ARTIFACT_EXTENSIONS) {
    if (extension === expectedExtension) {
      return key;
    }
  }
  return null;
}

function normalizeExpected(value) {
  const normalized = value.toLowerCase().replace(/^[.]/, "");
  if (!ARTIFACT_EXTENSIONS.has(normalized)) {
    fail(`Unsupported expected artifact type: ${value}`);
  }
  return normalized;
}

async function sha256(filePath) {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

function safeResolve(directory, relative) {
  const normalized = relative.replaceAll("\\", "/");
  if (path.posix.isAbsolute(normalized) || normalized.split("/").includes("..")) {
    fail(`Checksum references an unsafe path: ${relative}`);
  }

  const resolved = path.resolve(directory, ...normalized.split("/"));
  const relativeToDirectory = path.relative(directory, resolved);
  if (relativeToDirectory.startsWith("..") || path.isAbsolute(relativeToDirectory)) {
    fail(`Checksum references a path outside the artifact directory: ${relative}`);
  }
  return resolved;
}

async function validateChecksums(directory, checksumFile, artifactByRelativePath) {
  const checksumInfo = await stat(checksumFile).catch(() => null);
  if (!checksumInfo?.isFile()) {
    fail(`Checksum file does not exist: ${checksumFile}`);
  }

  const content = await readFile(checksumFile, "utf8");
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);
  if (lines.length === 0) {
    fail(`Checksum file is empty: ${checksumFile}`);
  }

  const seen = new Set();
  for (const line of lines) {
    const match = /^(?<hash>[a-f0-9]{64})\s{2}(?<relative>.+)$/i.exec(line);
    if (!match) {
      fail(`Invalid SHA-256 line: ${line}`);
    }

    const relative = match.groups.relative.replaceAll("\\", "/");
    if (seen.has(relative)) {
      fail(`Duplicate checksum entry: ${relative}`);
    }
    seen.add(relative);

    const resolved = safeResolve(directory, relative);
    const expectedFile = artifactByRelativePath.get(relative);
    if (!expectedFile || path.resolve(expectedFile) !== resolved) {
      fail(`Checksum references a missing or non-artifact file: ${relative}`);
    }

    const actualHash = await sha256(resolved);
    if (actualHash.toLowerCase() !== match.groups.hash.toLowerCase()) {
      fail(`Checksum mismatch: ${relative}`);
    }
  }

  if (seen.size !== artifactByRelativePath.size) {
    fail("Checksum file does not cover every release artifact");
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const directory = path.resolve(options.dir);
  const directoryInfo = await stat(directory).catch(() => null);
  if (!directoryInfo?.isDirectory()) {
    fail(`Artifact directory does not exist: ${directory}`);
  }

  const checksumFile = options.checksums ? path.resolve(options.checksums) : null;
  const files = await walkFiles(directory);
  const artifacts = [];
  const artifactByRelativePath = new Map();
  const unexpected = [];

  for (const filePath of files) {
    if (checksumFile && path.resolve(filePath) === checksumFile) {
      continue;
    }

    const kind = extensionKey(filePath);
    if (!kind) {
      unexpected.push(relativePath(directory, filePath));
      continue;
    }

    const fileInfo = await stat(filePath);
    if (fileInfo.size === 0) {
      fail(`Artifact is empty: ${relativePath(directory, filePath)}`);
    }
    const relative = relativePath(directory, filePath);
    artifacts.push({ filePath, kind, relative });
    artifactByRelativePath.set(relative, filePath);
  }

  if (unexpected.length > 0) {
    fail(`Unexpected files in artifact directory: ${unexpected.join(", ")}`);
  }
  if (artifacts.length === 0) {
    fail(`No release artifacts found in ${directory}`);
  }

  for (const expected of options.expected.map(normalizeExpected)) {
    if (!artifacts.some((artifact) => artifact.kind === expected)) {
      fail(`Missing expected .${expected} artifact in ${directory}`);
    }
  }

  if (checksumFile) {
    await validateChecksums(directory, checksumFile, artifactByRelativePath);
  }

  console.log(
    `Validated ${artifacts.length} release artifact(s): ${artifacts.map((artifact) => artifact.relative).join(", ")}`,
  );
}

main().catch((error) => {
  console.error(`Artifact validation failed: ${error.message}`);
  process.exitCode = 1;
});
