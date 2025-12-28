/**
 * Playwright Configuration for Tauri Native App Testing
 *
 * Provides base configuration for testing Tauri apps with Playwright.
 * Native mode is the DEFAULT - tests run against built Tauri app via tauri-driver.
 * Set TAURI_WEB=1 to test web preview instead.
 */

import { defineConfig, devices } from '@playwright/test'
import { getAppConfig, type TauriAppName } from './index'

export interface TauriPlaywrightConfigOptions {
  app: TauriAppName
  /** Test in native mode using tauri-driver (default: true) */
  nativeMode?: boolean
  /** WebDriver port for tauri-driver */
  webDriverPort?: number
  /** Skip starting the dev server (assume already running) */
  skipDevServer?: boolean
}

/**
 * Create a Playwright config for testing Tauri apps
 * Native mode is the default - use TAURI_WEB=1 for web preview testing
 */
export function createTauriPlaywrightConfig(
  options: TauriPlaywrightConfigOptions,
) {
  // Native mode is default, override with TAURI_WEB=1
  const {
    app,
    nativeMode = process.env.TAURI_WEB !== '1',
    webDriverPort = 4444,
    skipDevServer = false,
  } = options
  const config = getAppConfig(app)

  const baseConfig = defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false, // Tauri apps may have shared state
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1, // Single worker for native app testing
    reporter: process.env.CI ? 'github' : 'html',
    timeout: 60000,

    use: {
      baseURL: nativeMode ? undefined : `http://localhost:${config.devPort}`,
      trace: 'on-first-retry',
      screenshot: 'only-on-failure',
      video: 'on-first-retry',
    },

    projects: nativeMode
      ? [
          {
            name: 'tauri-native',
            use: {
              // WebDriver connection to tauri-driver
              connectOptions: {
                wsEndpoint: `ws://localhost:${webDriverPort}`,
              },
            },
          },
        ]
      : [
          {
            name: 'chromium-mock',
            use: {
              ...devices['Desktop Chrome'],
              // Will inject Tauri mocks via test setup
            },
          },
        ],

    webServer:
      nativeMode || skipDevServer || process.env.SKIP_WEBSERVER
        ? undefined
        : {
            command: 'bun run dev',
            url: `http://localhost:${config.devPort}`,
            reuseExistingServer: true,
            timeout: 120000,
          },
  })

  return baseConfig
}

/**
 * Default Tauri test config for wallet
 */
export const walletConfig = createTauriPlaywrightConfig({ app: 'wallet' })

/**
 * Default Tauri test config for node
 */
export const nodeConfig = createTauriPlaywrightConfig({ app: 'node' })

/**
 * Default Tauri test config for VPN
 */
export const vpnConfig = createTauriPlaywrightConfig({ app: 'vpn' })
