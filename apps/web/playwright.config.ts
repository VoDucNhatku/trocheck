import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
const python = path.resolve('../api/.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  fullyParallel: false,
  timeout: 45000,
  reporter: [['list']],
  outputDir: '../../.tmp/b1-ui-browser-results',
  use: { baseURL: 'http://127.0.0.1:3001', ...devices['Desktop Chrome'], trace: 'retain-on-failure' },
  webServer: [
    {
      command: `"${python}" -m uvicorn --app-dir tests serve-api:app --host 127.0.0.1 --port 18000`,
      url: 'http://127.0.0.1:18000/_test/state',
      timeout: 120000,
      reuseExistingServer: false,
    },
    {
      command: 'node node_modules/next/dist/bin/next start -p 3001',
      url: 'http://127.0.0.1:3001/tim-tro',
      timeout: 60000,
      env: { API_BASE_URL: 'http://127.0.0.1:18000/api/v1', API_TIMEOUT_MS: '800' },
      reuseExistingServer: false,
    },
  ],
});
