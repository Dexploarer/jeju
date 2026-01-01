/**
 * Mappers for database entities to API responses
 * SQLit stores dates as ISO strings, so no .toISOString() calls needed
 */

import type {
  Block,
  ComputeProvider,
  RegisteredAgent,
  StorageProvider,
  Transaction,
} from '../db'

export function mapAgentSummary(agent: RegisteredAgent) {
  if (!agent) {
    throw new Error('Agent is required')
  }
  if (agent.agentId === undefined || agent.agentId === null) {
    throw new Error('Agent agentId is required')
  }
  if (!agent.registeredAt) {
    throw new Error('Agent registeredAt is required')
  }

  // Parse tags if stored as JSON string
  let tags: string[] = []
  if (typeof agent.tags === 'string') {
    try {
      tags = JSON.parse(agent.tags)
    } catch {
      tags = []
    }
  } else if (Array.isArray(agent.tags)) {
    tags = agent.tags
  }

  return {
    agentId: agent.agentId.toString(),
    name: agent.name,
    description: agent.description,
    tags,
    stakeTier: agent.stakeTier,
    stakeAmount: agent.stakeAmount,
    active: agent.active,
    isBanned: agent.isBanned,
    a2aEndpoint: agent.a2aEndpoint,
    mcpEndpoint: agent.mcpEndpoint,
    registeredAt: agent.registeredAt,
  }
}

export function mapAgentWithSkills(agent: RegisteredAgent) {
  let skills: string[] = []
  if (typeof agent.a2aSkills === 'string') {
    try {
      skills = JSON.parse(agent.a2aSkills)
    } catch {
      skills = []
    }
  } else if (Array.isArray(agent.a2aSkills)) {
    skills = agent.a2aSkills
  }

  return {
    agentId: agent.agentId.toString(),
    name: agent.name,
    a2aEndpoint: agent.a2aEndpoint,
    skills,
    stakeTier: agent.stakeTier,
  }
}

export function mapAgentWithTools(agent: RegisteredAgent) {
  let tools: string[] = []
  if (typeof agent.mcpTools === 'string') {
    try {
      tools = JSON.parse(agent.mcpTools)
    } catch {
      tools = []
    }
  } else if (Array.isArray(agent.mcpTools)) {
    tools = agent.mcpTools
  }

  return {
    agentId: agent.agentId.toString(),
    name: agent.name,
    mcpEndpoint: agent.mcpEndpoint,
    tools,
    stakeTier: agent.stakeTier,
  }
}

export function mapBlockSummary(block: Block) {
  if (!block) {
    throw new Error('Block is required')
  }
  if (typeof block.number !== 'number' || block.number < 0) {
    throw new Error(`Invalid block number: ${block.number}`)
  }
  if (!block.hash || typeof block.hash !== 'string') {
    throw new Error(`Invalid block hash: ${block.hash}`)
  }
  if (!block.timestamp) {
    throw new Error('Block timestamp is required')
  }

  return {
    number: block.number,
    hash: block.hash,
    timestamp: block.timestamp,
    transactionCount: block.transactionCount,
    gasUsed: block.gasUsed,
  }
}

export function mapBlockDetail(block: Block) {
  if (!block) {
    throw new Error('Block is required')
  }
  if (typeof block.number !== 'number' || block.number < 0) {
    throw new Error(`Invalid block number: ${block.number}`)
  }
  if (!block.hash || typeof block.hash !== 'string') {
    throw new Error(`Invalid block hash: ${block.hash}`)
  }
  if (!block.timestamp) {
    throw new Error('Block timestamp is required')
  }

  return {
    number: block.number,
    hash: block.hash,
    parentHash: block.parentHash,
    timestamp: block.timestamp,
    transactionCount: block.transactionCount,
    gasUsed: block.gasUsed,
    gasLimit: block.gasLimit,
  }
}

export function mapTransactionSummary(tx: Transaction) {
  return {
    hash: tx.hash,
    blockNumber: tx.blockNumber,
    from: tx.fromAddress,
    to: tx.toAddress,
    value: tx.value,
    status: tx.status,
  }
}

export function mapTransactionDetail(tx: Transaction) {
  return {
    hash: tx.hash,
    blockNumber: tx.blockNumber,
    from: tx.fromAddress,
    to: tx.toAddress,
    value: tx.value,
    gasPrice: tx.gasPrice,
    gasUsed: tx.gasUsed,
    status: tx.status,
  }
}

export function mapProviderSummary(
  p: ComputeProvider | StorageProvider,
  type: 'compute' | 'storage',
) {
  if (!p) {
    throw new Error('Provider is required')
  }
  if (type !== 'compute' && type !== 'storage') {
    throw new Error(
      `Invalid provider type: ${type}. Must be 'compute' or 'storage'`,
    )
  }
  if (!p.providerAddress || typeof p.providerAddress !== 'string') {
    throw new Error(`Invalid provider address: ${p.providerAddress}`)
  }

  return {
    address: p.providerAddress,
    agentId: p.agentId,
    isActive: p.isActive,
    stakeAmount: p.stakeAmount,
  }
}
