import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', testMatch: ['interior.spec.ts', 'redesign.spec.ts', 'shell.spec.ts'], workers: 1, timeout: 60000,
  outputDir: '../../.tmp/interior-browser-results',
  reporter: [['list']],
  // Servers start separately (tests/serve-interior.py + next dev); PW_CHANNEL=chrome reuses the installed browser.
  use: {
    baseURL: process.env.INTERIOR_WEB ?? 'http://127.0.0.1:3003', ...devices['Desktop Chrome'],
    channel: process.env.PW_CHANNEL || undefined, trace: 'off', screenshot: 'off',
  },
});
