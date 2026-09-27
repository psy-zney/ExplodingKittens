import { defineConfig } from '@playwright/test';
import path from 'node:path';

const artifacts = path.resolve(process.env.QA_ARTIFACT_DIR ?? 'docs/qa');

export default defineConfig({
  testDir: '.',
  testMatch: 'browser.e2e.spec.ts',
  timeout: 180_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: path.join(artifacts, 'playwright-report'), open: 'never' }]],
  outputDir: path.join(artifacts, 'test-results'),
  use: {
    baseURL: process.env.QA_BASE_URL ?? 'http://localhost:5173',
    browserName: 'chromium',
    headless: true,
    trace: process.env.QA_TRACE === '1' ? 'retain-on-failure' : 'off',
    screenshot: 'only-on-failure',
  },
});
