import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "../../tests/component",
  testMatch: /.*\.component\.spec\.[cm]?[jt]s$/,
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: process.env.TACTILE_BASE_URL || "http://127.0.0.1:5173",
    headless: true,
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
  },
});
