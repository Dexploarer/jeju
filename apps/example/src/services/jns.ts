/**
 * JNS Service
 *
 * Type-safe client for the JNS (Jeju Name Service) gateway.
 * Uses direct fetch with typed responses for reliability.
 */

import type { Address, Hex } from 'viem'
import type { JNSRecords } from '../schemas'
import {
  jnsAvailableResponseSchema,
  jnsPriceResponseSchema,
  jnsRecordsSchema,
  jnsRegisterResponseSchema,
  jnsResolveResponseSchema,
} from '../schemas'
import { normalizeJNSName } from '../utils'
import { expectValid } from '../utils/validation'

const GATEWAY_API = process.env.GATEWAY_API || 'http://localhost:4020'
const JNS_NAME = process.env.JNS_NAME || 'todo.jeju'
const JNS_TIMEOUT = 10000

// ============================================================================
// Error Types
// ============================================================================

export class JNSError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message)
    this.name = 'JNSError'
  }
}

export class JNSNotFoundError extends JNSError {
  constructor(message: string) {
    super(message, 404)
    this.name = 'JNSNotFoundError'
  }
}

// ============================================================================
// Typed HTTP Client
// ============================================================================

class JNSClient {
  constructor(private baseUrl: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
      signal: AbortSignal.timeout(JNS_TIMEOUT),
    })

    if (!response.ok) {
      if (response.status === 404) {
        throw new JNSNotFoundError(`Resource not found: ${path}`)
      }
      throw new JNSError(
        `JNS request failed: ${response.status}`,
        response.status,
      )
    }

    return response.json() as Promise<T>
  }

  async checkAvailable(name: string): Promise<{ available: boolean }> {
    return this.request(`/jns/available/${encodeURIComponent(name)}`)
  }

  async register(data: {
    name: string
    owner: Address
    durationYears: number
    price: string
  }): Promise<{ txHash: string; name?: string }> {
    return this.request('/jns/register', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getRecords(name: string): Promise<JNSRecords> {
    return this.request(`/jns/records/${encodeURIComponent(name)}`)
  }

  async setRecords(
    name: string,
    records: JNSRecords,
  ): Promise<{ txHash: string }> {
    return this.request(`/jns/records/${encodeURIComponent(name)}`, {
      method: 'POST',
      body: JSON.stringify(records),
    })
  }

  async resolve(name: string): Promise<{ address: string }> {
    return this.request(`/jns/resolve/${encodeURIComponent(name)}`)
  }

  async getPrice(name: string, years: number): Promise<{ price: string }> {
    return this.request(`/jns/price/${encodeURIComponent(name)}?years=${years}`)
  }

  async health(): Promise<{ status: string }> {
    return this.request('/health')
  }
}

// ============================================================================
// Service Interface
// ============================================================================

interface JNSService {
  isNameAvailable(name: string): Promise<boolean>
  register(
    name: string,
    owner: Address,
    durationYears: number,
  ): Promise<{ txHash: Hex; name: string }>
  setRecords(name: string, records: JNSRecords): Promise<{ txHash: Hex }>
  getRecords(name: string): Promise<JNSRecords>
  resolve(name: string): Promise<Address | null>
  getRegistrationPrice(name: string, durationYears: number): Promise<bigint>
}

// ============================================================================
// Service Implementation
// ============================================================================

class JNSServiceImpl implements JNSService {
  private client: JNSClient

  constructor() {
    this.client = new JNSClient(GATEWAY_API)
  }

  async isNameAvailable(name: string): Promise<boolean> {
    const normalized = normalizeJNSName(name)
    const data = await this.client.checkAvailable(normalized)
    expectValid(jnsAvailableResponseSchema, data, 'JNS available response')
    return data.available
  }

  async register(
    name: string,
    owner: Address,
    durationYears: number,
  ): Promise<{ txHash: Hex; name: string }> {
    const normalized = normalizeJNSName(name)
    const price = await this.getRegistrationPrice(name, durationYears)

    const data = await this.client.register({
      name: normalized,
      owner,
      durationYears,
      price: price.toString(),
    })

    expectValid(jnsRegisterResponseSchema, data, 'JNS register response')
    return { txHash: data.txHash as Hex, name: normalized }
  }

  async setRecords(
    name: string,
    records: JNSRecords,
  ): Promise<{ txHash: Hex }> {
    const normalized = normalizeJNSName(name)
    const data = await this.client.setRecords(normalized, records)
    expectValid(jnsRegisterResponseSchema, data, 'JNS set records response')
    return { txHash: data.txHash as Hex }
  }

  async getRecords(name: string): Promise<JNSRecords> {
    const normalized = normalizeJNSName(name)
    try {
      const data = await this.client.getRecords(normalized)
      return expectValid(jnsRecordsSchema, data, 'JNS records response')
    } catch (e) {
      if (e instanceof JNSNotFoundError) {
        return {}
      }
      throw e
    }
  }

  async resolve(name: string): Promise<Address | null> {
    const normalized = normalizeJNSName(name)
    try {
      const data = await this.client.resolve(normalized)
      expectValid(jnsResolveResponseSchema, data, 'JNS resolve response')
      return data.address as Address
    } catch (e) {
      if (e instanceof JNSNotFoundError) {
        return null
      }
      throw e
    }
  }

  async getRegistrationPrice(
    name: string,
    durationYears: number,
  ): Promise<bigint> {
    const normalized = normalizeJNSName(name)
    const data = await this.client.getPrice(normalized, durationYears)
    expectValid(jnsPriceResponseSchema, data, 'JNS price response')
    return BigInt(data.price)
  }
}

// ============================================================================
// Singleton
// ============================================================================

let jnsService: JNSService | null = null

export function getJNSService(): JNSService {
  if (!jnsService) {
    jnsService = new JNSServiceImpl()
  }
  return jnsService
}

/**
 * Create a JNS client with custom configuration
 */
export function createJNSClient(baseUrl: string): JNSClient {
  return new JNSClient(baseUrl)
}

// ============================================================================
// Helper Functions
// ============================================================================

export async function setupDAppJNS(
  owner: Address,
  config: {
    name: string
    backendUrl: string
    frontendCid: string
    description?: string
  },
): Promise<JNSRecords> {
  const jns = getJNSService()

  const existing = await jns.getRecords(config.name)

  const records: JNSRecords = {
    address: owner,
    contentHash: config.frontendCid
      ? `ipfs://${config.frontendCid}`
      : undefined,
    a2aEndpoint: `${config.backendUrl}/a2a`,
    mcpEndpoint: `${config.backendUrl}/mcp`,
    restEndpoint: `${config.backendUrl}/api/v1`,
    description:
      config.description !== undefined
        ? config.description
        : 'Decentralized Todo Application',
  }

  if (!existing.address) {
    await jns.register(config.name, owner, 1)
  }

  await jns.setRecords(config.name, records)

  return records
}

export { JNS_NAME }
