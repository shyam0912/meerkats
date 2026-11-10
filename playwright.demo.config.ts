import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4174';
export default defineConfig({
  testDir: './tests/demo',
  outputDir: './test-results/demo',
  workers: 1,
  retries: 0,
  use: {
    baseURL,
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build:demo && npm run preview -- --mode demo --host 127.0.0.1 --port 4174 --strictPort',
    env: { VITE_API_ENABLED: 'true', VITE_BUILD_PROBE: 'DEP2B_PRIVATE_BUILD_CANARY' },
    timeout: 120_000,
    url: baseURL,
    reuseExistingServer: false,
  },
});
