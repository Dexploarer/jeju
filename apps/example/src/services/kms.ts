/**
 * KMS Service
 *
 * Type-safe client for the KMS (Key Management Service).
 * Uses direct fetch with typed responses for reliability.
 */

import type { Address } from 'viem'

const KMS_ENDPOINT = process.env.KMS_ENDPOINT || 'http://localhost:4400'
const KMS_TIMEOUT = 10000

// ============================================================================
// Types
// ============================================================================

interface KMSService {
  encrypt(data: string, owner: Address): Promise<string>
  decrypt(encryptedData: string, owner: Address): Promise<string>
  isHealthy(): Promise<boolean>
}

// ============================================================================
// Error Types
// ============================================================================

export class KMSError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message)
    this.name = 'KMSError'
  }
}

// ============================================================================
// Typed HTTP Client
// ============================================================================

class KMSClient {
  constructor(private baseUrl: string) {}

  async encrypt(data: string, owner: Address): Promise<{ encrypted: string }> {
    const response = await fetch(`${this.baseUrl}/encrypt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-jeju-address': owner,
      },
      body: JSON.stringify({
        data,
        policy: {
          conditions: [
            { type: 'balance', chain: 'base', value: '0', comparator: '>=' },
          ],
          operator: 'and',
        },
      }),
      signal: AbortSignal.timeout(KMS_TIMEOUT),
    })

    if (!response.ok) {
      throw new KMSError(
        `KMS encryption failed: ${response.status} ${response.statusText}`,
        response.status,
      )
    }

    return response.json() as Promise<{ encrypted: string }>
  }

  async decrypt(
    payload: string,
    owner: Address,
  ): Promise<{ decrypted: string }> {
    const response = await fetch(`${this.baseUrl}/decrypt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-jeju-address': owner,
      },
      body: JSON.stringify({ payload }),
      signal: AbortSignal.timeout(KMS_TIMEOUT),
    })

    if (!response.ok) {
      throw new KMSError(
        `KMS decryption failed: ${response.status} ${response.statusText}`,
        response.status,
      )
    }

    return response.json() as Promise<{ decrypted: string }>
  }

  async health(): Promise<{ status: string }> {
    const response = await fetch(`${this.baseUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      throw new KMSError('KMS health check failed', response.status)
    }

    return response.json() as Promise<{ status: string }>
  }
}

// ============================================================================
// KMS Service Implementation
// ============================================================================

class NetworkKMSService implements KMSService {
  private client: KMSClient
  private healthLastChecked = 0
  private healthy = false

  constructor() {
    this.client = new KMSClient(KMS_ENDPOINT.replace(/\/$/, ''))
  }

  async encrypt(data: string, owner: Address): Promise<string> {
    const result = await this.client.encrypt(data, owner)
    return result.encrypted
  }

  async decrypt(encryptedData: string, owner: Address): Promise<string> {
    const result = await this.client.decrypt(encryptedData, owner)
    return result.decrypted
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

let kmsService: KMSService | null = null

export function getKMSService(): KMSService {
  if (!kmsService) {
    kmsService = new NetworkKMSService()
  }
  return kmsService
}

export function createKMSClient(baseUrl: string): KMSClient {
  return new KMSClient(baseUrl)
}

export function resetKMSService(): void {
  kmsService = null
}
