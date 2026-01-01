/**
 * Response mapping utilities
 * Shared utilities for mapping database entities to API responses
 * SQLit stores dates as ISO strings, BigInts as strings
 */

import type {
  Account,
  Contract,
  CrossServiceRequest,
  OracleDispute,
  OracleFeed,
  OracleOperator,
  OracleReport,
  TokenTransfer,
} from '../db'

export interface AccountResponse {
  address: string
  isContract: boolean
  transactionCount: number
  totalValueSent: string
  totalValueReceived: string
  firstSeenBlock: number
  lastSeenBlock: number
  labels: string[]
}

export function mapAccountResponse(account: Account): AccountResponse {
  if (!account) {
    throw new Error('Account is required')
  }

  // Parse labels if stored as JSON string
  let labels: string[] = []
  if (typeof account.labels === 'string') {
    try {
      labels = JSON.parse(account.labels)
    } catch {
      labels = []
    }
  } else if (Array.isArray(account.labels)) {
    labels = account.labels
  }

  return {
    address: account.address,
    isContract: account.isContract,
    transactionCount: account.transactionCount,
    totalValueSent: account.totalValueSent,
    totalValueReceived: account.totalValueReceived,
    firstSeenBlock: account.firstSeenBlock,
    lastSeenBlock: account.lastSeenBlock,
    labels,
  }
}

export interface ContractResponse {
  address: string
  contractType: string | null
  isERC20: boolean
  isERC721: boolean
  isERC1155: boolean
  creator: string | null
  createdAt: string
}

export function mapContractResponse(contract: Contract): ContractResponse {
  if (!contract) {
    throw new Error('Contract is required')
  }
  return {
    address: contract.address,
    contractType: contract.contractType ?? null,
    isERC20: contract.isERC20,
    isERC721: contract.isERC721,
    isERC1155: contract.isERC1155,
    creator: contract.creatorAddress ?? null,
    createdAt: contract.createdAt,
  }
}

export interface TokenTransferResponse {
  id: string
  token: string | null
  from: string | null
  to: string | null
  value: string | null
  tokenId: string | null
  tokenStandard: string
  timestamp: string
}

export function mapTokenTransferResponse(
  transfer: TokenTransfer,
): TokenTransferResponse {
  if (!transfer) {
    throw new Error('TokenTransfer is required')
  }
  return {
    id: transfer.id,
    token: transfer.tokenAddress ?? null,
    from: transfer.fromAddress ?? null,
    to: transfer.toAddress ?? null,
    value: transfer.value ?? null,
    tokenId: transfer.tokenId ?? null,
    tokenStandard: transfer.tokenStandard,
    timestamp: transfer.timestamp,
  }
}

export interface OracleFeedResponse {
  feedId: string
  name: string
  description: string | null
  category: string
  isActive: boolean
  totalReports: number
  createdAt: string
  updatedAt: string
}

export function mapOracleFeedResponse(feed: OracleFeed): OracleFeedResponse {
  if (!feed) {
    throw new Error('OracleFeed is required')
  }
  return {
    feedId: feed.feedId,
    name: feed.name ?? '',
    description: feed.description ?? null,
    category: feed.category ?? 'general',
    isActive: feed.isActive,
    totalReports: feed.totalReports,
    createdAt: feed.createdAt,
    updatedAt: feed.updatedAt,
  }
}

export interface OracleOperatorResponse {
  id: string
  operatorAddress: string
  isActive: boolean
  isJailed: boolean
  stakedAmount: string
  totalEarnings: string
  participationScore: number
  accuracyScore: number
  createdAt: string
}

export function mapOracleOperatorResponse(
  operator: OracleOperator,
): OracleOperatorResponse {
  if (!operator) {
    throw new Error('OracleOperator is required')
  }
  return {
    id: operator.id,
    operatorAddress: operator.operatorAddress,
    isActive: operator.isActive,
    isJailed: operator.isJailed,
    stakedAmount: operator.stakedAmount,
    totalEarnings: operator.totalEarnings,
    participationScore: operator.participationScore,
    accuracyScore: operator.accuracyScore,
    createdAt: operator.createdAt,
  }
}

export interface OracleReportResponse {
  id: string
  feedId: string
  operatorId: string
  value: string
  timestamp: string
  isDisputed: boolean
  transactionHash: string | null
}

export function mapOracleReportResponse(
  report: OracleReport,
): OracleReportResponse {
  if (!report) {
    throw new Error('OracleReport is required')
  }
  return {
    id: report.id,
    feedId: report.feedId,
    operatorId: report.operatorId,
    value: report.value,
    timestamp: report.timestamp,
    isDisputed: report.isDisputed,
    transactionHash: report.transactionHash ?? null,
  }
}

export interface OracleDisputeResponse {
  id: string
  feedId: string
  reportId: string
  reporterId: string
  challengerId: string | null
  status: string
  createdAt: string
  resolvedAt: string | null
}

export function mapOracleDisputeResponse(
  dispute: OracleDispute,
): OracleDisputeResponse {
  if (!dispute) {
    throw new Error('OracleDispute is required')
  }
  return {
    id: dispute.id,
    feedId: dispute.feedId,
    reportId: dispute.reportId,
    reporterId: dispute.reporterId,
    challengerId: dispute.challengerId ?? null,
    status: dispute.status,
    createdAt: dispute.createdAt,
    resolvedAt: dispute.resolvedAt ?? null,
  }
}

export interface CrossServiceRequestResponse {
  id: string
  agentId: string | null
  requestType: string
  status: string
  createdAt: string
  completedAt: string | null
}

export function mapCrossServiceRequestResponse(
  request: CrossServiceRequest,
): CrossServiceRequestResponse {
  if (!request) {
    throw new Error('CrossServiceRequest is required')
  }
  return {
    id: request.id,
    agentId: request.agentId ?? null,
    requestType: request.requestType,
    status: request.status,
    createdAt: request.createdAt,
    completedAt: request.completedAt ?? null,
  }
}
