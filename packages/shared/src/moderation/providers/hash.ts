/**
 * Hash-based content detection. SHA256 matching against known bad hashes.
 *
 * CSAM HASH SOURCES:
 * - NCMEC (National Center for Missing & Exploited Children) - requires partnership
 * - IWF (Internet Watch Foundation) - requires membership
 * - CAID (Child Abuse Image Database) - UK law enforcement only
 *
 * To configure, set environment variables:
 *   CSAM_HASH_LIST_PATH=/path/to/csam-hashes.txt (one SHA256/MD5 per line)
 *   MALWARE_HASH_LIST_PATH=/path/to/malware-hashes.txt
 *
 * Or pass paths in config:
 *   new HashModerationProvider({ csamHashListPath: '/path/to/hashes.txt' })
 */

import type { CategoryScore, HashMatch, ModerationCategory, ModerationProvider, ModerationResult } from '../types'

export interface HashEntry {
  hash: string
  hashType: 'sha256' | 'md5'
  category: ModerationCategory
  source: 'internal' | 'imported'
  addedAt: number
  description?: string
}

export interface HashDatabaseConfig {
  csamHashListPath?: string
  malwareHashListPath?: string
}

export interface HashProviderConfig extends HashDatabaseConfig {
  preloadedHashes?: Array<{ hash: string; category: ModerationCategory; description?: string }>
}

const csamHashes = new Map<string, HashEntry>()
const malwareHashes = new Map<string, HashEntry>()
const internalHashes = new Map<string, HashEntry>()

async function sha256(buffer: Buffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new Uint8Array(buffer))
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export class HashModerationProvider {
  readonly name: ModerationProvider = 'hash'
  private config: HashProviderConfig
  private initialized = false

  constructor(config: HashProviderConfig = {}) {
    this.config = config
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    if (this.config.csamHashListPath) {
      await this.loadHashFile(this.config.csamHashListPath, 'csam', csamHashes)
    }
    if (this.config.malwareHashListPath) {
      await this.loadHashFile(this.config.malwareHashListPath, 'malware', malwareHashes)
    }
    if (this.config.preloadedHashes) {
      for (const e of this.config.preloadedHashes) {
        this.addHash(e.hash, e.category, e.description)
      }
    }

    this.initialized = true
    console.log(`[HashProvider] Loaded ${csamHashes.size} CSAM hashes, ${malwareHashes.size} malware hashes, ${internalHashes.size} internal hashes`)
  }

  private async loadHashFile(path: string, category: ModerationCategory, target: Map<string, HashEntry>): Promise<void> {
    try {
      const fs = await import('fs/promises')
      const content = await fs.readFile(path, 'utf-8')
      for (const line of content.split('\n')) {
        const hash = line.trim().toLowerCase()
        if (/^[a-f0-9]{32}$/.test(hash) || /^[a-f0-9]{64}$/.test(hash)) {
          target.set(hash, {
            hash,
            hashType: hash.length === 64 ? 'sha256' : 'md5',
            category,
            source: 'imported',
            addedAt: Date.now(),
          })
        }
      }
    } catch (err) {
      console.warn(`[HashProvider] Could not load ${path}:`, err)
    }
  }

  addHash(hash: string, category: ModerationCategory, description?: string): void {
    const h = hash.toLowerCase()
    const entry: HashEntry = {
      hash: h,
      hashType: h.length === 64 ? 'sha256' : 'md5',
      category,
      source: 'internal',
      addedAt: Date.now(),
      description,
    }
    internalHashes.set(h, entry)
    if (category === 'csam') csamHashes.set(h, entry)
    else if (category === 'malware') malwareHashes.set(h, entry)
  }

  removeHash(hash: string): boolean {
    const h = hash.toLowerCase()
    const existed = internalHashes.delete(h)
    csamHashes.delete(h)
    malwareHashes.delete(h)
    return existed
  }

  async moderate(buffer: Buffer): Promise<ModerationResult> {
    const start = Date.now()
    const hash = await sha256(buffer)
    const matches: HashMatch[] = []
    const categories: CategoryScore[] = []

    for (const { map, name } of [
      { map: csamHashes, name: 'csam' as const },
      { map: malwareHashes, name: 'malware' as const },
      { map: internalHashes, name: 'internal' as const },
    ]) {
      const entry = map.get(hash)
      if (entry) {
        matches.push({ hashType: 'sha256', database: name, matchConfidence: 1, category: entry.category })
        categories.push({ category: entry.category, score: 1, confidence: 1, provider: 'hash', details: `Match in ${name}` })
      }
    }

    const hasCsam = categories.some(c => c.category === 'csam')
    const hasMalware = categories.some(c => c.category === 'malware')

    return {
      safe: categories.length === 0,
      action: hasCsam ? 'ban' : hasMalware ? 'block' : categories.length ? 'block' : 'allow',
      severity: hasCsam ? 'critical' : hasMalware ? 'high' : categories.length ? 'medium' : 'none',
      categories,
      primaryCategory: categories[0]?.category,
      blockedReason: matches[0] ? `Hash match: ${matches[0].category}` : undefined,
      reviewRequired: hasCsam,
      processingTimeMs: Date.now() - start,
      providers: ['hash'],
      hashMatches: matches.length ? matches : undefined,
    }
  }

  hasHash(hash: string): boolean {
    const h = hash.toLowerCase()
    return csamHashes.has(h) || malwareHashes.has(h) || internalHashes.has(h)
  }

  getStats() {
    return { csamCount: csamHashes.size, malwareCount: malwareHashes.size, internalCount: internalHashes.size, initialized: this.initialized }
  }
}
