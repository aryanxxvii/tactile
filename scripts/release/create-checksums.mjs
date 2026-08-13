import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument !== "--dir" && argument !== "--output") {
      fail(`Unknown argument: ${argument}`);
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      fail(`Missing value for ${argument}`);
    }
    options[argument.slice(2)] = value;
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

async function sha256(filePath) {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const directory = path.resolve(options.dir);
  const output = path.resolve(options.output ?? path.join(directory, "SHA256SUMS.txt"));
  const directoryInfo = await stat(directory).catch(() => null);

  if (!directoryInfo?.isDirectory()) {
    fail(`Artifact directory does not exist: ${directory}`);
  }

  await mkdir(path.dirname(output), { recursive: true });
  const outputKey = path.resolve(output);
  const files = (await walkFiles(directory)).filter((filePath) => path.resolve(filePath) !== outputKey);

  if (files.length === 0) {
    fail(`No artifacts found in ${directory}`);
  }

  const rows = [];
  for (const filePath of files.sort((left, right) => left.localeCompare(right))) {
    const relativePath = path.relative(directory, filePath).split(path.sep).join("/");
    rows.push(`${await sha256(filePath)}  ${relativePath}`);
  }

  await writeFile(output, `${rows.join("\n")}\n`, "utf8");
  console.log(`Wrote ${rows.length} SHA-256 entries to ${output}`);
}

main().catch((error) => {
  console.error(`Checksum generation failed: ${error.message}`);
  process.exitCode = 1;
});
