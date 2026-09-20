import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.TEST_PORT ?? 3100);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/visual",
  fullyParallel: true,
  retries: 0,
  reporter: [["html", { open: "never" }]],
  snapshotPathTemplate: "{testDir}/../__snapshots__/{arg}-{projectName}{ext}",
  use: {
    baseURL: BASE_URL,
    browserName: "chromium",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-1440",
      use: {
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "desktop-1024",
      use: {
        viewport: { width: 1024, height: 768 },
      },
    },
  ],
  webServer: {
    command: "npm run dev -- --port $TEST_PORT",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120000,
    env: {
      TEST_PORT: String(PORT),
    },
  },
});
