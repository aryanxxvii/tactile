import { windowsBundleVersion } from "./app-version.mjs";

const [version] = process.argv.slice(2);

try {
  if (!version) throw new Error("Usage: windows-bundle-version.mjs <app-version>");
  console.log(windowsBundleVersion(version));
} catch (error) {
  console.error(`Windows bundle version failed: ${error.message}`);
  process.exitCode = 1;
}
