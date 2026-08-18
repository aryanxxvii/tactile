const baseURL = process.env.TACTILE_PERF_BASE_URL || "http://127.0.0.1:5173";

export default {
  testDir: "./tests/performance",
  testMatch: /.*\.pw\.spec\.[cm]?[jt]s$/,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "evidence/performance/playwright-results.json" }]],
  use: {
    baseURL,
    headless: true,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1",
    url: `${baseURL}/`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
};
