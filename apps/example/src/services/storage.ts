/**
 * Storage Service
 *
 * Type-safe client for the DWS storage/IPFS system.
 * Uses direct fetch with typed responses for reliability.
 */

import type { Address } from 'viem'

const STORAGE_ENDPOINT =
  process.env.STORAGE_API_ENDPOINT || 'http://localhost:4010'
const IPFS_GATEWAY = process.env.IPFS_GATEWAY || 'http://localhost:4180'
const STORAGE_TIMEOUT = 30000

// ============================================================================
// Types
// ============================================================================

interface StorageService {
  upload(data: Uint8Array, name: string, owner: Address): Promise<string>
  retrieve(cid: string): Promise<Uint8Array>
  getUrl(cid: string): string
  isHealthy(): Promise<boolean>
}

// ============================================================================
// CID Validation
// ============================================================================

const CID_PATTERN =
  /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{58,}|z[1-9A-HJ-NP-Za-km-z]+|f[a-f0-9]+)$/

function validateCID(cid: string): string {
  if (!cid || cid.length === 0) {
    throw new StorageError('CID is required', 400)
  }
  if (cid.includes('/') || cid.includes('\\') || cid.includes('..')) {
    throw new StorageError('Invalid CID: contains path characters', 400)
  }
  if (!CID_PATTERN.test(cid)) {
    throw new StorageError(`Invalid CID format: ${cid}`, 400)
  }
  return cid
}

// ============================================================================
// File Name Sanitization
// ============================================================================

function sanitizeFileName(name: string): string {
  if (!name || name.length === 0) {
    throw new StorageError('File name is required', 400)
  }
  let sanitized = name
    .replace(/\.\./g, '')
    .replace(/^\/+/, '')
    .replace(/[/\\]/g, '_')
    .replace(/[<>:"|?*]/g, '_')
    .split('')
    .filter((c) => c.charCodeAt(0) >= 32)
    .join('')

  if (sanitized.length > 255) sanitized = sanitized.slice(0, 255)
  if (sanitized.length === 0 || sanitized === '.' || sanitized === '..') {
    throw new StorageError('Invalid file name after sanitization', 400)
  }
  return sanitized
}

// ============================================================================
// Error Types
// ============================================================================

export class StorageError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message)
    this.name = 'StorageError'
  }
}

// ============================================================================
// Typed HTTP Client
// ============================================================================

class StorageClient {
  constructor(
    private storageUrl: string,
    private gatewayUrl: string,
  ) {}

  async upload(
    data: Uint8Array,
    name: string,
    owner: Address,
  ): Promise<{ cid: string }> {
    const safeName = sanitizeFileName(name)

    const formData = new FormData()
    const blob = new Blob([new Uint8Array(data)])
    formData.append('file', blob, safeName)
    formData.append('tier', 'hot')

    const response = await fetch(`${this.storageUrl}/upload`, {
      method: 'POST',
      headers: { 'x-jeju-address': owner },
      body: formData,
      signal: AbortSignal.timeout(STORAGE_TIMEOUT),
    })

    if (!response.ok) {
      throw new StorageError(
        `IPFS upload failed: ${response.status} ${response.statusText}`,
        response.status,
      )
    }

    return response.json() as Promise<{ cid: string }>
  }

  async retrieve(cid: string): Promise<Uint8Array> {
    const validatedCid = validateCID(cid)

    const response = await fetch(`${this.gatewayUrl}/ipfs/${validatedCid}`, {
      signal: AbortSignal.timeout(STORAGE_TIMEOUT),
    })

    if (!response.ok) {
      throw new StorageError(
        `IPFS retrieve failed: ${response.status} ${response.statusText}`,
        response.status,
      )
    }

    return new Uint8Array(await response.arrayBuffer())
  }

  getUrl(cid: string): string {
    const validatedCid = validateCID(cid)
    return `${this.gatewayUrl}/ipfs/${validatedCid}`
  }

  async health(): Promise<{ status: string }> {
    const response = await fetch(`${this.storageUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      throw new StorageError('Storage health check failed', response.status)
    }

    return response.json() as Promise<{ status: string }>
  }
}

// ============================================================================
// IPFS Storage Service Implementation
// ============================================================================

class IPFSStorageService implements StorageService {
  private client: StorageClient
  private healthLastChecked = 0
  private healthy = false

  constructor() {
    const storageUrl = STORAGE_ENDPOINT.replace(/\/$/, '')
    const gatewayUrl = IPFS_GATEWAY.replace(/\/$/, '')
    this.client = new StorageClient(storageUrl, gatewayUrl)
  }

  async upload(
    data: Uint8Array,
    name: string,
    owner: Address,
  ): Promise<string> {
    const result = await this.client.upload(data, name, owner)
    return result.cid
  }

  async retrieve(cid: string): Promise<Uint8Array> {
    return this.client.retrieve(cid)
  }

  getUrl(cid: string): string {
    return this.client.getUrl(cid)
  }

  async isHealthy(): Promise<boolean> {
    if (Date.now() - this.healthLastChecked < 30000) {
      return this.healthy
    }

    try {
      await this.client.health()
      this.healthy = true
    } catch {
      this.healthy = false
    }
    this.healthLastChecked = Date.now()
    return this.healthy
  }
}

// ============================================================================
// Singleton
// ============================================================================

let storageService: StorageService | null = null

export function getStorageService(): StorageService {
  if (!storageService) {
    storageService = new IPFSStorageService()
  }
  return storageService
}

export function resetStorageService(): void {
  storageService = null
}
