import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    permissions: ["geolocation"],
    geolocation: { latitude: 51.5074, longitude: -0.1278 },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"], permissions: ["geolocation"], geolocation: { latitude: 51.5074, longitude: -0.1278 } },
    },
  ],
  webServer: {
    command: process.env.CI
      ? "npx serve dist --listen 5173 --no-clipboard"
      : "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
