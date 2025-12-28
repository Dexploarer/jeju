/**
 * Tauri Native App Testing Utilities
 *
 * Provides testing infrastructure for Tauri v2 desktop apps.
 * Native mode is the DEFAULT - tests run against the built Tauri app via tauri-driver.
 *
 * To run native tests:
 * 1. Build the app: cd apps/<app> && cargo tauri build --debug
 * 2. Start tauri-driver: tauri-driver --port 4444
 * 3. Run tests: bunx playwright test
 *
 * To run web preview tests instead:
 *   TAURI_WEB=1 bunx playwright test
 *
 * Usage:
 * ```typescript
 * import { TauriTestContext, createTauriFixture } from '@jejunetwork/tests/tauri'
 * ```
 */

import { type ChildProcess, spawn } from 'node:child_process'
import { join } from 'node:path'
import type { Browser, Page } from '@playwright/test'

export type TauriAppName = 'wallet' | 'node' | 'vpn'

interface TauriAppConfig {
  name: TauriAppName
  appPath: string
  devPort: number
  identifier: string
}

const APP_CONFIGS: Record<TauriAppName, TauriAppConfig> = {
  wallet: {
    name: 'wallet',
    appPath: 'apps/wallet',
    devPort: 4015,
    identifier: 'network.jeju.wallet',
  },
  node: {
    name: 'node',
    appPath: 'apps/node',
    devPort: 1420,
    identifier: 'network.jeju.node',
  },
  vpn: {
    name: 'vpn',
    appPath: 'apps/vpn',
    devPort: 1421,
    identifier: 'network.jeju.vpn',
  },
}

export interface TauriTestContext {
  app: TauriAppName
  config: TauriAppConfig
  page: Page
  browser: Browser
  isNative: boolean
  tauriProcess: ChildProcess | null
}

/**
 * Start a Tauri dev server for testing
 */
export async function startTauriDevServer(
  app: TauriAppName,
  workspaceRoot: string,
): Promise<{ process: ChildProcess; port: number }> {
  const config = APP_CONFIGS[app]
  const appDir = join(workspaceRoot, config.appPath)

  return new Promise((resolve, reject) => {
    const proc = spawn('bun', ['run', 'dev'], {
      cwd: appDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test' },
    })

    let started = false
    const timeout = setTimeout(() => {
      if (!started) {
        proc.kill()
        reject(new Error(`Tauri dev server for ${app} timed out`))
      }
    }, 60000)

    proc.stdout?.on('data', (data: Buffer) => {
      const output = data.toString()
      if (output.includes(`localhost:${config.devPort}`)) {
        started = true
        clearTimeout(timeout)
        resolve({ process: proc, port: config.devPort })
      }
    })

    proc.stderr?.on('data', (data: Buffer) => {
      console.error(`[${app}] stderr:`, data.toString())
    })

    proc.on('error', (err: Error) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}

/**
 * Build and start a Tauri app for native testing via tauri-driver
 */
export async function buildTauriApp(
  app: TauriAppName,
  workspaceRoot: string,
): Promise<string> {
  const config = APP_CONFIGS[app]
  const appDir = join(workspaceRoot, config.appPath, 'app', 'src-tauri')

  return new Promise((resolve, reject) => {
    const proc = spawn('cargo', ['tauri', 'build', '--debug'], {
      cwd: appDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    })

    let output = ''

    proc.stdout?.on('data', (data: Buffer) => {
      output += data.toString()
    })

    proc.stderr?.on('data', (data: Buffer) => {
      output += data.toString()
    })

    proc.on('close', (code: number | null) => {
      if (code === 0) {
        // Return path to built binary based on platform
        const platform = process.platform
        const binaryName =
          platform === 'darwin'
            ? `${config.name}`
            : platform === 'win32'
              ? `${config.name}.exe`
              : config.name

        const binaryPath = join(
          appDir,
          'target',
          'debug',
          platform === 'darwin'
            ? `bundle/macos/${config.name}.app`
            : binaryName,
        )
        resolve(binaryPath)
      } else {
        reject(new Error(`Build failed with code ${code}: ${output}`))
      }
    })

    proc.on('error', reject)
  })
}

/**
 * Start tauri-driver for WebDriver-based testing
 */
export async function startTauriDriver(port = 4444): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const proc = spawn('tauri-driver', ['--port', port.toString()], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let started = false
    const timeout = setTimeout(() => {
      if (!started) {
        proc.kill()
        reject(new Error('tauri-driver startup timed out'))
      }
    }, 30000)

    proc.stdout?.on('data', (data: Buffer) => {
      const output = data.toString()
      if (output.includes('Listening')) {
        started = true
        clearTimeout(timeout)
        resolve(proc)
      }
    })

    proc.on('error', (err: Error) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}

/**
 * Mock Tauri IPC calls for frontend testing without native app
 */
export function mockTauriIPC(page: Page): void {
  page.addInitScript(() => {
    // Mock __TAURI__ global object
    interface TauriMock {
      invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>
      event: {
        listen: (
          event: string,
          callback: (payload: unknown) => void,
        ) => Promise<() => void>
        emit: (event: string, payload?: unknown) => Promise<void>
      }
    }

    const mockInvokeHandlers: Record<
      string,
      (args?: Record<string, unknown>) => unknown
    > = {
      // Common mocks
      get_version: () => ({ version: '0.1.0-test' }),
      get_config: () => ({}),
      // Wallet-specific
      get_accounts: () => [],
      get_balance: () => '0',
      // Node-specific
      get_services: () => [],
      get_earnings: () => ({ total: '0', pending: '0' }),
      // VPN-specific
      get_status: () => ({ connected: false, server: null }),
      get_nodes: () => [],
    }

    const tauriMock: TauriMock = {
      invoke: async (
        cmd: string,
        args?: Record<string, unknown>,
      ): Promise<unknown> => {
        console.log(`[Tauri Mock] invoke: ${cmd}`, args)
        const handler = mockInvokeHandlers[cmd]
        if (handler) {
          return handler(args)
        }
        console.warn(`[Tauri Mock] No handler for command: ${cmd}`)
        return null
      },
      event: {
        listen: async (
          event: string,
          _callback: (payload: unknown) => void,
        ): Promise<() => void> => {
          console.log(`[Tauri Mock] listen: ${event}`)
          return () => {
            console.log(`[Tauri Mock] unlisten: ${event}`)
          }
        },
        emit: async (event: string, payload?: unknown): Promise<void> => {
          console.log(`[Tauri Mock] emit: ${event}`, payload)
        },
      },
    }

    ;(window as { __TAURI__: TauriMock }).__TAURI__ = tauriMock
    ;(
      window as { __TAURI_INTERNALS__: { invoke: TauriMock['invoke'] } }
    ).__TAURI_INTERNALS__ = {
      invoke: tauriMock.invoke,
    }
  })
}

/**
 * Get app configuration
 */
export function getAppConfig(app: TauriAppName): TauriAppConfig {
  return APP_CONFIGS[app]
}

/**
 * Check if tauri-driver is installed
 */
export async function checkTauriDriverInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('tauri-driver', ['--version'], { stdio: 'pipe' })
    proc.on('close', (code: number | null) => resolve(code === 0))
    proc.on('error', () => resolve(false))
  })
}

/**
 * Install tauri-driver if not present
 */
export async function ensureTauriDriver(): Promise<void> {
  const installed = await checkTauriDriverInstalled()
  if (!installed) {
    console.log('Installing tauri-driver...')
    return new Promise((resolve, reject) => {
      const proc = spawn('cargo', ['install', 'tauri-driver'], {
        stdio: 'inherit',
      })
      proc.on('close', (code: number | null) => {
        if (code === 0) resolve()
        else
          reject(new Error(`Failed to install tauri-driver: exit code ${code}`))
      })
      proc.on('error', reject)
    })
  }
}
