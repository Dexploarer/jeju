/**
 * Provider query utilities
 * Shared utilities for querying providers
 */

import { type ComputeProvider, find, type StorageProvider } from '../db'

export interface ProvidersQueryOptions {
  type?: 'compute' | 'storage'
  limit: number
}

export interface ProviderListResult {
  providers: Array<{
    type: 'compute' | 'storage'
    address: string
    name: string
    endpoint: string
    agentId: number | null
    isActive: boolean
  }>
  total: number
}

/**
 * Get providers from SQLit with optional type filtering
 */
export async function getProviders(
  options: ProvidersQueryOptions,
): Promise<ProviderListResult> {
  if (typeof options.limit !== 'number' || options.limit <= 0) {
    throw new Error(
      `Invalid limit: ${options.limit}. Must be a positive number.`,
    )
  }

  const providers: Array<{
    type: 'compute' | 'storage'
    address: string
    name: string
    endpoint: string
    agentId: number | null
    isActive: boolean
  }> = []

  if (!options.type || options.type === 'compute') {
    const compute = await find<ComputeProvider>('ComputeProvider', {
      where: { isActive: true },
      take: options.limit,
    })
    providers.push(
      ...compute.map((p) => ({
        type: 'compute' as const,
        address: p.providerAddress,
        name: 'Compute Provider',
        endpoint: '',
        agentId: p.agentId ?? null,
        isActive: p.isActive,
      })),
    )
  }

  if (!options.type || options.type === 'storage') {
    const storage = await find<StorageProvider>('StorageProvider', {
      where: { isActive: true },
      take: options.limit,
    })
    providers.push(
      ...storage.map((p) => ({
        type: 'storage' as const,
        address: p.providerAddress,
        name: 'Storage Provider',
        endpoint: '',
        agentId: p.agentId ?? null,
        isActive: p.isActive,
      })),
    )
  }

  return {
    providers,
    total: providers.length,
  }
}
