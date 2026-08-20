import { appendFile, readFile } from "node:fs/promises";

import { compareAppVersions, parseAppVersion } from "./app-version.mjs";

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!["--candidate", "--current", "--github-output"].includes(argument)) {
      fail(`Unknown argument: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) fail(`Missing value for ${argument}`);
    options[argument.slice(2)] = value;
    index += 1;
  }
  if (!options.candidate) fail("--candidate is required");
  return options;
}

async function manifestVersion(filePath) {
  const manifest = JSON.parse(await readFile(filePath, "utf8"));
  return parseAppVersion(String(manifest.version || "")).version;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const candidate = await manifestVersion(options.candidate);
  if (!parseAppVersion(candidate).channel) fail("Nightly updater candidates must be alpha or RC versions.");

  const current = options.current ? await manifestVersion(options.current) : null;
  const promote = !current || compareAppVersions(candidate, current) > 0;
  const result = `promote=${promote}\n`;
  if (options["github-output"]) await appendFile(options["github-output"], result, "utf8");
  process.stdout.write(result);
}

main().catch((error) => {
  console.error(`Updater channel promotion failed: ${error.message}`);
  process.exitCode = 1;
});
