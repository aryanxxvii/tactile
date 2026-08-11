import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.e2e\.spec\.[cm]?[jt]s$/,
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: process.env.TACTILE_BASE_URL || "http://127.0.0.1:5173",
    headless: true,
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
    trace: "retain-on-failure",
  },
});
