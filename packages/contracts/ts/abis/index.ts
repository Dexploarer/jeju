/**
 * @fileoverview Contract ABI exports
 * @module @jejunetwork/contracts/abis
 *
 * TYPED ABIs (camelCase) - Import directly from @jejunetwork/contracts (which exports from generated.ts)
 * DEPRECATED ABIs (PascalCase) - Import directly from @jejunetwork/contracts
 *
 * Always use typed ABIs (camelCase):
 * ```typescript
 * import { identityRegistryAbi } from '@jejunetwork/contracts'
 * ```
 */

// Import ABIs from generated for PascalCase aliases
import {
  banManagerAbi,
  identityRegistryAbi,
  moderationMarketplaceAbi,
  reputationRegistryAbi,
} from '../generated'

// ============================================================================
// PascalCase aliases for backward compatibility
// ============================================================================
export const BanManagerAbi = banManagerAbi
export const IdentityRegistryAbi = identityRegistryAbi
export const ModerationMarketplaceAbi = moderationMarketplaceAbi
export const ReputationRegistryAbi = reputationRegistryAbi

// ============================================================================
// TYPED ABI FRAGMENTS - Common patterns with full type inference
// ============================================================================

/** Standard ERC20 read functions with full type inference */
export const ERC20ReadAbi = [
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalSupply',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

/** Standard ERC20 write functions with full type inference */
export const ERC20WriteAbi = [
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferFrom',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const

// ============================================================================
// Multi-Chain RPC Registry ABI
// ============================================================================

export const MultiChainRPCRegistryAbi = [
  {
    type: 'function',
    name: 'registerNode',
    inputs: [{ name: 'region', type: 'string' }],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'registerNodeWithAgent',
    inputs: [
      { name: 'region', type: 'string' },
      { name: 'agentId', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'addChainEndpoint',
    inputs: [
      { name: 'chainId', type: 'uint64' },
      { name: 'endpoint', type: 'string' },
      { name: 'isArchive', type: 'bool' },
      { name: 'isWebSocket', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'removeChainEndpoint',
    inputs: [{ name: 'chainId', type: 'uint64' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'heartbeat',
    inputs: [
      { name: 'chainId', type: 'uint64' },
      { name: 'blockHeight', type: 'uint64' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getNode',
    inputs: [{ name: 'node', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'operator', type: 'address' },
          { name: 'region', type: 'string' },
          { name: 'stake', type: 'uint256' },
          { name: 'jejuStake', type: 'uint256' },
          { name: 'registeredAt', type: 'uint256' },
          { name: 'agentId', type: 'uint256' },
          { name: 'isActive', type: 'bool' },
          { name: 'isFrozen', type: 'bool' },
          { name: 'totalRequests', type: 'uint256' },
          { name: 'totalComputeUnits', type: 'uint256' },
          { name: 'totalErrors', type: 'uint256' },
          { name: 'lastSeen', type: 'uint64' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getProvidersForChain',
    inputs: [{ name: 'chainId', type: 'uint64' }],
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getQualifiedProviders',
    inputs: [
      { name: 'chainId', type: 'uint64' },
      { name: 'minUptime', type: 'uint256' },
      { name: 'requireArchive', type: 'bool' },
      { name: 'maxCount', type: 'uint16' },
    ],
    outputs: [
      { name: 'providers', type: 'address[]' },
      { name: 'scores', type: 'uint256[]' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getChainEndpoint',
    inputs: [
      { name: 'node', type: 'address' },
      { name: 'chainId', type: 'uint64' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'chainId', type: 'uint64' },
          { name: 'endpoint', type: 'string' },
          { name: 'isActive', type: 'bool' },
          { name: 'isArchive', type: 'bool' },
          { name: 'isWebSocket', type: 'bool' },
          { name: 'blockHeight', type: 'uint64' },
          { name: 'lastUpdated', type: 'uint64' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getSupportedChains',
    inputs: [],
    outputs: [{ name: '', type: 'uint64[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nodePerformance',
    inputs: [{ name: 'node', type: 'address' }],
    outputs: [
      { name: 'uptimeScore', type: 'uint256' },
      { name: 'successRate', type: 'uint256' },
      { name: 'avgLatencyMs', type: 'uint256' },
      { name: 'lastUpdated', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'reportUsage',
    inputs: [
      { name: 'node', type: 'address' },
      { name: 'requests', type: 'uint256' },
      { name: 'computeUnits', type: 'uint256' },
      { name: 'errors', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'reportPerformance',
    inputs: [
      { name: 'node', type: 'address' },
      { name: 'uptimeScore', type: 'uint256' },
      { name: 'successRate', type: 'uint256' },
      { name: 'avgLatencyMs', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'NodeRegistered',
    inputs: [
      { name: 'node', type: 'address', indexed: true },
      { name: 'region', type: 'string', indexed: false },
      { name: 'stake', type: 'uint256', indexed: false },
      { name: 'agentId', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ChainEndpointAdded',
    inputs: [
      { name: 'node', type: 'address', indexed: true },
      { name: 'chainId', type: 'uint64', indexed: true },
      { name: 'endpoint', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'UsageReported',
    inputs: [
      { name: 'node', type: 'address', indexed: true },
      { name: 'requests', type: 'uint256', indexed: false },
      { name: 'computeUnits', type: 'uint256', indexed: false },
      { name: 'errors', type: 'uint256', indexed: false },
    ],
  },
] as const

// ============================================================================
// Bandwidth Rewards ABI
// ============================================================================

export const BandwidthRewardsAbi = [
  {
    type: 'function',
    name: 'registerNode',
    inputs: [
      { name: 'nodeType', type: 'uint8' },
      { name: 'region', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'registerNodeWithAgent',
    inputs: [
      { name: 'nodeType', type: 'uint8' },
      { name: 'region', type: 'string' },
      { name: 'agentId', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'deactivateNode',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimRewards',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getNode',
    inputs: [{ name: 'node', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'operator', type: 'address' },
          { name: 'stake', type: 'uint256' },
          { name: 'registeredAt', type: 'uint256' },
          { name: 'agentId', type: 'uint256' },
          { name: 'nodeType', type: 'uint8' },
          { name: 'region', type: 'string' },
          { name: 'isActive', type: 'bool' },
          { name: 'isFrozen', type: 'bool' },
          { name: 'totalBytesShared', type: 'uint256' },
          { name: 'totalSessions', type: 'uint256' },
          { name: 'totalEarnings', type: 'uint256' },
          { name: 'lastClaimTime', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nodePerformance',
    inputs: [{ name: 'node', type: 'address' }],
    outputs: [
      { name: 'uptimeScore', type: 'uint256' },
      { name: 'successRate', type: 'uint256' },
      { name: 'avgLatencyMs', type: 'uint256' },
      { name: 'avgBandwidthMbps', type: 'uint256' },
      { name: 'lastUpdated', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPendingReward',
    inputs: [{ name: 'node', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'bytesContributed', type: 'uint256' },
          { name: 'sessionsHandled', type: 'uint256' },
          { name: 'periodStart', type: 'uint256' },
          { name: 'periodEnd', type: 'uint256' },
          { name: 'calculatedReward', type: 'uint256' },
          { name: 'claimed', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getEstimatedReward',
    inputs: [{ name: 'node', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getActiveNodes',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getNodesByType',
    inputs: [{ name: 'nodeType', type: 'uint8' }],
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'reportBandwidth',
    inputs: [
      { name: 'node', type: 'address' },
      { name: 'bytesShared', type: 'uint256' },
      { name: 'sessionsHandled', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'reportPerformance',
    inputs: [
      { name: 'node', type: 'address' },
      { name: 'uptimeScore', type: 'uint256' },
      { name: 'successRate', type: 'uint256' },
      { name: 'avgLatencyMs', type: 'uint256' },
      { name: 'avgBandwidthMbps', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'config',
    inputs: [],
    outputs: [
      { name: 'baseRatePerGb', type: 'uint256' },
      { name: 'residentialMultiplier', type: 'uint256' },
      { name: 'mobileMultiplier', type: 'uint256' },
      { name: 'qualityBonusCap', type: 'uint256' },
      { name: 'minClaimPeriod', type: 'uint256' },
      { name: 'minBytesForClaim', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'NodeRegistered',
    inputs: [
      { name: 'node', type: 'address', indexed: true },
      { name: 'nodeType', type: 'uint8', indexed: false },
      { name: 'region', type: 'string', indexed: false },
      { name: 'stake', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'BandwidthReported',
    inputs: [
      { name: 'node', type: 'address', indexed: true },
      { name: 'bytes_', type: 'uint256', indexed: false },
      { name: 'sessions', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'RewardsClaimed',
    inputs: [
      { name: 'node', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'bytes_', type: 'uint256', indexed: false },
    ],
  },
] as const

// ============================================================================
// Usage Reward Distributor ABI
// ============================================================================

export const UsageRewardDistributorAbi = [
  {
    type: 'function',
    name: 'recordUsage',
    inputs: [
      { name: 'serviceType', type: 'uint8' },
      { name: 'provider', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'reputationScore', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'batchRecordUsage',
    inputs: [
      { name: 'serviceType', type: 'uint8' },
      { name: 'providers', type: 'address[]' },
      { name: 'amounts', type: 'uint256[]' },
      { name: 'reputationScores', type: 'uint256[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimRewards',
    inputs: [{ name: 'serviceType', type: 'uint8' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getPendingRewards',
    inputs: [
      { name: 'serviceType', type: 'uint8' },
      { name: 'provider', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getProviderStats',
    inputs: [
      { name: 'serviceType', type: 'uint8' },
      { name: 'provider', type: 'address' },
    ],
    outputs: [
      { name: 'totalClaimed', type: 'uint256' },
      { name: 'pendingRewards', type: 'uint256' },
      { name: 'lastClaimTime', type: 'uint256' },
      { name: 'lastUsageRecorded', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'startEpoch',
    inputs: [
      { name: 'serviceType', type: 'uint8' },
      { name: 'rewardPool', type: 'uint256' },
      { name: 'duration', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'finalizeEpoch',
    inputs: [
      { name: 'serviceType', type: 'uint8' },
      { name: 'epoch', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'currentEpoch',
    inputs: [{ name: 'serviceType', type: 'uint8' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'UsageRecorded',
    inputs: [
      { name: 'serviceType', type: 'uint8', indexed: true },
      { name: 'provider', type: 'address', indexed: true },
      { name: 'epoch', type: 'uint256', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'reputation', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'RewardsClaimed',
    inputs: [
      { name: 'serviceType', type: 'uint8', indexed: true },
      { name: 'provider', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const
