/**
 * Sequencer Service
 *
 * Enables node operators to run as L2 sequencers with:
 * - Transaction ordering
 * - Batch submission
 * - State root proposal
 * - Delegated staking integration
 *
 * Requirements:
 * - Minimum stake (self + delegated)
 * - TEE capability for sensitive operations
 * - High uptime SLA
 */

import type { Address, Hex } from 'viem'
import type { NodeClient } from '../contracts'

export interface SequencerConfig {
  enabled: boolean
  privateKey: Hex
  l1RpcUrl: string
  l2RpcUrl: string
  batcherAddress: Address
  proposerAddress: Address
  minStake: bigint
  teeRequired: boolean
  batchInterval: number // seconds
  proposalInterval: number // seconds
}

export interface SequencerState {
  isActive: boolean
  isSequencing: boolean
  currentBatch: number
  lastBatchTime: number
  lastProposalTime: number
  pendingTransactions: number
  totalBatchesSubmitted: number
  totalProposalsSubmitted: number
  earnings: bigint
}

export interface SequencerService {
  readonly config: SequencerConfig
  readonly state: SequencerState

  // Lifecycle
  start(): Promise<void>
  stop(): Promise<void>
  isHealthy(): Promise<boolean>

  // Sequencing
  submitBatch(): Promise<Hex>
  proposeStateRoot(): Promise<Hex>

  // Staking
  getStake(): Promise<bigint>
  getRequiredStake(): Promise<bigint>
  registerAsSequencer(): Promise<Hex>
  deregisterSequencer(): Promise<Hex>

  // Metrics
  getMetrics(): Promise<SequencerMetrics>
}

export interface SequencerMetrics {
  batchesPerHour: number
  proposalsPerHour: number
  averageBatchSize: number
  averageGasUsed: bigint
  uptime: number
  earnings24h: bigint
}

const DEFAULT_CONFIG: SequencerConfig = {
  enabled: false,
  privateKey: '0x' as Hex,
  l1RpcUrl: 'http://localhost:8545',
  l2RpcUrl: 'http://localhost:9545',
  batcherAddress: '0x0000000000000000000000000000000000000000' as Address,
  proposerAddress: '0x0000000000000000000000000000000000000000' as Address,
  minStake: 100_000n * 10n ** 18n, // 100,000 tokens
  teeRequired: true,
  batchInterval: 12, // 12 seconds (1 L1 block)
  proposalInterval: 1800, // 30 minutes
}

export function createSequencerService(
  client: NodeClient,
  config: Partial<SequencerConfig> = {},
): SequencerService {
  const fullConfig: SequencerConfig = { ...DEFAULT_CONFIG, ...config }

  const state: SequencerState = {
    isActive: false,
    isSequencing: false,
    currentBatch: 0,
    lastBatchTime: 0,
    lastProposalTime: 0,
    pendingTransactions: 0,
    totalBatchesSubmitted: 0,
    totalProposalsSubmitted: 0,
    earnings: 0n,
  }

  let batchInterval: ReturnType<typeof setInterval> | null = null
  let proposalInterval: ReturnType<typeof setInterval> | null = null

  async function start(): Promise<void> {
    if (!fullConfig.enabled) {
      console.log('[Sequencer] Service disabled')
      return
    }

    console.log('[Sequencer] Starting sequencer service...')

    // Verify stake
    const stake = await getStake()
    const required = await getRequiredStake()
    if (stake < required) {
      throw new Error(
        `Insufficient stake: ${stake} < ${required}. Need more delegations or self-stake.`,
      )
    }

    // Register as sequencer if not already
    await registerAsSequencer()

    state.isActive = true
    state.isSequencing = true

    // Start batch submission loop
    batchInterval = setInterval(async () => {
      try {
        await submitBatch()
      } catch (error) {
        console.error('[Sequencer] Batch submission failed:', error)
      }
    }, fullConfig.batchInterval * 1000)

    // Start proposal loop
    proposalInterval = setInterval(async () => {
      try {
        await proposeStateRoot()
      } catch (error) {
        console.error('[Sequencer] Proposal failed:', error)
      }
    }, fullConfig.proposalInterval * 1000)

    console.log('[Sequencer] Sequencer service started')
  }

  async function stop(): Promise<void> {
    console.log('[Sequencer] Stopping sequencer service...')

    if (batchInterval) {
      clearInterval(batchInterval)
      batchInterval = null
    }
    if (proposalInterval) {
      clearInterval(proposalInterval)
      proposalInterval = null
    }

    state.isSequencing = false
    state.isActive = false

    console.log('[Sequencer] Sequencer service stopped')
  }

  async function isHealthy(): Promise<boolean> {
    if (!state.isActive) return true // Not running is healthy

    // Check if batches are being submitted
    const timeSinceLastBatch = Date.now() - state.lastBatchTime
    const maxBatchDelay = fullConfig.batchInterval * 3 * 1000

    return timeSinceLastBatch < maxBatchDelay
  }

  async function submitBatch(): Promise<Hex> {
    if (!state.isSequencing) {
      throw new Error('Not sequencing')
    }

    console.log('[Sequencer] Submitting batch...')

    // In production, this would:
    // 1. Collect pending transactions from L2 mempool
    // 2. Order transactions
    // 3. Create batch data
    // 4. Submit to L1 batcher contract

    // For now, return a mock transaction hash
    const txHash =
      `0x${Date.now().toString(16)}${'0'.repeat(48)}` as Hex

    state.currentBatch++
    state.lastBatchTime = Date.now()
    state.totalBatchesSubmitted++

    console.log(`[Sequencer] Batch ${state.currentBatch} submitted: ${txHash.slice(0, 18)}...`)

    return txHash
  }

  async function proposeStateRoot(): Promise<Hex> {
    if (!state.isSequencing) {
      throw new Error('Not sequencing')
    }

    console.log('[Sequencer] Proposing state root...')

    // In production, this would:
    // 1. Calculate current L2 state root
    // 2. Create output proposal
    // 3. Submit to L1 proposer contract

    const txHash =
      `0x${Date.now().toString(16)}${'0'.repeat(48)}` as Hex

    state.lastProposalTime = Date.now()
    state.totalProposalsSubmitted++

    console.log(`[Sequencer] State root proposed: ${txHash.slice(0, 18)}...`)

    return txHash
  }

  async function getStake(): Promise<bigint> {
    // Query DelegatedNodeStaking contract for total stake
    // This includes self-stake + delegated stake
    return client.stake ?? 0n
  }

  async function getRequiredStake(): Promise<bigint> {
    return fullConfig.minStake
  }

  async function registerAsSequencer(): Promise<Hex> {
    console.log('[Sequencer] Registering as sequencer...')

    // In production, this would call SequencerRegistry.register()
    const txHash =
      `0x${Date.now().toString(16)}${'0'.repeat(48)}` as Hex

    console.log('[Sequencer] Registered as sequencer')
    return txHash
  }

  async function deregisterSequencer(): Promise<Hex> {
    console.log('[Sequencer] Deregistering sequencer...')

    await stop()

    const txHash =
      `0x${Date.now().toString(16)}${'0'.repeat(48)}` as Hex

    console.log('[Sequencer] Deregistered from sequencer set')
    return txHash
  }

  async function getMetrics(): Promise<SequencerMetrics> {
    const now = Date.now()
    const oneHour = 60 * 60 * 1000
    const oneDay = 24 * oneHour

    // Calculate hourly rates
    const hoursActive = Math.max(
      1,
      (now - (state.lastBatchTime || now)) / oneHour,
    )

    return {
      batchesPerHour: state.totalBatchesSubmitted / hoursActive,
      proposalsPerHour: state.totalProposalsSubmitted / hoursActive,
      averageBatchSize: state.pendingTransactions / Math.max(1, state.totalBatchesSubmitted),
      averageGasUsed: 0n, // Would track actual gas usage
      uptime: state.isActive ? 1 : 0,
      earnings24h: state.earnings, // Would track actual earnings
    }
  }

  return {
    get config() {
      return fullConfig
    },
    get state() {
      return state
    },
    start,
    stop,
    isHealthy,
    submitBatch,
    proposeStateRoot,
    getStake,
    getRequiredStake,
    registerAsSequencer,
    deregisterSequencer,
    getMetrics,
  }
}

export function getDefaultSequencerConfig(): Partial<SequencerConfig> {
  return {
    enabled: false,
    batchInterval: 12,
    proposalInterval: 1800,
    teeRequired: true,
    minStake: 100_000n * 10n ** 18n,
  }
}

