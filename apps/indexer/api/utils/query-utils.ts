/**
 * Query building utilities
 * Shared utilities for building SQLit queries
 */

import {
  type ContainerImage,
  type Contract,
  type CrossServiceRequest,
  count,
  find,
  type OracleDispute,
  type OracleFeed,
  type OracleOperator,
  type OracleReport,
  type TokenTransfer,
} from '../db'

export interface ContractsQueryOptions {
  type?: string
  name?: string
  limit: number
  offset: number
}

export async function buildContractsQuery(
  options: ContractsQueryOptions,
): Promise<{ contracts: Contract[]; total: number }> {
  if (typeof options.limit !== 'number' || options.limit <= 0) {
    throw new Error(
      `Invalid limit: ${options.limit}. Must be a positive number.`,
    )
  }
  if (typeof options.offset !== 'number' || options.offset < 0) {
    throw new Error(
      `Invalid offset: ${options.offset}. Must be a non-negative number.`,
    )
  }

  const where: Record<string, string | number | boolean | null> = {}
  if (options.type) {
    where.contractType = options.type
  }

  const contracts = await find<Contract>('Contract', {
    where,
    order: { createdAt: 'DESC' },
    take: options.limit,
    skip: options.offset,
  })

  const total = await count('Contract', where)

  return { contracts, total }
}

export interface TokenTransfersQueryOptions {
  token?: string
  from?: string
  to?: string
  transactionHash?: string
  limit: number
  offset: number
}

export async function buildTokenTransfersQuery(
  options: TokenTransfersQueryOptions,
): Promise<{ transfers: TokenTransfer[]; total: number }> {
  if (typeof options.limit !== 'number' || options.limit <= 0) {
    throw new Error(
      `Invalid limit: ${options.limit}. Must be a positive number.`,
    )
  }
  if (typeof options.offset !== 'number' || options.offset < 0) {
    throw new Error(
      `Invalid offset: ${options.offset}. Must be a non-negative number.`,
    )
  }

  const where: Record<string, string | number | boolean | null> = {}
  if (options.token) {
    where.tokenAddress = options.token.toLowerCase()
  }
  if (options.from) {
    where.fromAddress = options.from.toLowerCase()
  }
  if (options.to) {
    where.toAddress = options.to.toLowerCase()
  }
  if (options.transactionHash) {
    where.transactionHash = options.transactionHash
  }

  const transfers = await find<TokenTransfer>('TokenTransfer', {
    where,
    order: { timestamp: 'DESC' },
    take: options.limit,
    skip: options.offset,
  })

  const total = await count('TokenTransfer', where)

  return { transfers, total }
}

export interface OracleFeedsQueryOptions {
  isActive?: boolean
  category?: string
  limit: number
  offset: number
}

export async function buildOracleFeedsQuery(
  options: OracleFeedsQueryOptions,
): Promise<{ feeds: OracleFeed[]; total: number }> {
  if (typeof options.limit !== 'number' || options.limit <= 0) {
    throw new Error(
      `Invalid limit: ${options.limit}. Must be a positive number.`,
    )
  }
  if (typeof options.offset !== 'number' || options.offset < 0) {
    throw new Error(
      `Invalid offset: ${options.offset}. Must be a non-negative number.`,
    )
  }

  const where: Record<string, string | number | boolean | null> = {}
  if (options.isActive !== undefined) {
    where.isActive = options.isActive
  }
  if (options.category) {
    where.category = options.category
  }

  const feeds = await find<OracleFeed>('OracleFeed', {
    where,
    order: { totalReports: 'DESC' },
    take: options.limit,
    skip: options.offset,
  })

  const total = await count('OracleFeed', where)

  return { feeds, total }
}

export interface OracleOperatorsQueryOptions {
  isActive?: boolean
  isJailed?: boolean
  limit: number
  offset: number
}

export async function buildOracleOperatorsQuery(
  options: OracleOperatorsQueryOptions,
): Promise<{ operators: OracleOperator[]; total: number }> {
  if (typeof options.limit !== 'number' || options.limit <= 0) {
    throw new Error(
      `Invalid limit: ${options.limit}. Must be a positive number.`,
    )
  }
  if (typeof options.offset !== 'number' || options.offset < 0) {
    throw new Error(
      `Invalid offset: ${options.offset}. Must be a non-negative number.`,
    )
  }

  const where: Record<string, string | number | boolean | null> = {}
  if (options.isActive !== undefined) {
    where.isActive = options.isActive
  }
  if (options.isJailed !== undefined) {
    where.isJailed = options.isJailed
  }

  const operators = await find<OracleOperator>('OracleOperator', {
    where,
    order: { stakedAmount: 'DESC' },
    take: options.limit,
    skip: options.offset,
  })

  const total = await count('OracleOperator', where)

  return { operators, total }
}

export interface OracleReportsQueryOptions {
  feedId?: string
  operatorAddress?: string
  isDisputed?: boolean
  limit: number
  offset: number
}

export async function buildOracleReportsQuery(
  options: OracleReportsQueryOptions,
): Promise<{ reports: OracleReport[]; total: number }> {
  if (typeof options.limit !== 'number' || options.limit <= 0) {
    throw new Error(
      `Invalid limit: ${options.limit}. Must be a positive number.`,
    )
  }
  if (typeof options.offset !== 'number' || options.offset < 0) {
    throw new Error(
      `Invalid offset: ${options.offset}. Must be a non-negative number.`,
    )
  }

  const where: Record<string, string | number | boolean | null> = {}
  if (options.feedId) {
    where.feedId = options.feedId
  }
  if (options.operatorAddress) {
    where.operatorId = options.operatorAddress.toLowerCase()
  }
  if (options.isDisputed !== undefined) {
    where.isDisputed = options.isDisputed
  }

  const reports = await find<OracleReport>('OracleReport', {
    where,
    order: { timestamp: 'DESC' },
    take: options.limit,
    skip: options.offset,
  })

  const total = await count('OracleReport', where)

  return { reports, total }
}

export interface OracleDisputesQueryOptions {
  status?: string
  feedId?: string
  reporter?: string
  challenger?: string
  limit: number
  offset: number
}

export async function buildOracleDisputesQuery(
  options: OracleDisputesQueryOptions,
): Promise<{ disputes: OracleDispute[]; total: number }> {
  if (typeof options.limit !== 'number' || options.limit <= 0) {
    throw new Error(
      `Invalid limit: ${options.limit}. Must be a positive number.`,
    )
  }
  if (typeof options.offset !== 'number' || options.offset < 0) {
    throw new Error(
      `Invalid offset: ${options.offset}. Must be a non-negative number.`,
    )
  }

  const where: Record<string, string | number | boolean | null> = {}
  if (options.status) {
    where.status = options.status
  }
  if (options.feedId) {
    where.feedId = options.feedId
  }
  if (options.reporter) {
    where.reporterId = options.reporter.toLowerCase()
  }
  if (options.challenger) {
    where.challengerId = options.challenger.toLowerCase()
  }

  const disputes = await find<OracleDispute>('OracleDispute', {
    where,
    order: { createdAt: 'DESC' },
    take: options.limit,
    skip: options.offset,
  })

  const total = await count('OracleDispute', where)

  return { disputes, total }
}

export interface ContainersQueryOptions {
  verified?: boolean
  gpu?: boolean
  tee?: boolean
  limit: number
  offset: number
}

export async function buildContainersQuery(
  options: ContainersQueryOptions,
): Promise<{ containers: ContainerImage[]; total: number }> {
  if (typeof options.limit !== 'number' || options.limit <= 0) {
    throw new Error(
      `Invalid limit: ${options.limit}. Must be a positive number.`,
    )
  }
  if (typeof options.offset !== 'number' || options.offset < 0) {
    throw new Error(
      `Invalid offset: ${options.offset}. Must be a non-negative number.`,
    )
  }

  const where: Record<string, string | number | boolean | null> = {}
  if (options.verified !== undefined) {
    where.verified = options.verified
  }

  const containers = await find<ContainerImage>('ContainerImage', {
    where,
    order: { pullCount: 'DESC' },
    take: options.limit,
    skip: options.offset,
  })

  const total = await count('ContainerImage', where)

  return { containers, total }
}

export interface CrossServiceRequestsQueryOptions {
  status?: string
  type?: string
  agentId?: string
  limit: number
  offset: number
}

export async function buildCrossServiceRequestsQuery(
  options: CrossServiceRequestsQueryOptions,
): Promise<{ requests: CrossServiceRequest[]; total: number }> {
  if (typeof options.limit !== 'number' || options.limit <= 0) {
    throw new Error(
      `Invalid limit: ${options.limit}. Must be a positive number.`,
    )
  }
  if (typeof options.offset !== 'number' || options.offset < 0) {
    throw new Error(
      `Invalid offset: ${options.offset}. Must be a non-negative number.`,
    )
  }

  const where: Record<string, string | number | boolean | null> = {}
  if (options.status) {
    where.status = options.status
  }
  if (options.type) {
    where.requestType = options.type
  }
  if (options.agentId) {
    where.agentId = options.agentId
  }

  const requests = await find<CrossServiceRequest>('CrossServiceRequest', {
    where,
    order: { createdAt: 'DESC' },
    take: options.limit,
    skip: options.offset,
  })

  const total = await count('CrossServiceRequest', where)

  return { requests, total }
}
