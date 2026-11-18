import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

// Reads .env.local like Next.js does (E2E_EMAIL / E2E_PASSWORD for the signed-in flow).
loadEnvConfig(process.cwd());

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";

/**
 * End-to-end tests run in the installed Google Chrome (channel "chrome"), so no browser download
 * is needed. Against localhost the dev server is started (or reused). Set E2E_BASE_URL to test a
 * deployed site instead.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 150_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  outputDir: "test-results",
  use: {
    baseURL,
    channel: "chrome",
    locale: "en-GB",
    timezoneId: "Africa/Cairo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" }, testMatch: /public\.spec\.ts/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run dev", url: "http://localhost:3000", reuseExistingServer: true, timeout: 180_000 },
});
