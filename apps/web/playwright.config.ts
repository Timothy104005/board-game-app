import { defineConfig } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const thisFilePath = fileURLToPath(import.meta.url);
const webRoot = dirname(thisFilePath);
const repoRoot = resolve(webRoot, "..", "..");

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:3000",
    headless: true
  },
  webServer: [
    {
      command: "npm run jobs:worker -- --pollMs 200 --pool 1",
      cwd: repoRoot,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI
    },
    {
      command: "npm run dev -- --port 3000",
      cwd: webRoot,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI
    }
  ]
});
