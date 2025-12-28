#!/usr/bin/env bun
/**
 * Run Tauri E2E Tests
 *
 * This script builds the Tauri app, starts tauri-driver, and runs the tests.
 *
 * Usage:
 *   bun run packages/tests/scripts/run-tauri-tests.ts wallet
 *   bun run packages/tests/scripts/run-tauri-tests.ts node
 *   bun run packages/tests/scripts/run-tauri-tests.ts vpn
 *
 * Options:
 *   --web     Run in web preview mode instead of native
 *   --skip-build  Skip building the app (assume already built)
 */

import { type ChildProcess, spawn } from 'node:child_process'
import { join } from 'node:path'

type TauriApp = 'wallet' | 'node' | 'vpn'

const APPS: Record<TauriApp, { path: string; tauriDir: string }> = {
  wallet: {
    path: 'apps/wallet',
    tauriDir: 'apps/wallet/app/src-tauri',
  },
  node: {
    path: 'apps/node',
    tauriDir: 'apps/node/app/src-tauri',
  },
  vpn: {
    path: 'apps/vpn',
    tauriDir: 'apps/vpn/app/src-tauri',
  },
}

const args = process.argv.slice(2)
const appName = args.find((a) => !a.startsWith('--')) as TauriApp | undefined
const webMode = args.includes('--web')
const skipBuild = args.includes('--skip-build')

if (!appName || !APPS[appName]) {
  console.error(
    'Usage: bun run-tauri-tests.ts <wallet|node|vpn> [--web] [--skip-build]',
  )
  process.exit(1)
}

const app = APPS[appName]
const workspaceRoot = join(import.meta.dir, '../../..')

async function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${cmd} ${args.join(' ')}`)
    const proc = spawn(cmd, args, { cwd, stdio: 'inherit' })
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Command failed with code ${code}`))
    })
    proc.on('error', reject)
  })
}

async function startTauriDriver(port: number): Promise<ChildProcess> {
  console.log(`Starting tauri-driver on port ${port}...`)
  const proc = spawn('tauri-driver', ['--port', port.toString()], {
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      proc.kill()
      reject(new Error('tauri-driver startup timed out'))
    }, 30000)

    proc.stdout?.on('data', (data: Buffer) => {
      const output = data.toString()
      console.log('[tauri-driver]', output.trim())
      if (output.includes('Listening')) {
        clearTimeout(timeout)
        resolve(proc)
      }
    })

    proc.stderr?.on('data', (data: Buffer) => {
      console.error('[tauri-driver]', data.toString().trim())
    })

    proc.on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}

async function main() {
  console.log(`\n=== Tauri E2E Tests: ${appName} ===\n`)

  if (webMode) {
    console.log('Running in WEB PREVIEW mode')
    process.env.TAURI_WEB = '1'
  } else {
    console.log('Running in NATIVE mode')

    // Build the app if not skipped
    if (!skipBuild) {
      console.log('\n1. Building Tauri app...')
      await runCommand(
        'cargo',
        ['tauri', 'build', '--debug'],
        join(workspaceRoot, app.tauriDir),
      )
    }

    // Check if tauri-driver is installed
    try {
      await runCommand('tauri-driver', ['--version'], workspaceRoot)
    } catch {
      console.log('\nInstalling tauri-driver...')
      await runCommand('cargo', ['install', 'tauri-driver'], workspaceRoot)
    }

    // Start tauri-driver
    console.log('\n2. Starting tauri-driver...')
    const driverProc = await startTauriDriver(4444)

    // Cleanup on exit
    process.on('exit', () => driverProc.kill())
    process.on('SIGINT', () => {
      driverProc.kill()
      process.exit(0)
    })
  }

  // Run the tests
  console.log('\n3. Running Playwright tests...')
  try {
    await runCommand(
      'bunx',
      ['playwright', 'test', 'tests/e2e/', '--reporter=list'],
      join(workspaceRoot, app.path),
    )
    console.log('\n✅ All tests passed')
  } catch (_err) {
    console.error('\n❌ Tests failed')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
