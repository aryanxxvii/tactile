import { main as runBrowserBaseline } from "../performance/run-browser.mjs";

await runBrowserBaseline([
  ...process.argv.slice(2),
  "--screenshots",
  "tests/visual/baselines",
  "--output",
  "evidence/performance/visual-results.json",
]);
