import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'npm run build && npm start',
      env: {
        PORT: '3100',
        HOSTNAME: '127.0.0.1',
        PACT_BROKER_URL: 'http://127.0.0.1:9294/basic',
        PACT_BROKER_ALLOWED_URLS: 'http://127.0.0.1:9294/no-cors',
      },
      url: 'http://127.0.0.1:3100',
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: 'node tools/testing/broker.mjs',
      url: 'http://127.0.0.1:9294/health',
      reuseExistingServer: false,
      timeout: 15000,
    },
  ],
});
