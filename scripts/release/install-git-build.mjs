import { spawnSync } from "node:child_process";

const result = spawnSync("git", ["config", "--local", "alias.build", "!node scripts/release/git-build.mjs"], {
  encoding: "utf8",
  stdio: "inherit",
});

if (result.error) {
  console.error(`Could not install git build: ${result.error.message}`);
  process.exitCode = 1;
} else if (result.status !== 0) {
  process.exitCode = result.status || 1;
} else {
  console.log("Installed repository-local command: git build");
}
