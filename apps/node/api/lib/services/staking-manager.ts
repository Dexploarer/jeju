/**
 * Staking Manager Service
 *
 * Manages delegated staking for node operators with:
 * - Self-stake management
 * - Delegator tracking
 * - Reward distribution
 * - Commission management
 *
 * Profit Split Model:
 * - Compute Provider: 20-40% (commission for hardware/operations)
 * - Capital Stakers: 60-80% (proportional to delegation)
 * - Protocol Fee: 5% (to treasury)
 */

import type { Address, Hex } from 'viem'
import type { NodeClient } from '../contracts'

export interface StakingConfig {
  nodeId: Hex
  operatorAddress: Address
  commissionBps: number // 500-5000 (5%-50%)
  minDelegation: bigint
  acceptingDelegations: boolean
}

export interface StakingState {
  selfStake: bigint
  totalDelegated: bigint
  totalStake: bigint
  delegatorCount: number
  pendingRewards: bigint
  claimedRewards: bigint
  lastRewardTime: number
  apr: number // Annual percentage rate
}

export interface Delegator {
  address: Address
  amount: bigint
  delegatedAt: number
  pendingRewards: bigint
  claimedRewards: bigint
}

export interface StakingManagerService {
  readonly config: StakingConfig
  readonly state: StakingState

  // Operator functions
  setCommission(bps: number): Promise<Hex>
  addSelfStake(amount: bigint): Promise<Hex>
  withdrawSelfStake(amount: bigint): Promise<Hex>
  setAcceptingDelegations(accepting: boolean): Promise<void>

  // Delegator tracking
  getDelegators(): Promise<Delegator[]>
  getDelegator(address: Address): Promise<Delegator | null>
  getTotalDelegated(): Promise<bigint>

  // Rewards
  distributeRewards(amount: bigint): Promise<Hex>
  claimOperatorRewards(): Promise<Hex>
  getPendingRewards(): Promise<bigint>
  getEstimatedAPR(): Promise<number>

  // Metrics
  getStakingMetrics(): Promise<StakingMetrics>
}

export interface StakingMetrics {
  totalStake: bigint
  selfStakeRatio: number // Self-stake as % of total
  delegatorCount: number
  averageDelegation: bigint
  apr: number
  commission: number
  rewardsDistributed24h: bigint
}

const DEFAULT_CONFIG: StakingConfig = {
  nodeId: '0x' as Hex,
  operatorAddress: '0x0000000000000000000000000000000000000000' as Address,
  commissionBps: 2000, // 20% default commission
  minDelegation: 100n * 10n ** 18n, // 100 tokens minimum
  acceptingDelegations: true,
}

export function createStakingManagerService(
  client: NodeClient,
  config: Partial<StakingConfig> = {},
): StakingManagerService {
  const fullConfig: StakingConfig = { ...DEFAULT_CONFIG, ...config }

  const state: StakingState = {
    selfStake: 0n,
    totalDelegated: 0n,
    totalStake: 0n,
    delegatorCount: 0,
    pendingRewards: 0n,
    claimedRewards: 0n,
    lastRewardTime: 0,
    apr: 0,
  }

  // In-memory delegator tracking (production would use contract state)
  const delegators: Map<Address, Delegator> = new Map()

  async function setCommission(bps: number): Promise<Hex> {
    if (bps < 500 || bps > 5000) {
      throw new Error('Commission must be between 5% and 50%')
    }

    console.log(`[Staking] Setting commission to ${bps / 100}%`)

    // In production, this would call DelegatedNodeStaking.initiateCommissionChange()
    // with a 7-day delay to protect delegators

    fullConfig.commissionBps = bps

    return `0x${Date.now().toString(16)}${'0'.repeat(48)}` as Hex
  }

  async function addSelfStake(amount: bigint): Promise<Hex> {
    console.log(`[Staking] Adding self-stake: ${amount}`)

    state.selfStake += amount
    state.totalStake = state.selfStake + state.totalDelegated

    return `0x${Date.now().toString(16)}${'0'.repeat(48)}` as Hex
  }

  async function withdrawSelfStake(amount: bigint): Promise<Hex> {
    if (amount > state.selfStake) {
      throw new Error('Insufficient self-stake')
    }

    console.log(`[Staking] Withdrawing self-stake: ${amount}`)

    // Check minimum stake requirements
    const minSelfStake = 1000n * 10n ** 18n // 1000 tokens minimum
    if (state.selfStake - amount < minSelfStake) {
      throw new Error('Would drop below minimum self-stake')
    }

    state.selfStake -= amount
    state.totalStake = state.selfStake + state.totalDelegated

    return `0x${Date.now().toString(16)}${'0'.repeat(48)}` as Hex
  }

  async function setAcceptingDelegations(accepting: boolean): Promise<void> {
    fullConfig.acceptingDelegations = accepting
    console.log(`[Staking] ${accepting ? 'Now accepting' : 'No longer accepting'} delegations`)
  }

  async function getDelegators(): Promise<Delegator[]> {
    return Array.from(delegators.values())
  }

  async function getDelegator(address: Address): Promise<Delegator | null> {
    return delegators.get(address) ?? null
  }

  async function getTotalDelegated(): Promise<bigint> {
    return state.totalDelegated
  }

  async function distributeRewards(amount: bigint): Promise<Hex> {
    console.log(`[Staking] Distributing rewards: ${amount}`)

    if (state.totalStake === 0n) {
      throw new Error('No stake to distribute rewards to')
    }

    // Calculate splits
    const protocolFeeBps = 500n // 5%
    const protocolFee = (amount * protocolFeeBps) / 10000n
    const afterProtocol = amount - protocolFee

    const commissionBps = BigInt(fullConfig.commissionBps)
    const operatorShare = (afterProtocol * commissionBps) / 10000n
    const delegatorPool = afterProtocol - operatorShare

    // Add operator share to pending rewards
    state.pendingRewards += operatorShare

    // Distribute to delegators proportionally
    if (delegatorPool > 0n && state.totalDelegated > 0n) {
      for (const [, delegator] of delegators) {
        const share = (delegatorPool * delegator.amount) / state.totalDelegated
        delegator.pendingRewards += share
      }
    }

    state.lastRewardTime = Date.now()

    console.log(`[Staking] Distributed - Operator: ${operatorShare}, Delegators: ${delegatorPool}, Protocol: ${protocolFee}`)

    return `0x${Date.now().toString(16)}${'0'.repeat(48)}` as Hex
  }

  async function claimOperatorRewards(): Promise<Hex> {
    const amount = state.pendingRewards
    if (amount === 0n) {
      throw new Error('No pending rewards')
    }

    console.log(`[Staking] Claiming operator rewards: ${amount}`)

    state.claimedRewards += amount
    state.pendingRewards = 0n

    return `0x${Date.now().toString(16)}${'0'.repeat(48)}` as Hex
  }

  async function getPendingRewards(): Promise<bigint> {
    return state.pendingRewards
  }

  async function getEstimatedAPR(): Promise<number> {
    // Calculate APR based on recent rewards
    // This is a simplified calculation
    if (state.totalStake === 0n || state.lastRewardTime === 0) {
      return 0
    }

    const timeSinceStart = Date.now() - state.lastRewardTime
    if (timeSinceStart === 0) return 0

    const totalRewards = state.claimedRewards + state.pendingRewards
    const annualized = (totalRewards * 365n * 24n * 60n * 60n * 1000n) / BigInt(timeSinceStart)
    const apr = Number((annualized * 10000n) / state.totalStake)

    return apr / 100 // Convert basis points to percentage
  }

  async function getStakingMetrics(): Promise<StakingMetrics> {
    const apr = await getEstimatedAPR()

    return {
      totalStake: state.totalStake,
      selfStakeRatio: state.totalStake > 0n
        ? Number((state.selfStake * 10000n) / state.totalStake) / 100
        : 0,
      delegatorCount: state.delegatorCount,
      averageDelegation: state.delegatorCount > 0
        ? state.totalDelegated / BigInt(state.delegatorCount)
        : 0n,
      apr,
      commission: fullConfig.commissionBps / 100,
      rewardsDistributed24h: state.claimedRewards, // Simplified
    }
  }

  // Simulate adding a delegator (in production, this would be triggered by contract events)
  function addDelegator(address: Address, amount: bigint): void {
    const existing = delegators.get(address)
    if (existing) {
      existing.amount += amount
    } else {
      delegators.set(address, {
        address,
        amount,
        delegatedAt: Date.now(),
        pendingRewards: 0n,
        claimedRewards: 0n,
      })
      state.delegatorCount++
    }
    state.totalDelegated += amount
    state.totalStake = state.selfStake + state.totalDelegated
  }

  // Simulate removing a delegator
  function removeDelegator(address: Address): bigint {
    const delegator = delegators.get(address)
    if (!delegator) return 0n

    const amount = delegator.amount
    delegators.delete(address)
    state.delegatorCount--
    state.totalDelegated -= amount
    state.totalStake = state.selfStake + state.totalDelegated

    return amount
  }

  return {
    get config() {
      return fullConfig
    },
    get state() {
      return state
    },
    setCommission,
    addSelfStake,
    withdrawSelfStake,
    setAcceptingDelegations,
    getDelegators,
    getDelegator,
    getTotalDelegated,
    distributeRewards,
    claimOperatorRewards,
    getPendingRewards,
    getEstimatedAPR,
    getStakingMetrics,
  }
}

export function getDefaultStakingConfig(): Partial<StakingConfig> {
  return {
    commissionBps: 2000, // 20%
    minDelegation: 100n * 10n ** 18n,
    acceptingDelegations: true,
  }
}

