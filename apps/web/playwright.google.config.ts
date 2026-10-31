import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const python = path.resolve('../api/.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
export default defineConfig({
  testDir: './tests/browser', testMatch: 'google-auth.spec.ts', workers: 1, timeout: 60000,
  outputDir: '../../.tmp/google-auth-browser-results', reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:3013', ...devices['Desktop Chrome'], trace: 'retain-on-failure' },
  webServer: process.env.GOOGLE_AUTH_EXTERNAL_SERVERS === '1' ? undefined : [
    {
      command: `"${python}" -m uvicorn --app-dir tests serve-google-auth:app --host 127.0.0.1 --port 18013`,
      url: 'http://127.0.0.1:18013/api/v1/health', timeout: 60000,
      env: { PYTHONPATH: path.resolve('../api') }, reuseExistingServer: false,
    },
    {
      command: 'node node_modules/next/dist/bin/next start -p 3013',
      url: 'http://127.0.0.1:3013/dang-nhap', timeout: 60000,
      env: { RENER_DIST_DIR: '.next-google-auth', API_BASE_URL: 'http://127.0.0.1:18013/api/v1' },
      reuseExistingServer: false,
    },
  ],
});
