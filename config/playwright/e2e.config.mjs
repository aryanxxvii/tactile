import { defineConfig } from "@playwright/test";

const baseURL = process.env.TACTILE_BASE_URL || "http://127.0.0.1:5187";

export default defineConfig({
  testDir: "../../tests/e2e",
  testMatch: /.*\.e2e\.spec\.[cm]?[jt]s$/,
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5187",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: {
    baseURL,
    headless: true,
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
    trace: "retain-on-failure",
  },
});
