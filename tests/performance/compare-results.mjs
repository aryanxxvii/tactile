import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { comparePerformanceResults, DEFAULT_REGRESSION_TOLERANCE } from "./measurement.mjs";

function parseArgs(argv) {
  const args = { tolerance: DEFAULT_REGRESSION_TOLERANCE, strict: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--baseline") args.baseline = argv[++index];
    else if (argv[index] === "--candidate") args.candidate = argv[++index];
    else if (argv[index] === "--output") args.output = argv[++index];
    else if (argv[index] === "--tolerance") args.tolerance = Number(argv[++index]);
    else if (argv[index] === "--strict") args.strict = true;
    else if (argv[index] === "--help") args.help = true;
  }
  return args;
}

async function loadJson(filePath) {
  return JSON.parse(await readFile(path.resolve(filePath), "utf8"));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.baseline || !args.candidate) {
    console.log(
      "Usage: node tests/performance/compare-results.mjs --baseline <results.json> --candidate <results.json> [--tolerance 0.10] [--strict] [--output <comparison.json>]",
    );
    if (!args.help) process.exitCode = 2;
    return;
  }
  const baseline = await loadJson(args.baseline);
  const candidate = await loadJson(args.candidate);
  const comparison = comparePerformanceResults(baseline, candidate, args.tolerance);
  const measurable = comparison.comparisons.filter((item) => item.status !== "unmeasurable");
  const output = {
    schemaVersion: 1,
    status: measurable.length ? (comparison.passed ? "pass" : "regression") : "skipped",
    reason: measurable.length
      ? undefined
      : "No comparable numeric metrics were available; browser results may be explicitly skipped.",
    ...comparison,
  };
  if (args.output) await writeFile(path.resolve(args.output), `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(output, null, 2));
  if (output.status === "regression" || (args.strict && output.status === "skipped")) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

export { main };
