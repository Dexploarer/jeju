/**
 * Cache Service
 *
 * Type-safe client for the DWS compute cache.
 * Uses direct fetch with typed responses for reliability.
 */

const COMPUTE_CACHE_ENDPOINT =
  process.env.COMPUTE_CACHE_ENDPOINT || 'http://localhost:4200/cache'
const CACHE_TIMEOUT = 5000
const NETWORK = process.env.NETWORK || 'localnet'

// ============================================================================
// Types
// ============================================================================

interface CacheService {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttlMs?: number): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
  isHealthy(): Promise<boolean>
}

// ============================================================================
// In-memory Fallback Cache
// ============================================================================

interface CacheEntry {
  value: unknown
  expiresAt: number
}

const memoryCache: Map<string, CacheEntry> = new Map()

function cleanExpired(): void {
  const now = Date.now()
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expiresAt && entry.expiresAt < now) {
      memoryCache.delete(key)
    }
  }
}

// ============================================================================
// Error Types
// ============================================================================

export class CacheError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message)
    this.name = 'CacheError'
  }
}

// ============================================================================
// Typed HTTP Client
// ============================================================================

class CacheClient {
  constructor(private baseUrl: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
      signal: AbortSignal.timeout(CACHE_TIMEOUT),
    })

    if (!response.ok) {
      throw new CacheError(
        `Cache request failed: ${response.status}`,
        response.status,
      )
    }

    return response.json() as Promise<T>
  }

  async get(key: string): Promise<{ value: unknown }> {
    return this.request('/get', {
      method: 'POST',
      body: JSON.stringify({ key }),
    })
  }

  async set(
    key: string,
    value: unknown,
    ttlMs?: number,
  ): Promise<{ success: boolean }> {
    return this.request('/set', {
      method: 'POST',
      body: JSON.stringify({ key, value, ttlMs }),
    })
  }

  async delete(key: string): Promise<{ success: boolean }> {
    return this.request('/delete', {
      method: 'POST',
      body: JSON.stringify({ key }),
    })
  }

  async clear(): Promise<{ success: boolean }> {
    return this.request('/clear', { method: 'POST' })
  }

  async health(): Promise<{ status: string }> {
    return this.request('/health')
  }
}

// ============================================================================
// Compute Cache Service Implementation
// ============================================================================

class ComputeCacheService implements CacheService {
  private client: CacheClient
  private healthLastChecked = 0
  private healthy = false
  private useFallback = false
  private checkedFallback = false

  constructor() {
    this.client = new CacheClient(COMPUTE_CACHE_ENDPOINT)
  }

  private async checkFallback(): Promise<void> {
    if (this.checkedFallback) return
    this.checkedFallback = true

    const isHealthy = await this.isHealthy()
    if (!isHealthy && (NETWORK === 'localnet' || NETWORK === 'Jeju')) {
      console.log('[Cache] Compute cache unavailable, using in-memory fallback')
      this.useFallback = true
    }
  }

  async get<T>(key: string): Promise<T | null> {
    await this.checkFallback()

    if (this.useFallback) {
      cleanExpired()
      const entry = memoryCache.get(key)
      if (!entry) return null
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        memoryCache.delete(key)
        return null
      }
      return entry.value as T
    }

    try {
      const data = await this.client.get(key)
      return data.value as T | null
    } catch (error) {
      if (NETWORK === 'localnet' || NETWORK === 'Jeju') {
        console.warn(`[Cache] Get failed, using fallback: ${error}`)
        this.useFallback = true
        return this.get<T>(key)
      }
      console.error(`[Cache] Get failed: ${error}`)
      return null
    }
  }

  async set<T>(key: string, value: T, ttlMs = 300000): Promise<void> {
    await this.checkFallback()

    if (this.useFallback) {
      memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs })
      return
    }

    try {
      await this.client.set(key, value, ttlMs)
    } catch (error) {
      if (NETWORK === 'localnet' || NETWORK === 'Jeju') {
        console.warn(`[Cache] Set failed, using fallback: ${error}`)
        this.useFallback = true
        memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs })
      } else {
        console.error(`[Cache] Set failed: ${error}`)
      }
    }
  }

  async delete(key: string): Promise<void> {
    await this.checkFallback()

    if (this.useFallback) {
      memoryCache.delete(key)
      return
    }

    try {
      await this.client.delete(key)
    } catch (error) {
      if (NETWORK === 'localnet' || NETWORK === 'Jeju') {
        console.warn(`[Cache] Delete failed, using fallback: ${error}`)
        this.useFallback = true
        memoryCache.delete(key)
      } else {
        console.error(`[Cache] Delete failed: ${error}`)
      }
    }
  }

  async clear(): Promise<void> {
    await this.checkFallback()

    if (this.useFallback) {
      memoryCache.clear()
      return
    }

    try {
      await this.client.clear()
    } catch (error) {
      if (NETWORK === 'localnet' || NETWORK === 'Jeju') {
        console.warn(`[Cache] Clear failed, using fallback: ${error}`)
        this.useFallback = true
        memoryCache.clear()
      } else {
        console.error(`[Cache] Clear failed: ${error}`)
      }
    }
  }

  async isHealthy(): Promise<boolean> {
    if (this.useFallback) return true

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

let cacheService: CacheService | null = null

export function getCache(): CacheService {
  if (!cacheService) {
    cacheService = new ComputeCacheService()
  }
  return cacheService
}

export function resetCache(): void {
  cacheService = null
  memoryCache.clear()
}

// ============================================================================
// Cache Key Helpers
// ============================================================================

export const cacheKeys = {
  todoList: (owner: string) => `todos:list:${owner.toLowerCase()}`,
  todoItem: (id: string) => `todos:item:${id}`,
  todoStats: (owner: string) => `todos:stats:${owner.toLowerCase()}`,
  userSession: (address: string) => `session:${address.toLowerCase()}`,
}
