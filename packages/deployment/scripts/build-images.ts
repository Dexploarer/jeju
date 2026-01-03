#!/usr/bin/env bun

/**
 * Build and push Docker images to ECR
 *
 * ONLY infrastructure services that need Docker/K8s deployment.
 * Apps (bazaar, gateway, crucible, etc.) deploy to DWS via:
 *   - Static frontend -> DWS Storage (IPFS)
 *   - Workers backend -> DWS Workers (workerd)
 *
 * Usage:
 *   NETWORK=testnet bun run scripts/build-images.ts
 *   NETWORK=testnet bun run scripts/build-images.ts --push
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { $ } from 'bun'
import {
  getEcrRegistry,
  getGitShortHash,
  getRequiredNetwork,
  loginToEcr,
  type NetworkType,
} from './shared'

const NETWORK: NetworkType = getRequiredNetwork()
const PUSH = process.argv.includes('--push')
const PROJECT_ROOT = join(import.meta.dir, '../../..')

interface AppConfig {
  dockerfile: string
  context: string
  description: string
}

// Infrastructure services only - these ARE the decentralized network
// Apps deploy via DWS (static + workers), not Docker
const INFRASTRUCTURE: Record<string, AppConfig> = {
  // Core DWS server - runs the infrastructure
  dws: {
    dockerfile: 'apps/dws/Dockerfile',
    context: '.',
    description: 'DWS server (storage, workers, JNS gateway)',
  },
  // IPFS node for decentralized storage
  ipfs: {
    dockerfile: 'apps/ipfs/Dockerfile',
    context: 'apps/ipfs',
    description: 'IPFS node for DWS storage backend',
  },
  // Subsquid processor for blockchain indexing (not the app frontend)
  'indexer-processor': {
    dockerfile: 'apps/indexer/Dockerfile.k8s',
    context: 'apps/indexer',
    description: 'Subsquid processor for blockchain data indexing',
  },
}

async function main(): Promise<void> {
  console.log(`🐳 Building infrastructure Docker images for ${NETWORK}`)
  console.log('   (Apps deploy via DWS: static frontend + workers backend)\n')

  const gitHash = await getGitShortHash()
  const tag = `${NETWORK}-${gitHash}`

  let registry = ''
  if (PUSH) {
    registry = await getEcrRegistry()
    console.log(`📦 ECR Registry: ${registry}\n`)
    await loginToEcr(registry)
  }

  for (const [name, config] of Object.entries(INFRASTRUCTURE)) {
    const dockerfilePath = join(PROJECT_ROOT, config.dockerfile)

    if (!existsSync(dockerfilePath)) {
      console.log(`⏭️  Skipping ${name} (no Dockerfile)`)
      continue
    }

    console.log(`\n🔨 Building ${name}...`)
    console.log(`   ${config.description}`)

    const imageName = PUSH ? `${registry}/jeju/${name}` : `jeju/${name}`
    const fullTag = `${imageName}:${tag}`
    const latestTag = `${imageName}:${NETWORK}-latest`

    const buildResult = await $`docker build \
      -f ${dockerfilePath} \
      -t ${fullTag} \
      -t ${latestTag} \
      --platform linux/amd64 \
      --build-arg ENVIRONMENT=${NETWORK} \
      ${join(PROJECT_ROOT, config.context)}`.nothrow()

    if (buildResult.exitCode !== 0) {
      console.error(`❌ Build failed for ${name}`)
      process.exit(1)
    }

    if (PUSH) {
      console.log(`   Pushing ${name}...`)
      await $`docker push ${fullTag}`
      await $`docker push ${latestTag}`
    }

    console.log(`   ✅ ${name}`)
  }

  console.log(
    `\n✅ All infrastructure images built${PUSH ? ' and pushed' : ''}\n`,
  )
}

main()
