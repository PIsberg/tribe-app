import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "fs";

// Load E2E_* vars from .env.local so admin tests get the right token.
// Only E2E_-prefixed vars are loaded; others are left to the shell / CI.
try {
  for (const line of readFileSync(".env.local", "utf-8").split(/\r?\n/)) {
    const m = line.match(/^(E2E_\w+)\s*=\s*'([^']*)'|^(E2E_\w+)\s*=\s*"([^"]*)"|^(E2E_\w+)\s*=\s*(.+?)(?:\s+#.*)?$/);
    if (m) {
      const key = m[1] ?? m[3] ?? m[5];
      const val = (m[2] ?? m[4] ?? m[6] ?? "").trim();
      if (key && !process.env[key]) process.env[key] = val;
    }
  }
} catch { /* .env.local absent */ }

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : "html",
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
      ? "npx serve dist --listen 5173 --no-clipboard --single"
      : "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
