/**
 * Tauri Test Fixtures
 *
 * Provides Playwright test fixtures for Tauri app testing.
 * Automatically handles mock injection and native app setup.
 */

import { test as base, type Page } from '@playwright/test'
import { getAppConfig, mockTauriIPC, type TauriAppName } from './index'

export interface TauriTestFixtures {
  /** The app being tested */
  tauriApp: TauriAppName
  /** Whether running in native mode */
  isNativeMode: boolean
  /** Tauri-enabled page with mocks injected */
  tauriPage: Page
}

interface TauriTestOptions {
  app: TauriAppName
  /** Set to false to use web preview instead of native app (default: true) */
  nativeMode?: boolean
}

/**
 * Create Tauri test fixtures for a specific app
 * Native mode is the default - set nativeMode: false for web preview testing
 */
export function createTauriTest(options: TauriTestOptions) {
  // Native mode is default for Tauri apps
  const { app, nativeMode = true } = options

  return base.extend<TauriTestFixtures>({
    tauriApp: [app, { option: true }],
    isNativeMode: [nativeMode, { option: true }],

    tauriPage: async ({ page, isNativeMode }, use) => {
      if (!isNativeMode) {
        // Inject Tauri mocks for web preview testing
        mockTauriIPC(page)
      }

      // Navigate to app root
      const config = getAppConfig(app)
      if (!isNativeMode) {
        await page.goto(`http://localhost:${config.devPort}`)
        await page.waitForLoadState('networkidle')
      }

      await use(page)
    },
  })
}

/**
 * Pre-configured test for Wallet app
 */
export const walletTest = createTauriTest({ app: 'wallet' })

/**
 * Pre-configured test for Node app
 */
export const nodeTest = createTauriTest({ app: 'node' })

/**
 * Pre-configured test for VPN app
 */
export const vpnTest = createTauriTest({ app: 'vpn' })

/**
 * Common assertions for Tauri apps
 */
export const tauriAssertions = {
  /**
   * Assert that the app loaded without errors
   */
  async appLoaded(page: Page): Promise<void> {
    // Check for common error indicators
    const errorMessages = await page
      .locator('[role="alert"], .error, .error-message')
      .all()
    if (errorMessages.length > 0) {
      const texts = await Promise.all(
        errorMessages.map((el) => el.textContent()),
      )
      const errorText = texts.filter((t) => t).join(', ')
      throw new Error(`App loaded with errors: ${errorText}`)
    }

    // Verify body is visible
    await page.waitForSelector('body', { state: 'visible' })
  },

  /**
   * Assert Tauri IPC is available (mocked or real)
   */
  async tauriAvailable(page: Page): Promise<boolean> {
    return page.evaluate(() => {
      return (
        typeof window.__TAURI__ !== 'undefined' ||
        typeof window.__TAURI_INTERNALS__ !== 'undefined'
      )
    })
  },

  /**
   * Invoke a Tauri command and return result
   */
  async invokeCommand<T>(
    page: Page,
    command: string,
    args?: Record<string, unknown>,
  ): Promise<T> {
    return page.evaluate(
      ({ cmd, cmdArgs }) => {
        const tauri = window.__TAURI__ || window.__TAURI_INTERNALS__
        if (!tauri) throw new Error('Tauri not available')
        return tauri.invoke(cmd, cmdArgs) as Promise<T>
      },
      { cmd: command, cmdArgs: args },
    )
  },
}

// Extend window type for Tauri globals
declare global {
  interface Window {
    __TAURI__?: {
      invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>
    }
    __TAURI_INTERNALS__?: {
      invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>
    }
  }
}
