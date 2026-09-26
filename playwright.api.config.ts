import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/api-e2e', workers: 1, retries: 0, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5173', viewport: { width: 1280, height: 900 }, trace: 'retain-on-failure' },
  webServer: [
    { command: 'npm run dev', cwd: './server', url: 'http://127.0.0.1:3001/api/v1/ready', reuseExistingServer: false },
    { command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort', env: { VITE_API_ENABLED: 'true' }, url: 'http://127.0.0.1:5173', reuseExistingServer: false },
  ],
});
