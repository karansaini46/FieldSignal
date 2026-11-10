import { defineConfig, devices } from "@playwright/test";

// ponytail: e2e test configuration isolated to dedicated port 3001
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  outputDir: "/tmp/playwright-test-results",
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3001",
    trace: "off",
  },
  projects: [
    {
      name: "Desktop Chrome",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: "Mobile Emulation",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 375, height: 667 },
      },
    },
  ],
  webServer: {
    command: "npx next dev -p 3001",
    url: "http://localhost:3001/api/v1/health",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
