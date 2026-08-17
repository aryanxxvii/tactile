import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

function fail(message) {
  throw new Error(message);
}

async function main() {
  const tag = process.argv[2];
  const match = /^([a-z0-9]+(?:[.-][a-z0-9]+)*)@([^@]+)$/i.exec(tag || "");
  if (!match) {
    fail("Plugin tag must use <packageId>@<version>.");
  }

  const [, packageId, tagVersion] = match;
  const pluginsRoot = path.resolve("marketplace", "plugins");
  const entries = await readdir(pluginsRoot, { withFileTypes: true });
  let directory = "";

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(pluginsRoot, entry.name, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    if (manifest.packageId === packageId) {
      directory = entry.name;
      break;
    }
  }

  if (!directory) {
    fail(`No marketplace plugin has packageId ${packageId}.`);
  }

  console.log(`package_id=${packageId}`);
  console.log(`tag_version=${tagVersion}`);
  console.log(`directory=${directory}`);
}

main().catch((error) => {
  console.error(`Plugin tag parsing failed: ${error.message}`);
  process.exitCode = 1;
});
