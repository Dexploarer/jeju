/**
 * Container utilities
 * Shared business logic for container-related operations
 */

import type { ContainerImage } from '../db'

export interface ContainerListResponse {
  cid: string
  name: string
  tag: string
  sizeBytes: string
  uploadedAt: string
  uploadedBy: string | null
  storageProvider: string | null
  tier: string
  architecture: string
  gpuRequired: boolean
  minGpuVram: number | null | undefined
  teeRequired: boolean
  verified: boolean
  pullCount: number
  lastPulledAt: string | null
}

/**
 * Map ContainerImage database record to API response
 */
export function mapContainerListResponse(
  container: ContainerImage,
): ContainerListResponse {
  if (!container) {
    throw new Error('ContainerImage is required')
  }
  return {
    cid: container.cid,
    name: container.name ?? '',
    tag: 'latest',
    sizeBytes: container.sizeBytes ?? '0',
    uploadedAt: container.createdAt ?? new Date().toISOString(),
    uploadedBy: container.ownerId ?? null,
    storageProvider: null,
    tier: 'standard',
    architecture: container.architecture ?? 'amd64',
    gpuRequired: false,
    minGpuVram: null,
    teeRequired: false,
    verified: container.verified,
    pullCount: container.pullCount,
    lastPulledAt: null,
  }
}
