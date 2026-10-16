import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3187", browserName: "chromium", channel: "chrome" },
  webServer: {
    command: "npm run dev --workspace apps/web -- --hostname 127.0.0.1 --port 3187",
    url: "http://127.0.0.1:3187", reuseExistingServer: false,
    env: { NEXT_TELEMETRY_DISABLED: "1" },
  },
});
