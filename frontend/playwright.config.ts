import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for ART Workspace frontend smoke tests.
 *
 * Run locally:
 *   npx playwright install --with-deps   # first time only
 *   npm run test:smoke                   # starts `next dev` on :3000 automatically
 *
 * In CI the `test:smoke` script handles the webServer lifecycle.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    // Anonymous context — we intentionally test the unauthenticated surface here.
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
