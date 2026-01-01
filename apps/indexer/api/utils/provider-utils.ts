/**
 * Provider utilities
 * Shared business logic for provider-related operations
 */

import {
  type ComputeProvider,
  type ContainerImage,
  find,
  type StorageProvider,
} from '../db'
import { NotFoundError } from './types'

export interface FullStackProvider {
  agentId: number
  compute: Array<{ address: string; name: string; endpoint: string }>
  storage: Array<{
    address: string
    name: string
    endpoint: string
    providerType: string
  }>
}

/**
 * Get providers that have both compute and storage capabilities
 */
export async function getFullStackProviders(
  limit = 20,
  offset = 0,
): Promise<{ providers: FullStackProvider[]; total: number }> {
  if (typeof limit !== 'number' || limit <= 0 || limit > 100) {
    throw new Error(`Invalid limit: ${limit}. Must be between 1 and 100.`)
  }

  // Find agents that are linked to both compute and storage providers
  const computeWithAgent = await find<ComputeProvider>('ComputeProvider', {
    where: { isActive: true },
  })
  const storageWithAgent = await find<StorageProvider>('StorageProvider', {
    where: { isActive: true },
  })

  // Group by agent ID
  const computeByAgent = new Map<number, ComputeProvider[]>()
  for (const p of computeWithAgent) {
    if (p.agentId) {
      const existing = computeByAgent.get(p.agentId) ?? []
      existing.push(p)
      computeByAgent.set(p.agentId, existing)
    }
  }

  const fullStackProviders: FullStackProvider[] = []

  for (const storage of storageWithAgent) {
    if (storage.agentId && computeByAgent.has(storage.agentId)) {
      const computeProviders = computeByAgent.get(storage.agentId) ?? []

      // Check if we already have this agent
      let existing = fullStackProviders.find(
        (f) => f.agentId === storage.agentId,
      )
      if (!existing) {
        existing = {
          agentId: storage.agentId,
          compute: computeProviders.map((c) => ({
            address: c.providerAddress,
            name: 'Compute Provider',
            endpoint: '',
          })),
          storage: [],
        }
        fullStackProviders.push(existing)
      }

      existing.storage.push({
        address: storage.providerAddress,
        name: 'Storage Provider',
        endpoint: '',
        providerType: 'standard',
      })
    }
  }

  return {
    providers: fullStackProviders.slice(offset, offset + limit),
    total: fullStackProviders.length,
  }
}

export interface ContainerDetail {
  cid: string
  name: string
  tag: string
  sizeBytes: string
  uploadedAt: string
  uploadedBy: string | null
  storageProvider: {
    address: string
    name: string
    endpoint: string
  } | null
  tier: string
  expiresAt: string | null
  architecture: string
  gpuRequired: boolean
  minGpuVram: number | null | undefined
  teeRequired: boolean
  contentHash: string | null
  verified: boolean
  verifiedBy: string | null
  pullCount: number
  lastPulledAt: string | null
}

export interface CompatibleProvider {
  address: string
  name: string
  endpoint: string
  agentId: number | null
  isActive: boolean
}

/**
 * Get container details by CID
 */
export async function getContainerDetail(
  cid: string,
): Promise<ContainerImage | null> {
  if (!cid || cid.trim().length === 0) {
    throw new Error('cid is required and must be a non-empty string')
  }

  const containers = await find<ContainerImage>('ContainerImage', {
    where: { cid },
    take: 1,
  })

  const container = containers[0]
  if (!container) {
    throw new NotFoundError('Container', cid)
  }

  return container
}
