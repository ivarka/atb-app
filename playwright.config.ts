import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', timeout: 45000, expect: { timeout: 10000 },
  use: { baseURL: 'http://localhost:8081', viewport: { width: 1440, height: 1100 }, screenshot: 'only-on-failure', trace: 'retain-on-failure', launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } },
  webServer: { command: 'npm run dev', url: 'http://localhost:8081', reuseExistingServer: !process.env.CI, timeout: 120000 },
});
