/**
 * Database Types for Indexer
 *
 * Plain TypeScript interfaces for database records.
 * These replace TypeORM entity classes for SQLit queries.
 */

// Enum types (for filtering/querying)

export const ComputeRentalStatus = {
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const
export type ComputeRentalStatus =
  (typeof ComputeRentalStatus)[keyof typeof ComputeRentalStatus]

export const StorageDealStatus = {
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const
export type StorageDealStatus =
  (typeof StorageDealStatus)[keyof typeof StorageDealStatus]

export const CrossServiceRequestStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const
export type CrossServiceRequestStatus =
  (typeof CrossServiceRequestStatus)[keyof typeof CrossServiceRequestStatus]

export const OracleDisputeStatus = {
  OPEN: 'open',
  RESOLVED: 'resolved',
  REJECTED: 'rejected',
} as const
export type OracleDisputeStatus =
  (typeof OracleDisputeStatus)[keyof typeof OracleDisputeStatus]

export const TokenStandard = {
  ERC20: 'ERC20',
  ERC721: 'ERC721',
  ERC1155: 'ERC1155',
} as const
export type TokenStandard = (typeof TokenStandard)[keyof typeof TokenStandard]

export const TransactionStatus = {
  SUCCESS: 'success',
  FAILED: 'failed',
  PENDING: 'pending',
} as const
export type TransactionStatus =
  (typeof TransactionStatus)[keyof typeof TransactionStatus]

export const ContractType = {
  ERC20: 'ERC20',
  ERC721: 'ERC721',
  ERC1155: 'ERC1155',
  PROXY: 'proxy',
  OTHER: 'other',
} as const
export type ContractType = (typeof ContractType)[keyof typeof ContractType]

// Core blockchain types

export interface Block {
  id: string
  number: number
  hash: string
  parentHash: string
  timestamp: string
  transactionCount: number
  gasUsed: string
  gasLimit: string
  baseFeePerGas: string | null
  size: number
  minerId: string | null
}

export interface Account {
  id: string
  address: string
  balance: string
  transactionCount: number
  isContract: boolean
  totalValueSent: string
  totalValueReceived: string
  labels: string | string[] | null // JSON array or already parsed
  firstSeenAt: string | null
  lastSeenAt: string | null
  firstSeenBlock: number
  lastSeenBlock: number
  createdAt: string | null
}

export interface Transaction {
  id: string
  hash: string
  fromAddress: string | null
  toAddress: string | null
  blockNumber: number
  transactionIndex: number
  value: string
  gasPrice: string | null
  gasLimit: string
  gasUsed: string | null
  input: string | null
  nonce: number
  status: 'success' | 'failed' | 'pending'
  type: number | null
  maxFeePerGas: string | null
  maxPriorityFeePerGas: string | null
  timestamp: string | null
}

export interface Contract {
  id: string
  address: string
  creatorAddress: string | null
  creationTxId: string | null
  creationBlock: number | null
  bytecode: string | null
  contractType: string | null
  name: string | null
  symbol: string | null
  decimals: number | null
  isERC20: boolean
  isERC721: boolean
  isERC1155: boolean
  verified: boolean
  isProxy: boolean
  implementationAddress: string | null
  createdAt: string
}

export interface Log {
  id: string
  logIndex: number
  transactionId: string | null
  blockId: string | null
  blockNumber: number
  address: string
  topic0: string | null
  topic1: string | null
  topic2: string | null
  topic3: string | null
  data: string | null
}

export interface DecodedEvent {
  id: string
  logId: string
  name: string
  signature: string
  contractType: string | null
  args: string | null
}

export interface Trace {
  id: string
  transactionId: string | null
  blockNumber: number
  traceAddress: string
  traceType: string
  fromAddress: string | null
  toAddress: string | null
  value: string | null
  gas: string | null
  gasUsed: string | null
  input: string | null
  output: string | null
  error: string | null
  revertReason: string | null
}

// Token types

export interface Token {
  id: string
  address: string
  name: string | null
  symbol: string | null
  decimals: number | null
  totalSupply: string | null
  tokenStandard: 'ERC20' | 'ERC721' | 'ERC1155'
  holderCount: number
  transferCount: number
}

export interface TokenTransfer {
  id: string
  transactionHash: string | null
  blockNumber: number
  timestamp: string
  tokenAddress: string
  fromAddress: string | null
  toAddress: string | null
  value: string | null
  tokenId: string | null
  tokenStandard: string
}

export interface TokenBalance {
  id: string
  accountId: string
  tokenAddress: string
  balance: string
  tokenStandard: string
  tokenId: string | null
  lastUpdatedBlock: number
}

// Agent registry types

export interface RegisteredAgent {
  id: string
  agentId: number
  ownerAddress: string | null
  name: string | null
  description: string | null
  endpoint: string | null
  a2aEndpoint: string | null
  mcpEndpoint: string | null
  metadataUri: string | null
  metadata: string | null
  tags: string | string[] | null // JSON array or already parsed
  mcpTools: string | string[] | null // JSON array or already parsed
  a2aSkills: string | string[] | null // JSON array or already parsed
  category: string | null
  serviceType: string | null
  active: boolean
  stakeAmount: string
  stakeTier: number
  x402Support: boolean
  reputationScore: number
  totalReports: number
  successfulReports: number
  lastUpdatedBlock: number | null
  registeredAt: string | null
  isBanned: boolean
  banReason: string | null
}

export interface TagIndex {
  id: string
  tag: string
  agentCount: number
  lastUpdated: string | null
}

// Infrastructure types

export interface NodeStake {
  id: string
  nodeAddress: string
  operatorId: string | null
  stakeAmount: string
  isActive: boolean
  joinedAt: string | null
  lastPerformanceUpdate: string | null
  uptimeScore: number
  responseTimeMs: number | null
  totalRewards: string
}

export interface ComputeProvider {
  id: string
  providerAddress: string
  agentId: number | null
  stakeAmount: string | null
  totalEarnings: string | null
  isActive: boolean
  cpuCores: number | null
  memoryGb: number | null
  gpuCount: number | null
  gpuModel: string | null
  region: string | null
  registeredAt: string | null
}

export interface StorageProvider {
  id: string
  providerAddress: string
  agentId: number | null
  stakeAmount: string | null
  totalCapacityGb: string | null
  usedCapacityGb: string | null
  isActive: boolean
  providerType: string | null
  tier: string | null
  region: string | null
  registeredAt: string | null
}

export interface ComputeRental {
  id: string
  rentalId: string
  providerId: string | null
  renterId: string | null
  resourceType: string | null
  cpuCores: number | null
  memoryGb: number | null
  gpuCount: number | null
  pricePerHour: string | null
  status: 'pending' | 'active' | 'completed' | 'cancelled'
  startedAt: string | null
  endedAt: string | null
  totalCost: string | null
}

export interface StorageDeal {
  id: string
  dealId: string
  providerId: string | null
  clientId: string | null
  cid: string | null
  sizeBytes: string | null
  pricePerGb: string | null
  durationDays: number | null
  status: 'pending' | 'active' | 'completed' | 'expired' | 'cancelled'
  startedAt: string | null
  endedAt: string | null
  totalCost: string | null
}

export interface ContainerImage {
  id: string
  cid: string
  name: string | null
  description: string | null
  ownerId: string | null
  verified: boolean
  architecture: string | null
  sizeBytes: string | null
  createdAt: string | null
  pullCount: number
}

export interface CrossServiceRequest {
  id: string
  requestId: string
  agentId: string | null
  requesterId: string | null
  providerId: string | null
  requestType: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  computeCid: string | null
  storageCid: string | null
  createdAt: string
  completedAt: string | null
  error: string | null
}

// Oracle types

export interface OracleFeed {
  id: string
  feedId: string
  name: string | null
  description: string | null
  category: string | null
  isActive: boolean
  heartbeatInterval: number | null
  deviationThreshold: string | null
  latestValue: string | null
  latestTimestamp: string | null
  totalReports: number
  createdAt: string
  updatedAt: string
}

export interface OracleOperator {
  id: string
  operatorAddress: string
  name: string | null
  isActive: boolean
  isJailed: boolean
  stakedAmount: string
  totalEarnings: string
  participationScore: number
  accuracyScore: number
  totalReports: number
  createdAt: string
  registeredAt: string | null
}

export interface OracleReport {
  id: string
  feedId: string
  operatorId: string
  value: string
  timestamp: string
  blockNumber: number
  transactionHash: string | null
  isDisputed: boolean
}

export interface OracleDispute {
  id: string
  disputeId: string
  feedId: string
  reportId: string
  reporterId: string
  challengerId: string | null
  status: 'open' | 'resolved' | 'rejected'
  outcome: string | null
  createdAt: string
  resolvedAt: string | null
  reason: string | null
}

export interface OracleSubscription {
  id: string
  subscriberId: string | null
  feedId: string | null
  isActive: boolean
  createdAt: string | null
  expiresAt: string | null
}

// JNS types

export interface JnsName {
  id: string
  name: string
  ownerId: string | null
  resolver: string | null
  expiresAt: string | null
  registeredAt: string | null
  registrationBlock: number | null
}

// Stats types

export interface MarketplaceStats {
  id: string
  date: string
  totalComputeProviders: number
  activeComputeProviders: number
  totalStorageProviders: number
  activeStorageProviders: number
  totalRentals: number
  totalDeals: number
  totalAgents: number
}
