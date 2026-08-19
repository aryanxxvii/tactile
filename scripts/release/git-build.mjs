import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";

import { compareAppVersions, nextAlphaVersion, parseAppVersion, windowsBundleVersion } from "./app-version.mjs";

const VERSION_FILES = [
  "version.json",
  "package.json",
  "package-lock.json",
  "src-tauri/tauri.conf.json",
  "src-tauri/Cargo.toml",
  "src-tauri/Cargo.lock",
];
const JSON_VERSION_FILES = ["version.json", "package.json", "package-lock.json", "src-tauri/tauri.conf.json"];

function fail(message) {
  throw new Error(message);
}

function commandInvocation(command, args) {
  if (process.platform === "win32" && ["npm", "npx"].includes(command)) {
    return { command: "cmd.exe", args: ["/d", "/s", "/c", command, ...args] };
  }
  return { command, args };
}

function run(command, args, options = {}) {
  const invocation = commandInvocation(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.error) fail(`${command} failed: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = options.capture ? String(result.stderr || result.stdout || "").trim() : "";
    fail(detail || `${command} ${args.join(" ")} exited with code ${result.status}.`);
  }
  return options.capture ? String(result.stdout).trim() : "";
}

function git(args, options) {
  return run("git", args, options);
}

function parseArguments(args) {
  const flags = new Set(args.filter((argument) => argument.startsWith("--")));
  const positional = args.filter((argument) => !argument.startsWith("--"));
  const [channel, version, ...extra] = positional;
  if (!channel || !["alpha", "stable"].includes(channel) || extra.length) {
    fail(
      "Usage: git build alpha [version] [--yes] [--dry-run] | git build stable [version] [--publish] [--yes] [--dry-run]",
    );
  }
  for (const flag of flags) {
    if (!["--publish", "--yes", "--dry-run"].includes(flag)) fail(`Unknown option: ${flag}`);
  }
  if (channel === "alpha" && flags.has("--publish")) fail("Alpha builds publish during preparation; omit --publish.");
  if (channel === "stable" && !flags.has("--publish") && !version) fail("Stable preparation requires a version.");
  return {
    channel,
    version,
    publish: flags.has("--publish"),
    yes: flags.has("--yes"),
    dryRun: flags.has("--dry-run"),
  };
}

async function confirm(message, yes) {
  if (yes) return;
  if (!process.stdin.isTTY) fail("Confirmation requires an interactive terminal; pass --yes to continue.");
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question(`${message} [y/N] `);
  prompt.close();
  if (!/^y(?:es)?$/i.test(answer.trim())) fail("Cancelled.");
}

function requireCleanWorktree() {
  if (git(["status", "--porcelain"], { capture: true })) fail("Working tree must be clean before running git build.");
}

function requireBranch(expected) {
  const branch = git(["branch", "--show-current"], { capture: true });
  if (branch !== expected) fail(`Run this command on ${expected}; current branch is ${branch || "detached HEAD"}.`);
}

function fetchAndRequireCurrent(branch) {
  git(["fetch", "origin", branch, "--tags"]);
  const head = git(["rev-parse", "HEAD"], { capture: true });
  const remote = git(["rev-parse", `origin/${branch}`], { capture: true });
  if (head !== remote) fail(`Local ${branch} must exactly match origin/${branch} before running git build.`);
}

function requireUnusedTag(tag) {
  const result = spawnSync("git", ["show-ref", "--verify", "--quiet", `refs/tags/${tag}`], { cwd: process.cwd() });
  if (result.status === 0) fail(`Tag ${tag} already exists; release tags are immutable.`);
  if (result.status !== 1) fail(`Could not inspect tag ${tag}.`);
}

async function readCurrentVersion() {
  return String(JSON.parse(await readFile("version.json", "utf8")).version || "");
}

async function snapshotVersionFiles() {
  return new Map(await Promise.all(VERSION_FILES.map(async (file) => [file, await readFile(file, "utf8")])));
}

async function restoreVersionFiles(snapshot) {
  await Promise.all([...snapshot].map(([file, contents]) => writeFile(file, contents, "utf8")));
  git(["reset", "--quiet", "--", ...VERSION_FILES]);
}

async function writeAuthoritativeVersion(version) {
  const value = JSON.parse(await readFile("version.json", "utf8"));
  value.version = version;
  await writeFile("version.json", `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function validateRequestedVersion(currentVersion, requestedVersion, channel) {
  const parsed = parseAppVersion(requestedVersion);
  if (channel === "alpha" && parsed.channel !== "alpha") fail("Alpha builds require a version ending in -alpha.N.");
  if (channel === "stable" && parsed.channel) fail("Stable builds require X.Y.Z without a prerelease suffix.");
  if (compareAppVersions(requestedVersion, currentVersion) <= 0) {
    fail(`Requested version ${requestedVersion} must be newer than ${currentVersion}.`);
  }
  windowsBundleVersion(requestedVersion);
  return parsed.version;
}

function validateAndStage(version, tag) {
  run("npm", ["run", "version:sync"]);
  run("npx", ["prettier", "--write", ...JSON_VERSION_FILES]);
  run("npm", ["run", "version:check"]);
  run("node", ["scripts/release/validate-release-version.mjs", "app", tag]);
  windowsBundleVersion(version);
  git(["add", "--", ...VERSION_FILES]);
}

function printStableNextSteps(version) {
  console.log(`\nStable ${version} is prepared on alpha.`);
  console.log("\n1. Open and merge the alpha -> main pull request after CI passes.");
  console.log("2. Then run:\n");
  console.log("git switch main");
  console.log("git pull --ff-only origin main");
  console.log(`git build stable ${version} --publish`);
}

async function prepare(options) {
  requireBranch("alpha");
  requireCleanWorktree();
  fetchAndRequireCurrent("alpha");

  const currentVersion = await readCurrentVersion();
  const tags = git(["tag", "--list", "v*"], { capture: true }).split(/\r?\n/).filter(Boolean);
  const selected =
    options.channel === "alpha" && !options.version
      ? nextAlphaVersion(currentVersion, tags)
      : validateRequestedVersion(currentVersion, options.version, options.channel);
  const version = validateRequestedVersion(currentVersion, selected, options.channel);
  const tag = `v${version}`;
  requireUnusedTag(tag);

  const commitMessage =
    options.channel === "alpha" ? `build(alpha): prepare ${version}` : `build(release): prepare ${version}`;
  console.log(`Current version: ${currentVersion}`);
  console.log(`Next version:    ${version}`);
  console.log(`Windows bundle: ${windowsBundleVersion(version)}`);
  console.log(`Commit:          ${commitMessage}`);
  if (options.dryRun) {
    console.log(`Dry run: would ${options.channel === "alpha" ? `atomically push alpha and ${tag}` : "push alpha"}.`);
    return;
  }
  await confirm(`Prepare ${version}?`, options.yes);

  const snapshot = await snapshotVersionFiles();
  let committed = false;
  try {
    await writeAuthoritativeVersion(version);
    validateAndStage(version, tag);
    git(["commit", "-m", commitMessage]);
    committed = true;

    if (options.channel === "alpha") {
      git(["tag", "-a", tag, "-m", `Tactile ${version}`]);
      try {
        git(["push", "--atomic", "origin", "HEAD:alpha", `refs/tags/${tag}`]);
      } catch (error) {
        console.error(`\nRetry with: git push --atomic origin HEAD:alpha refs/tags/${tag}`);
        throw error;
      }
      console.log(`Published ${tag}; the alpha release workflow is now eligible to run.`);
    } else {
      try {
        git(["push", "origin", "HEAD:alpha"]);
      } catch (error) {
        console.error("\nRetry with: git push origin HEAD:alpha");
        throw error;
      }
      printStableNextSteps(version);
    }
  } catch (error) {
    if (!committed) await restoreVersionFiles(snapshot);
    throw error;
  }
}

async function publishStable(options) {
  requireBranch("main");
  requireCleanWorktree();
  fetchAndRequireCurrent("main");

  const currentVersion = await readCurrentVersion();
  const parsed = parseAppVersion(currentVersion);
  if (parsed.channel) fail(`Cannot publish prerelease version ${currentVersion} as stable.`);
  if (options.version && parseAppVersion(options.version).version !== currentVersion) {
    fail(`Requested version ${options.version} does not match version.json ${currentVersion}.`);
  }
  const tag = `v${currentVersion}`;
  requireUnusedTag(tag);
  run("npm", ["run", "version:check"]);
  run("node", ["scripts/release/validate-release-version.mjs", "app", tag]);

  console.log(`Publish stable tag ${tag} from ${git(["rev-parse", "--short", "HEAD"], { capture: true })}.`);
  if (options.dryRun) {
    console.log(`Dry run: would push ${tag}.`);
    return;
  }
  await confirm(`Publish ${tag}?`, options.yes);
  git(["tag", "-a", tag, "-m", `Tactile ${currentVersion}`]);
  try {
    git(["push", "origin", `refs/tags/${tag}`]);
  } catch (error) {
    console.error(`\nRetry with: git push origin refs/tags/${tag}`);
    throw error;
  }
  console.log(`Published ${tag}; the stable release workflow is now eligible to run.`);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const root = git(["rev-parse", "--show-toplevel"], { capture: true });
  process.chdir(path.resolve(root));
  if (options.channel === "stable" && options.publish) await publishStable(options);
  else await prepare(options);
}

main().catch((error) => {
  console.error(`git build failed: ${error.message}`);
  process.exitCode = 1;
});
