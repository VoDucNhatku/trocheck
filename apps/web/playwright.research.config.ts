import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser', testMatch: 'research.spec.ts', workers: 1, timeout: 60000,
  outputDir: '../../.tmp/research-browser-results', reporter: [['list']],
  // Use only the independent research preview; never control the shared API/worker.
  use: {
    baseURL: process.env.RESEARCH_WEB ?? 'http://127.0.0.1:3006',
    ...devices['Desktop Chrome'], channel: process.env.PW_CHANNEL || undefined,
    trace: 'off', screenshot: 'off',
  },
});
