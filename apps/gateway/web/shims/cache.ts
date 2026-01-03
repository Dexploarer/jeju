/**
 * Browser shim for @jejunetwork/cache
 * The cache client is server-side only - these are no-op stubs for browser
 */

export interface CacheClient {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttl?: number): Promise<void>
  delete(key: string): Promise<void>
  keys(pattern: string): Promise<string[]>
}

// Browser stub - returns a no-op cache client
export function getCacheClient(): CacheClient {
  return {
    get: async () => null,
    set: async () => {},
    delete: async () => {},
    keys: async () => [],
  }
}

export function resetCacheClients(): void {
  // No-op in browser
}

export const CacheClient = {} as const
