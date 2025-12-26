#!/usr/bin/env bun
/**
 * DWS External Chain Provisioning
 *
 * Provisions archive nodes for all external blockchains via DWS.
 * Deploys all EVM chains and Solana by default - no flags needed.
 *
 * Deployment Modes (based on NETWORK env):
 * - localnet: Anvil forks mainnet (real Chainlink feeds)
 * - testnet:  DWS-provisioned reth/nitro nodes, TEE optional
 * - mainnet:  DWS-provisioned full archive nodes, TEE required
 *
 * For testnet/mainnet deployments, this script provisions containers
 * through the DWS infrastructure, which runs on the permissionless network.
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  type Address,
  createPublicClient,
  createWalletClient,
  type Hex,
  http,
  keccak256,
  parseEther,
  toBytes,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, baseSepolia, foundry } from 'viem/chains'
import { getRequiredNetwork, type NetworkType } from '../shared'

const ROOT = join(import.meta.dir, '../../../..')
const CONTRACTS_DIR = join(ROOT, 'packages/contracts')
const DEPLOYMENTS_DIR = join(CONTRACTS_DIR, 'deployments')

// All chains to deploy - always deploy everything
const ALL_CHAINS = ['ethereum', 'arbitrum', 'optimism', 'base', 'solana']

enum ChainType {
  Solana = 0,
  Bitcoin = 1,
  Cosmos = 2,
  Polkadot = 3,
  Near = 4,
  Aptos = 5,
  Sui = 6,
  Avalanche = 7,
  Polygon = 8,
  Arbitrum = 9,
  Optimism = 10,
  Base = 11,
  Custom = 12,
  Ethereum = 13,
}

enum NodeType {
  RPC = 0,
  Validator = 1,
  Archive = 2,
  Light = 3,
  Indexer = 4,
  Geyser = 5,
  Bridge = 6,
}

enum NetworkMode {
  Devnet = 0,
  Testnet = 1,
  Mainnet = 2,
}

interface ChainConfig {
  chainType: ChainType
  nodeType: NodeType
  version: string
  teeRequired: boolean
  teeType: string
  minMemoryGb: number
  minStorageGb: number
  minCpuCores: number
  dockerImage: string
  additionalParams: string[]
  evmChainId?: number
  forkUrl?: string
  rpcPort?: number
  wsPort?: number
}

// Chain configurations for all modes
const CHAIN_CONFIGS: Record<string, Record<NetworkMode, ChainConfig>> = {
  solana: {
    [NetworkMode.Devnet]: {
      chainType: ChainType.Solana,
      nodeType: NodeType.RPC,
      version: 'v2.1.0',
      teeRequired: false,
      teeType: '',
      minMemoryGb: 8,
      minStorageGb: 50,
      minCpuCores: 4,
      dockerImage: 'solanalabs/solana:v1.18.26',
      additionalParams: ['--dev', '--reset'],
    },
    [NetworkMode.Testnet]: {
      chainType: ChainType.Solana,
      nodeType: NodeType.RPC,
      version: 'v2.1.0',
      teeRequired: false,
      teeType: '',
      minMemoryGb: 64,
      minStorageGb: 500,
      minCpuCores: 8,
      dockerImage: 'solanalabs/solana:v2.1.0',
      additionalParams: ['--entrypoint', 'devnet.solana.com:8001'],
    },
    [NetworkMode.Mainnet]: {
      chainType: ChainType.Solana,
      nodeType: NodeType.RPC,
      version: 'v2.1.0',
      teeRequired: true,
      teeType: 'intel_tdx',
      minMemoryGb: 128,
      minStorageGb: 2000,
      minCpuCores: 16,
      dockerImage: 'solanalabs/solana:v2.1.0',
      additionalParams: ['--entrypoint', 'mainnet-beta.solana.com:8001'],
    },
  },

  ethereum: {
    [NetworkMode.Devnet]: {
      chainType: ChainType.Ethereum,
      nodeType: NodeType.Archive,
      version: 'v1.1.5',
      teeRequired: false,
      teeType: '',
      minMemoryGb: 8,
      minStorageGb: 50,
      minCpuCores: 4,
      dockerImage: 'ghcr.io/foundry-rs/foundry:latest',
      additionalParams: [],
      evmChainId: 1,
      forkUrl: 'https://1rpc.io/eth',
      rpcPort: 8545,
      wsPort: 8546,
    },
    [NetworkMode.Testnet]: {
      chainType: ChainType.Ethereum,
      nodeType: NodeType.Archive,
      version: 'v1.1.5',
      teeRequired: false,
      teeType: '',
      minMemoryGb: 32,
      minStorageGb: 500,
      minCpuCores: 8,
      dockerImage: 'ghcr.io/paradigmxyz/reth:v1.1.5',
      additionalParams: ['--chain', 'mainnet', '--http', '--http.api', 'all', '--ws', '--ws.api', 'all'],
      evmChainId: 1,
      rpcPort: 8545,
      wsPort: 8546,
    },
    [NetworkMode.Mainnet]: {
      chainType: ChainType.Ethereum,
      nodeType: NodeType.Archive,
      version: 'v1.1.5',
      teeRequired: true,
      teeType: 'intel_tdx',
      minMemoryGb: 64,
      minStorageGb: 2500,
      minCpuCores: 16,
      dockerImage: 'ghcr.io/paradigmxyz/reth:v1.1.5',
      additionalParams: ['--chain', 'mainnet', '--http', '--http.api', 'all', '--ws', '--ws.api', 'all', '--full'],
      evmChainId: 1,
      rpcPort: 8545,
      wsPort: 8546,
    },
  },

  arbitrum: {
    [NetworkMode.Devnet]: {
      chainType: ChainType.Arbitrum,
      nodeType: NodeType.Archive,
      version: 'v3.2.1',
      teeRequired: false,
      teeType: '',
      minMemoryGb: 8,
      minStorageGb: 50,
      minCpuCores: 4,
      dockerImage: 'ghcr.io/foundry-rs/foundry:latest',
      additionalParams: [],
      evmChainId: 42161,
      forkUrl: 'https://arb1.arbitrum.io/rpc',
      rpcPort: 8547,
      wsPort: 8548,
    },
    [NetworkMode.Testnet]: {
      chainType: ChainType.Arbitrum,
      nodeType: NodeType.Archive,
      version: 'v3.2.1',
      teeRequired: false,
      teeType: '',
      minMemoryGb: 32,
      minStorageGb: 300,
      minCpuCores: 8,
      dockerImage: 'offchainlabs/nitro-node:v3.2.1-d1c5a49',
      additionalParams: ['--chain.id=42161', '--http.api=net,web3,eth,arb,debug', '--http.vhosts=*', '--http.addr=0.0.0.0'],
      evmChainId: 42161,
      rpcPort: 8547,
      wsPort: 8548,
    },
    [NetworkMode.Mainnet]: {
      chainType: ChainType.Arbitrum,
      nodeType: NodeType.Archive,
      version: 'v3.2.1',
      teeRequired: true,
      teeType: 'intel_tdx',
      minMemoryGb: 64,
      minStorageGb: 1000,
      minCpuCores: 16,
      dockerImage: 'offchainlabs/nitro-node:v3.2.1-d1c5a49',
      additionalParams: ['--chain.id=42161', '--http.api=net,web3,eth,arb,debug', '--http.vhosts=*', '--http.addr=0.0.0.0', '--execution.caching.archive'],
      evmChainId: 42161,
      rpcPort: 8547,
      wsPort: 8548,
    },
  },

  optimism: {
    [NetworkMode.Devnet]: {
      chainType: ChainType.Optimism,
      nodeType: NodeType.Archive,
      version: 'v1.9.4',
      teeRequired: false,
      teeType: '',
      minMemoryGb: 8,
      minStorageGb: 50,
      minCpuCores: 4,
      dockerImage: 'ghcr.io/foundry-rs/foundry:latest',
      additionalParams: [],
      evmChainId: 10,
      forkUrl: 'https://mainnet.optimism.io',
      rpcPort: 8549,
      wsPort: 8550,
    },
    [NetworkMode.Testnet]: {
      chainType: ChainType.Optimism,
      nodeType: NodeType.Archive,
      version: 'v1.9.4',
      teeRequired: false,
      teeType: '',
      minMemoryGb: 32,
      minStorageGb: 300,
      minCpuCores: 8,
      dockerImage: 'ghcr.io/paradigmxyz/op-reth:v1.1.5',
      additionalParams: ['--chain', 'optimism', '--http', '--http.api', 'all', '--ws', '--ws.api', 'all'],
      evmChainId: 10,
      rpcPort: 8549,
      wsPort: 8550,
    },
    [NetworkMode.Mainnet]: {
      chainType: ChainType.Optimism,
      nodeType: NodeType.Archive,
      version: 'v1.9.4',
      teeRequired: true,
      teeType: 'intel_tdx',
      minMemoryGb: 64,
      minStorageGb: 800,
      minCpuCores: 16,
      dockerImage: 'ghcr.io/paradigmxyz/op-reth:v1.1.5',
      additionalParams: ['--chain', 'optimism', '--http', '--http.api', 'all', '--ws', '--ws.api', 'all', '--full'],
      evmChainId: 10,
      rpcPort: 8549,
      wsPort: 8550,
    },
  },

  base: {
    [NetworkMode.Devnet]: {
      chainType: ChainType.Base,
      nodeType: NodeType.Archive,
      version: 'v1.9.4',
      teeRequired: false,
      teeType: '',
      minMemoryGb: 8,
      minStorageGb: 50,
      minCpuCores: 4,
      dockerImage: 'ghcr.io/foundry-rs/foundry:latest',
      additionalParams: [],
      evmChainId: 8453,
      forkUrl: 'https://mainnet.base.org',
      rpcPort: 8551,
      wsPort: 8552,
    },
    [NetworkMode.Testnet]: {
      chainType: ChainType.Base,
      nodeType: NodeType.Archive,
      version: 'v1.9.4',
      teeRequired: false,
      teeType: '',
      minMemoryGb: 32,
      minStorageGb: 300,
      minCpuCores: 8,
      dockerImage: 'ghcr.io/paradigmxyz/op-reth:v1.1.5',
      additionalParams: ['--chain', 'base', '--http', '--http.api', 'all', '--ws', '--ws.api', 'all'],
      evmChainId: 8453,
      rpcPort: 8551,
      wsPort: 8552,
    },
    [NetworkMode.Mainnet]: {
      chainType: ChainType.Base,
      nodeType: NodeType.Archive,
      version: 'v1.9.4',
      teeRequired: true,
      teeType: 'intel_tdx',
      minMemoryGb: 64,
      minStorageGb: 600,
      minCpuCores: 16,
      dockerImage: 'ghcr.io/paradigmxyz/op-reth:v1.1.5',
      additionalParams: ['--chain', 'base', '--http', '--http.api', 'all', '--ws', '--ws.api', 'all', '--full'],
      evmChainId: 8453,
      rpcPort: 8551,
      wsPort: 8552,
    },
  },
}

interface DeploymentResult {
  network: NetworkType
  chain: string
  mode: 'local' | 'dws'
  providerId?: string
  nodeId?: string
  containerId?: string
  endpoints: {
    rpc: string
    ws: string
  }
  tee: boolean
  status: 'running' | 'pending' | 'failed'
}

// DWS API Configuration
interface DWSContainerConfig {
  image: string
  tag: string
  command: string[]
  env: Record<string, string>
  hardware: {
    cpuCores: number
    memoryMb: number
    storageMb: number
    gpuType: string
    gpuCount: number
    networkBandwidthMbps: number
    publicIp: boolean
    teePlatform: string
  }
  ports: Array<{
    containerPort: number
    protocol: 'tcp' | 'udp'
    expose: boolean
  }>
  labels: Record<string, string>
}

const DWS_ENDPOINTS: Record<NetworkType, string> = {
  localnet: 'http://localhost:4030',
  testnet: 'https://dws.testnet.jejunetwork.org',
  mainnet: 'https://dws.jejunetwork.org',
}

async function deployLocalNode(
  chain: string,
  networkMode: NetworkMode,
): Promise<DeploymentResult> {
  console.log(`\n  ${chain.toUpperCase()}:`)

  const config = CHAIN_CONFIGS[chain]?.[networkMode]
  if (!config) {
    throw new Error(`Unsupported chain: ${chain}`)
  }

  const containerName = `jeju-${chain}-localnet`

  // Check if already running
  try {
    const running = execSync(`docker ps -q -f name=${containerName}`, {
      encoding: 'utf-8',
    }).trim()
    if (running) {
      console.log(`    Already running`)
      return getLocalEndpoints(chain, config)
    }
  } catch {
    // Container not running, continue
  }

  // Check if stopped container exists and remove it
  try {
    const existing = execSync(`docker ps -aq -f name=${containerName}`, {
      encoding: 'utf-8',
    }).trim()
    if (existing) {
      console.log(`    Removing stopped container...`)
      execSync(`docker rm -f ${containerName}`, { stdio: 'pipe' })
    }
  } catch {
    // No existing container
  }

  // Start container based on chain type
  if (chain === 'solana') {
    console.log('    Starting Solana test validator...')
    // Detect ARM architecture and add --no-bpf-jit flag for compatibility
    const arch = process.arch
    const isArm = arch === 'arm64' || arch === 'arm'
    const bpfFlag = isArm ? '--no-bpf-jit' : ''
    console.log(`    Architecture: ${arch}${isArm ? ' (using --no-bpf-jit)' : ''}`)
    
    execSync(
      `docker run -d --name ${containerName} \
      --platform linux/amd64 \
      -p 8899:8899 -p 8900:8900 -p 9900:9900 \
      ${config.dockerImage} \
      solana-test-validator \
      --bind-address 0.0.0.0 \
      --rpc-port 8899 \
      --faucet-port 9900 \
      --ledger /data/ledger \
      ${bpfFlag} \
      --reset \
      --quiet`,
      { stdio: 'pipe' },
    )
    await Bun.sleep(8000) // Give more time for emulation startup
  } else if (config.evmChainId && config.forkUrl) {
    const rpcPort = config.rpcPort ?? 8545
    console.log(`    Starting Anvil fork (${config.forkUrl})...`)

    // Use entrypoint override to run anvil with fork
    execSync(
      `docker run -d --name ${containerName} \
      -p ${rpcPort}:8545 \
      --entrypoint anvil \
      ${config.dockerImage} \
      --fork-url ${config.forkUrl} \
      --chain-id ${config.evmChainId} \
      --host 0.0.0.0 \
      --port 8545 \
      --block-time 2`,
      { stdio: 'pipe' },
    )
    await Bun.sleep(10000) // Give more time for fork to sync

    // Verify fork is working by checking latest block
    try {
      const response = await fetch(`http://localhost:${rpcPort}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1,
        }),
      })
      const result = await response.json() as { result?: string }
      const blockNumber = parseInt(result.result ?? '0', 16)
      console.log(`    Block: ${blockNumber}, Chain ID: ${config.evmChainId}`)
    } catch (err) {
      console.log(`    Warning: Could not verify fork - ${err}`)
    }
  }

  return getLocalEndpoints(chain, config)
}

function getLocalEndpoints(
  chain: string,
  config?: ChainConfig,
): DeploymentResult {
  const staticEndpoints: Record<string, { rpc: string; ws: string }> = {
    solana: {
      rpc: 'http://localhost:8899',
      ws: 'ws://localhost:8900',
    },
  }

  if (config?.evmChainId && config.rpcPort) {
    return {
      network: 'localnet',
      chain,
      mode: 'local',
      endpoints: {
        rpc: `http://localhost:${config.rpcPort}`,
        ws: config.wsPort ? `ws://localhost:${config.wsPort}` : '',
      },
      tee: false,
      status: 'running',
    }
  }

  return {
    network: 'localnet',
    chain,
    mode: 'local',
    endpoints: staticEndpoints[chain] ?? { rpc: '', ws: '' },
    tee: false,
    status: 'running',
  }
}

/**
 * Provision a chain node via DWS API
 */
async function deployDWSNode(
  chain: string,
  networkMode: NetworkMode,
  network: NetworkType,
  privateKey: string,
): Promise<DeploymentResult> {
  console.log(`\n  ${chain.toUpperCase()}:`)

  const config = CHAIN_CONFIGS[chain]?.[networkMode]
  if (!config) {
    throw new Error(`Unsupported chain: ${chain}`)
  }

  const dwsEndpoint = DWS_ENDPOINTS[network]
  const account = privateKeyToAccount(privateKey as `0x${string}`)

  console.log(`    Provisioning via DWS (${dwsEndpoint})...`)

  // Build container configuration for DWS
  const containerConfig: DWSContainerConfig = {
    image: config.dockerImage,
    tag: 'latest',
    command: config.additionalParams,
    env: config.evmChainId
      ? { CHAIN_ID: config.evmChainId.toString() }
      : {},
    hardware: {
      cpuCores: config.minCpuCores,
      memoryMb: config.minMemoryGb * 1024,
      storageMb: config.minStorageGb * 1024,
      gpuType: 'none',
      gpuCount: 0,
      networkBandwidthMbps: 1000,
      publicIp: true,
      teePlatform: config.teeRequired ? config.teeType : 'none',
    },
    ports: [
      {
        containerPort: config.rpcPort ?? 8545,
        protocol: 'tcp',
        expose: true,
      },
      ...(config.wsPort
        ? [{ containerPort: config.wsPort, protocol: 'tcp' as const, expose: true }]
        : []),
    ],
    labels: {
      'jeju.chain': chain,
      'jeju.network': network,
      'jeju.type': 'external-chain',
      'jeju.node-type': NodeType[config.nodeType].toLowerCase(),
    },
  }

  // Sign the request
  const timestamp = Date.now()
  const message = JSON.stringify({ containerConfig, timestamp })
  const signature = await account.signMessage({ message })

  // Call DWS provisioning API
  const response = await fetch(`${dwsEndpoint}/v1/containers/provision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': signature,
      'X-Timestamp': timestamp.toString(),
      'X-Address': account.address,
    },
    body: JSON.stringify({
      config: containerConfig,
      owner: account.address,
      machineType: config.teeRequired ? 'tee-large' : 'xlarge',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.log(`    Failed: ${error}`)
    return {
      network,
      chain,
      mode: 'dws',
      endpoints: { rpc: '', ws: '' },
      tee: config.teeRequired,
      status: 'failed',
    }
  }

  const result = (await response.json()) as {
    containerId: string
    endpoints: { rpc: string; ws?: string }
    status: string
  }

  console.log(`    Container ID: ${result.containerId}`)
  console.log(`    RPC Endpoint: ${result.endpoints.rpc}`)
  if (result.endpoints.ws) {
    console.log(`    WS Endpoint:  ${result.endpoints.ws}`)
  }

  return {
    network,
    chain,
    mode: 'dws',
    containerId: result.containerId,
    endpoints: {
      rpc: result.endpoints.rpc,
      ws: result.endpoints.ws ?? '',
    },
    tee: config.teeRequired,
    status: result.status === 'running' ? 'running' : 'pending',
  }
}

async function main() {
  const network = getRequiredNetwork()
  const useTee = network === 'mainnet'
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║          DWS EXTERNAL CHAIN PROVISIONING                     ║
╠══════════════════════════════════════════════════════════════╣
║  Network: ${network.padEnd(50)}║
║  Chains:  ${ALL_CHAINS.join(', ').padEnd(50)}║
║  TEE:     ${useTee ? 'Yes'.padEnd(50) : 'No'.padEnd(50)}║
╚══════════════════════════════════════════════════════════════╝
`)

  const results: DeploymentResult[] = []
  const outputDir = join(DEPLOYMENTS_DIR, 'external-chains')
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  console.log('Deploying nodes:')

  for (const chain of ALL_CHAINS) {
    let result: DeploymentResult

    if (network === 'localnet') {
      result = await deployLocalNode(chain, NetworkMode.Devnet)
    } else {
      // For testnet/mainnet, use DWS provisioning
      const networkMode =
        network === 'mainnet' ? NetworkMode.Mainnet : NetworkMode.Testnet

      if (!privateKey) {
        console.log(`\n  ${chain.toUpperCase()}:`)
        console.log('    Skipped: DEPLOYER_PRIVATE_KEY not set')
        result = {
          network,
          chain,
          mode: 'dws',
          endpoints: { rpc: '', ws: '' },
          tee: useTee,
          status: 'pending',
        }
      } else {
        result = await deployDWSNode(chain, networkMode, network, privateKey)
      }
    }

    results.push(result)

    const outputFile = join(outputDir, `${network}-${chain}.json`)
    writeFileSync(
      outputFile,
      JSON.stringify(
        {
          ...result,
          deployedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    )
  }

  // Save combined results
  const combinedFile = join(outputDir, `${network}-all.json`)
  writeFileSync(
    combinedFile,
    JSON.stringify(
      {
        network,
        deployedAt: new Date().toISOString(),
        chains: Object.fromEntries(results.map((r) => [r.chain, r])),
      },
      null,
      2,
    ),
  )

  // Print summary
  const runningCount = results.filter((r) => r.status === 'running').length
  const pendingCount = results.filter((r) => r.status === 'pending').length
  const failedCount = results.filter((r) => r.status === 'failed').length

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    DEPLOYMENT SUMMARY                        ║
╠══════════════════════════════════════════════════════════════╣
║  Running: ${String(runningCount).padEnd(49)}║
║  Pending: ${String(pendingCount).padEnd(49)}║
║  Failed:  ${String(failedCount).padEnd(49)}║
╠══════════════════════════════════════════════════════════════╣`)

  for (const result of results) {
    const statusIcon =
      result.status === 'running'
        ? '✓'
        : result.status === 'pending'
          ? '◌'
          : '✗'
    if (result.endpoints.rpc) {
      console.log(
        `║  ${statusIcon} ${result.chain.padEnd(9)} ${result.endpoints.rpc.slice(0, 44).padEnd(44)}║`,
      )
    } else {
      console.log(
        `║  ${statusIcon} ${result.chain.padEnd(9)} ${result.status.padEnd(44)}║`,
      )
    }
  }

  console.log(`╠══════════════════════════════════════════════════════════════╣
║  Results: ${combinedFile.slice(-48).padEnd(48)}║
╚══════════════════════════════════════════════════════════════╝
`)

  // Print next steps for testnet/mainnet
  if (network !== 'localnet') {
    console.log(`
Next Steps:
1. Set contract addresses in deployment config
2. Update RPC URLs in helmfile environment
3. Run verification: bun run scripts/deploy/verify-external-chains.ts
`)
  }
}

main().catch((error) => {
  console.error('Deployment failed:', error)
  process.exit(1)
})
