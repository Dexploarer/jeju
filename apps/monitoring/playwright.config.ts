/**
 * Monitoring Playwright Configuration
 */
import { defineConfig, devices } from '@playwright/test'

// Monitoring defaults to 5173 (standard Vite port) or PORT env var
const PORT = Number(process.env.PORT) || 5173

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 120000,

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Use 'bun run start' for production-like testing against DWS infrastructure
  // Set SKIP_WEBSERVER=1 if app is already running
  webServer: process.env.SKIP_WEBSERVER
    ? undefined
    : {
        command: 'bun run start',
        url: `http://localhost:${PORT}`,
        reuseExistingServer: true,
        timeout: 180000,
      },
})
