import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  outputDir: "../../test-results/redirects",
  workers: 1,
  use: {
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
})
