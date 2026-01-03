/**
 * Production build script for Node App
 *
 * Builds:
 * 1. Static frontend (dist/static/) - for IPFS/CDN deployment
 * 2. CLI bundle (dist/cli/) - for command line usage
 */

import { existsSync } from 'node:fs'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  BROWSER_EXTERNALS,
  createBrowserPlugin,
  reportBundleSizes,
} from '@jejunetwork/shared'

const APP_DIR = resolve(import.meta.dir, '..')
const DIST_DIR = resolve(APP_DIR, 'dist')
const STATIC_DIR = `${DIST_DIR}/static`
const CLI_DIR = `${DIST_DIR}/cli`
const LANDER_DIR = `${DIST_DIR}/lander`

/**
 * Build Tailwind CSS with tree shaking - only includes used classes
 */
async function buildCSS(contentGlobs: string[]): Promise<string> {
  const inputPath = resolve(APP_DIR, 'web/globals.css')
  if (!existsSync(inputPath)) {
    throw new Error(`CSS input file not found: ${inputPath}`)
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'node-css-'))
  const outputPath = join(tempDir, 'output.css')

  const proc = Bun.spawn(
    [
      'bunx',
      'tailwindcss',
      '-i',
      inputPath,
      '-o',
      outputPath,
      '-c',
      resolve(APP_DIR, 'tailwind.config.ts'),
      '--content',
      contentGlobs.join(','),
      '--minify',
    ],
    { stdout: 'pipe', stderr: 'pipe', cwd: APP_DIR },
  )

  const exitCode = await proc.exited
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text()
    await rm(tempDir, { recursive: true })
    throw new Error(`Tailwind CSS build failed: ${stderr}`)
  }

  const css = await readFile(outputPath, 'utf-8')
  await rm(tempDir, { recursive: true })
  return css
}

async function buildFrontend(): Promise<void> {
  console.log('[Node] Building static frontend...')

  // Build CSS first (tree-shaken to only web components)
  console.log('[Node] Building CSS...')
  const css = await buildCSS([resolve(APP_DIR, 'web/**/*.{ts,tsx}')])
  await writeFile(`${STATIC_DIR}/globals.css`, css)

  const result = await Bun.build({
    entrypoints: [resolve(APP_DIR, 'web/main.tsx')],
    outdir: STATIC_DIR,
    target: 'browser',
    minify: true,
    sourcemap: 'external',
    external: BROWSER_EXTERNALS,
    packages: 'bundle',
    splitting: false,
    plugins: [
      createBrowserPlugin({ appDir: APP_DIR }),
      {
        name: 'tauri-mock',
        setup(build) {
          // Mock Tauri invoke for browser builds
          build.onResolve({ filter: /@tauri-apps\/api\/core/ }, () => ({
            path: 'tauri-mock',
            namespace: 'tauri-mock',
          }))
          build.onLoad({ filter: /.*/, namespace: 'tauri-mock' }, () => ({
            contents: `
              export async function invoke(cmd) {
                console.warn('Tauri invoke called in browser context:', cmd);
                throw new Error('Tauri commands not available in browser');
              }
            `,
            loader: 'js',
          }))
        },
      },
    ],
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.browser': JSON.stringify(true),
      'process.env': JSON.stringify({ NODE_ENV: 'production' }),
      process: JSON.stringify({
        env: { NODE_ENV: 'production' },
        browser: true,
      }),
    },
    naming: {
      entry: '[name]-[hash].js',
      chunk: 'chunks/[name]-[hash].js',
      asset: 'assets/[name]-[hash].[ext]',
    },
    drop: ['debugger'],
  })

  if (!result.success) {
    console.error('[Node] Frontend build failed:')
    for (const log of result.logs) {
      console.error(log)
    }
    throw new Error('Frontend build failed')
  }

  reportBundleSizes(result, 'Frontend')

  // Find the main entry file
  const mainEntry = result.outputs.find(
    (o) => o.kind === 'entry-point' && o.path.includes('main'),
  )
  const mainFileName = mainEntry ? mainEntry.path.split('/').pop() : 'main.js'

  // Create index.html with compiled CSS (no Tailwind CDN)
  const html = `<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/public/jeju-icon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Network Node</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/globals.css" />
  </head>
  <body class="bg-volcanic-950 text-volcanic-100">
    <div id="root"></div>
    <script type="module" src="/${mainFileName}"></script>
  </body>
</html>`

  await writeFile(`${STATIC_DIR}/index.html`, html)

  // Copy public assets
  if (existsSync(resolve(APP_DIR, 'public'))) {
    await cp(resolve(APP_DIR, 'public'), `${STATIC_DIR}/public`, {
      recursive: true,
    })
  }

  console.log(`[Node] Frontend built to ${STATIC_DIR}/`)
}

async function buildCLI(): Promise<void> {
  console.log('[Node] Building CLI...')

  const result = await Bun.build({
    entrypoints: [resolve(APP_DIR, 'api/cli.ts')],
    outdir: CLI_DIR,
    target: 'bun',
    minify: true,
    sourcemap: 'external',
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    drop: ['debugger'],
  })

  if (!result.success) {
    console.error('[Node] CLI build failed:')
    for (const log of result.logs) {
      console.error(log)
    }
    throw new Error('CLI build failed')
  }

  reportBundleSizes(result, 'CLI')
  console.log(`[Node] CLI built to ${CLI_DIR}/`)
}

async function buildLander(): Promise<void> {
  console.log('[Node] Building lander page...')

  const landerEntry = resolve(APP_DIR, 'lander/main.tsx')
  if (!existsSync(landerEntry)) {
    console.log('[Node] No lander found, skipping')
    return
  }

  // Build lander CSS
  console.log('[Node] Building lander CSS...')
  const css = await buildCSS([resolve(APP_DIR, 'lander/**/*.{ts,tsx}')])
  await writeFile(`${LANDER_DIR}/styles.css`, css)

  const result = await Bun.build({
    entrypoints: [landerEntry],
    outdir: LANDER_DIR,
    target: 'browser',
    minify: true,
    sourcemap: 'external',
    packages: 'bundle',
    splitting: false,
    plugins: [createBrowserPlugin({ appDir: APP_DIR })],
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    naming: {
      entry: '[name]-[hash].js',
      chunk: 'chunks/[name]-[hash].js',
      asset: 'assets/[name]-[hash].[ext]',
    },
    drop: ['debugger'],
  })

  if (!result.success) {
    console.error('[Node] Lander build failed:')
    for (const log of result.logs) {
      console.error(log)
    }
    throw new Error('Lander build failed')
  }

  reportBundleSizes(result, 'Lander')

  // Find the main entry file
  const mainEntry = result.outputs.find(
    (o) => o.kind === 'entry-point' && o.path.includes('main'),
  )
  const mainFileName = mainEntry ? mainEntry.path.split('/').pop() : 'main.js'

  // Copy and update index.html
  const landerHtml = await readFile(
    resolve(APP_DIR, 'lander/index.html'),
    'utf-8',
  )
  let updatedHtml = landerHtml.replace('/main.tsx', `/${mainFileName}`)
  // Replace any Tailwind CDN script with compiled CSS
  updatedHtml = updatedHtml.replace(
    /<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>[\s\S]*?<\/script>/g,
    '',
  )
  updatedHtml = updatedHtml.replace(
    '</head>',
    '  <link rel="stylesheet" href="/styles.css" />\n  </head>',
  )
  await writeFile(`${LANDER_DIR}/index.html`, updatedHtml)

  console.log(`[Node] Lander built to ${LANDER_DIR}/`)
}

async function createDeploymentBundle(): Promise<void> {
  console.log('[Node] Creating deployment bundle...')

  // Create deployment manifest
  const deploymentManifest = {
    name: 'node',
    version: '1.0.0',
    architecture: {
      frontend: {
        type: 'static',
        path: 'static',
        spa: true,
        fallback: 'index.html',
      },
      lander: {
        type: 'static',
        path: 'lander',
        spa: false,
      },
      cli: {
        type: 'bun',
        path: 'cli',
        entrypoint: 'cli.js',
      },
    },
    dws: {
      regions: ['global'],
      tee: { preferred: true, required: false },
    },
  }

  await writeFile(
    `${DIST_DIR}/deployment.json`,
    JSON.stringify(deploymentManifest, null, 2),
  )

  console.log('[Node] Deployment bundle created')
}

async function build(): Promise<void> {
  console.log('[Node] Building for deployment...\n')
  const startTime = Date.now()

  // Clean dist directory
  if (existsSync(DIST_DIR)) {
    await rm(DIST_DIR, { recursive: true })
  }

  // Create directories
  await mkdir(STATIC_DIR, { recursive: true })
  await mkdir(CLI_DIR, { recursive: true })
  await mkdir(LANDER_DIR, { recursive: true })

  // Build frontend, CLI, and lander
  await buildFrontend()
  await buildCLI()
  await buildLander()

  // Create deployment bundle
  await createDeploymentBundle()

  const duration = Date.now() - startTime
  console.log('')
  console.log(`[Node] Build complete in ${duration}ms`)
  console.log('[Node] Output:')
  console.log('   Static frontend: ./dist/static/')
  console.log('   CLI bundle: ./dist/cli/')
  console.log('   Lander: ./dist/lander/')
  console.log('   Deployment manifest: ./dist/deployment.json')
  process.exit(0)
}

build().catch((error) => {
  console.error('[Node] Build failed:', error)
  process.exit(1)
})
