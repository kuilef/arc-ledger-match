import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/ui',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5194', channel: process.env.PW_CHANNEL || 'chrome', headless: true, screenshot: 'only-on-failure' },
  webServer: { command: 'node scripts/serve.mjs', url: 'http://127.0.0.1:5194', reuseExistingServer: false },
});
