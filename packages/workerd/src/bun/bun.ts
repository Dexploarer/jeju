// Copyright (c) 2024 Jeju Network
// Bun Runtime Compatibility Layer for Workerd
// Licensed under the Apache 2.0 license

/**
 * Bun Runtime for Workerd
 *
 * This module provides Bun-compatible APIs for running Bun applications
 * on workerd/Cloudflare Workers infrastructure.
 *
 * Implemented APIs:
 * - Bun.file() - File handling
 * - Bun.write() - File writing
 * - Bun.serve() - HTTP server (maps to fetch handler)
 * - Bun.env - Environment variables
 * - Bun.version - Version info
 * - Bun.hash() - Hashing utilities
 * - Bun.sleep() / Bun.sleepSync() - Sleep utilities
 * - Bun.escapeHTML() - HTML escaping
 * - Bun.stringWidth() - String width calculation
 * - Bun.deepEquals() - Deep equality
 * - Bun.inspect() - Object inspection
 * - Bun.nanoseconds() - High-precision time
 * - Bun.ArrayBufferSink - Buffer sink
 * - Bun.readableStreamTo*() - Stream utilities
 */

import {
  ERR_FS_FILE_NOT_FOUND,
  ERR_WORKERD_UNAVAILABLE,
} from 'bun-internal:errors'
import { isArrayBuffer, isString, isUint8Array } from 'bun-internal:types'

// =============================================================================
// Types
// =============================================================================

export interface BunFile {
  readonly size: number
  readonly type: string
  readonly name: string
  readonly lastModified: number

  text(): Promise<string>
  json<T = unknown>(): Promise<T>
  arrayBuffer(): Promise<ArrayBuffer>
  bytes(): Promise<Uint8Array>
  stream(): ReadableStream<Uint8Array>
  slice(start?: number, end?: number, type?: string): BunFile
  exists(): Promise<boolean>
  writer(): FileSink
}

export interface FileSink {
  write(data: string | ArrayBuffer | Uint8Array): number
  flush(): void
  end(): void
}

export interface ServeOptions {
  port?: number
  hostname?: string
  fetch: (request: Request) => Response | Promise<Response>
  error?: (error: Error) => Response | Promise<Response>
  websocket?: WebSocketHandler
  development?: boolean
  reusePort?: boolean
  tls?: TLSOptions
}

export interface TLSOptions {
  cert?: string | string[]
  key?: string | string[]
  ca?: string | string[]
  passphrase?: string
}

export interface WebSocketHandler {
  message?: (ws: ServerWebSocket, message: string | ArrayBuffer) => void
  open?: (ws: ServerWebSocket) => void
  close?: (ws: ServerWebSocket, code: number, reason: string) => void
  drain?: (ws: ServerWebSocket) => void
}

export interface ServerWebSocket {
  send(data: string | ArrayBuffer): void
  close(code?: number, reason?: string): void
  readonly readyState: number
  readonly data: unknown
}

export interface Server {
  readonly port: number
  readonly hostname: string
  readonly development: boolean
  readonly url: URL
  stop(): void
  ref(): void
  unref(): void
  reload(options: Partial<ServeOptions>): void
  fetch(request: Request): Promise<Response>
}

export interface HashOptions {
  seed?: number
}

export type HashAlgorithm =
  | 'wyhash'
  | 'adler32'
  | 'crc32'
  | 'cityhash32'
  | 'cityhash64'
  | 'murmur32v3'
  | 'murmur64v2'

// =============================================================================
// Internal Storage
// =============================================================================

// In-memory file storage for workerd environment (no real filesystem)
const fileStorage = new Map<string, Uint8Array>()
const fileMetadata = new Map<string, { type: string; lastModified: number }>()

// =============================================================================
// BunFile Implementation
// =============================================================================

class BunFileImpl implements BunFile {
  private readonly path: string
  private readonly _type: string

  constructor(path: string | URL, options?: { type?: string }) {
    this.path = typeof path === 'string' ? path : path.pathname
    this._type = options?.type ?? 'application/octet-stream'
  }

  get size(): number {
    const data = fileStorage.get(this.path)
    return data?.byteLength ?? 0
  }

  get type(): string {
    const meta = fileMetadata.get(this.path)
    return meta?.type ?? this._type
  }

  get name(): string {
    // Bun's BunFile.name returns the full path, not just the filename
    return this.path
  }

  get lastModified(): number {
    const meta = fileMetadata.get(this.path)
    return meta?.lastModified ?? Date.now()
  }

  async text(): Promise<string> {
    const data = fileStorage.get(this.path)
    if (!data) {
      throw new ERR_FS_FILE_NOT_FOUND(this.path)
    }
    return new TextDecoder().decode(data)
  }

  async json<T = unknown>(): Promise<T> {
    const text = await this.text()
    return JSON.parse(text) as T
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    const data = fileStorage.get(this.path)
    if (!data) {
      throw new ERR_FS_FILE_NOT_FOUND(this.path)
    }
    // Use ArrayBuffer.prototype.slice to ensure we get an ArrayBuffer
    const ab = data.buffer
    if (ab instanceof ArrayBuffer) {
      return ab.slice(data.byteOffset, data.byteOffset + data.byteLength)
    }
    // For SharedArrayBuffer, create a copy as ArrayBuffer
    const copy = new ArrayBuffer(data.byteLength)
    new Uint8Array(copy).set(data)
    return copy
  }

  async bytes(): Promise<Uint8Array> {
    const data = fileStorage.get(this.path)
    if (!data) {
      throw new ERR_FS_FILE_NOT_FOUND(this.path)
    }
    return new Uint8Array(data)
  }

  stream(): ReadableStream<Uint8Array> {
    const data = fileStorage.get(this.path)
    if (!data) {
      throw new ERR_FS_FILE_NOT_FOUND(this.path)
    }
    return new ReadableStream({
      start(controller) {
        controller.enqueue(data)
        controller.close()
      },
    })
  }

  slice(start?: number, end?: number, type?: string): BunFile {
    const data = fileStorage.get(this.path)
    if (!data) {
      return new BunFileImpl(this.path, { type: type ?? this._type })
    }
    const sliced = data.slice(start, end)
    const slicePath = `${this.path}#slice(${start},${end})`
    fileStorage.set(slicePath, sliced)
    return new BunFileImpl(slicePath, { type: type ?? this._type })
  }

  async exists(): Promise<boolean> {
    return fileStorage.has(this.path)
  }

  writer(): FileSink {
    const path = this.path
    const chunks: Uint8Array[] = []

    return {
      write(data: string | ArrayBuffer | Uint8Array): number {
        let bytes: Uint8Array
        if (typeof data === 'string') {
          bytes = new TextEncoder().encode(data)
        } else if (data instanceof ArrayBuffer) {
          bytes = new Uint8Array(data)
        } else {
          bytes = data
        }
        chunks.push(bytes)
        return bytes.byteLength
      },
      flush(): void {
        // Merge all chunks
        const totalLength = chunks.reduce((sum, c) => sum + c.byteLength, 0)
        const result = new Uint8Array(totalLength)
        let offset = 0
        for (const chunk of chunks) {
          result.set(chunk, offset)
          offset += chunk.byteLength
        }
        fileStorage.set(path, result)
        fileMetadata.set(path, {
          type: 'application/octet-stream',
          lastModified: Date.now(),
        })
      },
      end(): void {
        this.flush()
        chunks.length = 0
      },
    }
  }
}

// =============================================================================
// Core Bun Functions
// =============================================================================

/**
 * Create a BunFile reference
 */
export function file(path: string | URL, options?: { type?: string }): BunFile {
  return new BunFileImpl(path, options)
}

/**
 * Write data to a file
 */
export async function write(
  destination: string | URL | BunFile,
  data: string | ArrayBuffer | Uint8Array | Blob | Response | BunFile,
): Promise<number> {
  const path = isString(destination)
    ? destination
    : destination instanceof URL
      ? destination.pathname
      : destination.name

  let bytes: Uint8Array

  if (isString(data)) {
    bytes = new TextEncoder().encode(data)
  } else if (isArrayBuffer(data)) {
    bytes = new Uint8Array(data)
  } else if (isUint8Array(data)) {
    bytes = data
  } else if (data instanceof Blob) {
    bytes = new Uint8Array(await data.arrayBuffer())
  } else if (data instanceof Response) {
    bytes = new Uint8Array(await data.arrayBuffer())
  } else {
    // BunFile
    bytes = await data.bytes()
  }

  fileStorage.set(path, bytes)
  fileMetadata.set(path, {
    type: 'application/octet-stream',
    lastModified: Date.now(),
  })

  return bytes.byteLength
}

/**
 * Serve HTTP requests
 *
 * In workerd, this is a compatibility shim - actual serving is handled
 * by the workerd fetch handler. This function stores the configuration
 * and returns a mock Server object.
 */
let currentServeOptions: ServeOptions | null = null

export function serve(options: ServeOptions): Server {
  currentServeOptions = options

  const port = options.port ?? 3000
  const hostname = options.hostname ?? 'localhost'

  return {
    port,
    hostname,
    development: options.development ?? false,
    url: new URL(`http://${hostname}:${port}`),
    stop() {
      currentServeOptions = null
    },
    ref() {},
    unref() {},
    reload(newOptions: Partial<ServeOptions>) {
      currentServeOptions = { ...currentServeOptions!, ...newOptions }
    },
    async fetch(request: Request): Promise<Response> {
      if (!currentServeOptions) {
        throw new Error('Server is not running')
      }
      try {
        return await currentServeOptions.fetch(request)
      } catch (error) {
        if (currentServeOptions.error && error instanceof Error) {
          return currentServeOptions.error(error)
        }
        throw error
      }
    },
  }
}

/**
 * Get the current serve options (for workerd integration)
 */
export function getServeHandler(): ServeOptions | null {
  return currentServeOptions
}

// =============================================================================
// Environment
// =============================================================================

/**
 * Environment variables (proxied to globalThis.process.env if available)
 */
export const env: Record<string, string | undefined> = new Proxy(
  {},
  {
    get(_target, prop: string): string | undefined {
      // Try process.env first
      if (typeof globalThis !== 'undefined') {
        const proc = (globalThis as Record<string, unknown>).process as
          | { env?: Record<string, string> }
          | undefined
        if (proc?.env) {
          return proc.env[prop]
        }
      }
      return undefined
    },
    set(_target, prop: string, value: string): boolean {
      if (typeof globalThis !== 'undefined') {
        const proc = (globalThis as Record<string, unknown>).process as
          | { env?: Record<string, string> }
          | undefined
        if (proc?.env) {
          proc.env[prop] = value
        }
      }
      return true
    },
    has(_target, prop: string): boolean {
      if (typeof globalThis !== 'undefined') {
        const proc = (globalThis as Record<string, unknown>).process as
          | { env?: Record<string, string> }
          | undefined
        if (proc?.env) {
          return prop in proc.env
        }
      }
      return false
    },
    ownKeys(): string[] {
      if (typeof globalThis !== 'undefined') {
        const proc = (globalThis as Record<string, unknown>).process as
          | { env?: Record<string, string> }
          | undefined
        if (proc?.env) {
          return Object.keys(proc.env)
        }
      }
      return []
    },
    getOwnPropertyDescriptor(target, prop: string) {
      const value = Reflect.get(target, prop)
      if (value !== undefined) {
        return {
          enumerable: true,
          configurable: true,
          value,
        }
      }
      // Check process.env
      if (typeof globalThis !== 'undefined') {
        const proc = (globalThis as Record<string, unknown>).process as
          | { env?: Record<string, string> }
          | undefined
        if (proc?.env && prop in proc.env) {
          return {
            enumerable: true,
            configurable: true,
            value: proc.env[prop],
          }
        }
      }
      return undefined
    },
  },
)

// =============================================================================
// Version Info
// =============================================================================

export const version = '1.3.0' // Bun version we're compatible with
export const revision = 'workerd-compat'

// =============================================================================
// Utilities
// =============================================================================

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Synchronous sleep (blocks the event loop - use with caution)
 * Note: In workerd, this uses a busy wait since true sync sleep isn't available
 */
export function sleepSync(ms: number): void {
  const end = Date.now() + ms
  while (Date.now() < end) {
    // Busy wait - not ideal but necessary for sync behavior
  }
}

/**
 * Get high-precision time in nanoseconds
 */
export function nanoseconds(): bigint {
  // Use performance.now() and convert to nanoseconds
  return BigInt(Math.floor(performance.now() * 1_000_000))
}

/**
 * Escape HTML special characters
 */
export function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Calculate the display width of a string (accounting for wide chars)
 */
export function stringWidth(str: string): number {
  let width = 0
  for (const char of str) {
    const code = char.codePointAt(0)!
    // CJK characters and other wide characters
    if (
      (code >= 0x1100 && code <= 0x115f) || // Hangul Jamo
      (code >= 0x2e80 && code <= 0xa4cf) || // CJK
      (code >= 0xac00 && code <= 0xd7a3) || // Hangul Syllables
      (code >= 0xf900 && code <= 0xfaff) || // CJK Compatibility
      (code >= 0xfe10 && code <= 0xfe1f) || // Vertical forms
      (code >= 0xfe30 && code <= 0xfe6f) || // CJK Compatibility Forms
      (code >= 0xff00 && code <= 0xff60) || // Fullwidth Forms
      (code >= 0xffe0 && code <= 0xffe6) || // Fullwidth Forms
      (code >= 0x20000 && code <= 0x2fffd) || // CJK Extension B
      (code >= 0x30000 && code <= 0x3fffd) // CJK Extension C
    ) {
      width += 2
    } else {
      width += 1
    }
  }
  return width
}

/**
 * Deep equality comparison
 */
export function deepEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (a === null || b === null) return a === b

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((item, index) => deepEquals(item, b[index]))
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>
    const bObj = b as Record<string, unknown>
    const aKeys = Object.keys(aObj)
    const bKeys = Object.keys(bObj)

    if (aKeys.length !== bKeys.length) return false
    return aKeys.every((key) => key in bObj && deepEquals(aObj[key], bObj[key]))
  }

  return false
}

/**
 * Inspect an object (similar to Node's util.inspect)
 */
export function inspect(
  obj: unknown,
  options?: { depth?: number; colors?: boolean },
): string {
  const depth = options?.depth ?? 2
  return inspectValue(obj, depth, new Set())
}

function inspectValue(
  value: unknown,
  depth: number,
  seen: Set<unknown>,
): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'

  const type = typeof value

  if (type === 'string') return JSON.stringify(value)
  if (type === 'number' || type === 'boolean' || type === 'bigint') {
    return String(value)
  }
  if (type === 'function') {
    const fn = value as Function
    return `[Function: ${fn.name || 'anonymous'}]`
  }
  if (type === 'symbol') return value.toString()

  if (seen.has(value)) return '[Circular]'

  if (Array.isArray(value)) {
    if (depth < 0) return '[Array]'
    seen.add(value)
    const items = value.map((item) => inspectValue(item, depth - 1, seen))
    seen.delete(value)
    return `[ ${items.join(', ')} ]`
  }

  if (value instanceof Date) return value.toISOString()
  if (value instanceof RegExp) return value.toString()
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`
  }

  if (type === 'object') {
    if (depth < 0) return '[Object]'
    seen.add(value)
    const obj = value as Record<string, unknown>
    const entries = Object.entries(obj).map(
      ([k, v]) => `${k}: ${inspectValue(v, depth - 1, seen)}`,
    )
    seen.delete(value)
    return `{ ${entries.join(', ')} }`
  }

  return String(value)
}

// =============================================================================
// Hashing
// =============================================================================

/**
 * Hash data using various algorithms
 */
export function hash(
  data: string | ArrayBuffer | Uint8Array,
  algorithm?: HashAlgorithm,
): number | bigint {
  const bytes = isString(data)
    ? new TextEncoder().encode(data)
    : isArrayBuffer(data)
      ? new Uint8Array(data)
      : data

  const algo = algorithm ?? 'wyhash'

  switch (algo) {
    case 'wyhash':
      return wyhash(bytes)
    case 'crc32':
      return crc32(bytes)
    case 'adler32':
      return adler32(bytes)
    case 'cityhash32':
      return cityhash32(bytes)
    case 'cityhash64':
      return cityhash64(bytes)
    case 'murmur32v3':
      return murmur32v3(bytes)
    case 'murmur64v2':
      return murmur64v2(bytes)
    default:
      return wyhash(bytes)
  }
}

// Simple hash implementations
function wyhash(data: Uint8Array, seed = 0): bigint {
  let h = BigInt(seed)
  for (let i = 0; i < data.length; i++) {
    h = (h ^ BigInt(data[i])) * BigInt(0x9e3779b97f4a7c15n)
    h = h ^ (h >> BigInt(32))
  }
  return h
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc = crc ^ data[i]
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function adler32(data: Uint8Array): number {
  let a = 1
  let b = 0
  const mod = 65521
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % mod
    b = (b + a) % mod
  }
  return ((b << 16) | a) >>> 0
}

function cityhash32(data: Uint8Array): number {
  // Simplified CityHash32-like implementation
  let h = 0x811c9dc5
  for (let i = 0; i < data.length; i++) {
    h ^= data[i]
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function cityhash64(data: Uint8Array): bigint {
  let h = BigInt(0xcbf29ce484222325n)
  for (let i = 0; i < data.length; i++) {
    h ^= BigInt(data[i])
    h *= BigInt(0x100000001b3n)
  }
  return h
}

function murmur32v3(data: Uint8Array, seed = 0): number {
  let h = seed
  const c1 = 0xcc9e2d51
  const c2 = 0x1b873593

  for (let i = 0; i < data.length; i += 4) {
    let k =
      data[i] |
      ((data[i + 1] ?? 0) << 8) |
      ((data[i + 2] ?? 0) << 16) |
      ((data[i + 3] ?? 0) << 24)
    k = Math.imul(k, c1)
    k = (k << 15) | (k >>> 17)
    k = Math.imul(k, c2)
    h ^= k
    h = (h << 13) | (h >>> 19)
    h = Math.imul(h, 5) + 0xe6546b64
  }

  h ^= data.length
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16

  return h >>> 0
}

function murmur64v2(data: Uint8Array, seed = 0): bigint {
  let h = BigInt(seed) ^ (BigInt(data.length) * BigInt(0xc6a4a7935bd1e995n))
  const m = BigInt(0xc6a4a7935bd1e995n)
  const r = BigInt(47)

  for (let i = 0; i < data.length - 7; i += 8) {
    let k =
      BigInt(data[i]) |
      (BigInt(data[i + 1]) << BigInt(8)) |
      (BigInt(data[i + 2]) << BigInt(16)) |
      (BigInt(data[i + 3]) << BigInt(24)) |
      (BigInt(data[i + 4]) << BigInt(32)) |
      (BigInt(data[i + 5]) << BigInt(40)) |
      (BigInt(data[i + 6]) << BigInt(48)) |
      (BigInt(data[i + 7]) << BigInt(56))

    k *= m
    k ^= k >> r
    k *= m

    h ^= k
    h *= m
  }

  h ^= h >> r
  h *= m
  h ^= h >> r

  return h
}

/**
 * Password hashing utilities
 *
 * WARNING: Real Bun uses bcrypt/argon2 for password hashing.
 * In workerd, we use PBKDF2 with SHA-256 as a reasonable alternative.
 * Hashes are NOT compatible with real Bun's password.hash().
 */
export const password = {
  async hash(
    password: string,
    options?: {
      algorithm?: 'bcrypt' | 'argon2id' | 'argon2d' | 'argon2i'
      cost?: number
    },
  ): Promise<string> {
    const algorithm = options?.algorithm ?? 'bcrypt'
    const cost = options?.cost ?? 10

    // Use PBKDF2 as a workerd-compatible alternative
    const encoder = new TextEncoder()
    const passwordData = encoder.encode(password)

    // Generate a random salt
    const salt = crypto.getRandomValues(new Uint8Array(16))

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordData,
      'PBKDF2',
      false,
      ['deriveBits'],
    )

    // Derive key using PBKDF2
    const iterations = 2 ** cost * 100
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      256,
    )

    // Combine salt + derived key
    const hashArray = new Uint8Array(derivedBits)
    const saltHex = Array.from(salt)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    const hashHex = Array.from(hashArray)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    // Return in format: $workerd$algorithm$cost$salt$hash
    return `$workerd$${algorithm}$${cost}$${saltHex}$${hashHex}`
  },

  async verify(password: string, hash: string): Promise<boolean> {
    // Parse the hash format
    if (!hash.startsWith('$workerd$')) {
      // Try to handle legacy hashes (plain SHA-256)
      const encoder = new TextEncoder()
      const data = encoder.encode(password)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const computed = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
      return computed === hash
    }

    const parts = hash.split('$')
    if (parts.length !== 6) {
      return false
    }

    const [, , _algorithm, costStr, saltHex, expectedHashHex] = parts
    const cost = parseInt(costStr, 10)

    // Recreate the hash with the same parameters
    const encoder = new TextEncoder()
    const passwordData = encoder.encode(password)

    // Parse salt from hex
    const salt = new Uint8Array(
      saltHex.match(/.{2}/g)?.map((byte) => parseInt(byte, 16)) ?? [],
    )

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordData,
      'PBKDF2',
      false,
      ['deriveBits'],
    )

    const iterations = 2 ** cost * 100
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      256,
    )

    const computedHashHex = Array.from(new Uint8Array(derivedBits))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    // Constant-time comparison
    if (computedHashHex.length !== expectedHashHex.length) {
      return false
    }

    let result = 0
    for (let i = 0; i < computedHashHex.length; i++) {
      result |= computedHashHex.charCodeAt(i) ^ expectedHashHex.charCodeAt(i)
    }
    return result === 0
  },
}

// =============================================================================
// Stream Utilities
// =============================================================================

/**
 * Convert a ReadableStream to an array of chunks
 */
export async function readableStreamToArray<T>(
  stream: ReadableStream<T>,
): Promise<T[]> {
  const reader = stream.getReader()
  const chunks: T[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  return chunks
}

/**
 * Convert a ReadableStream to a string
 */
export async function readableStreamToText(
  stream: ReadableStream<Uint8Array>,
): Promise<string> {
  const chunks = await readableStreamToArray(stream)
  const decoder = new TextDecoder()
  return chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join('')
}

/**
 * Convert a ReadableStream to an ArrayBuffer
 */
export async function readableStreamToArrayBuffer(
  stream: ReadableStream<Uint8Array>,
): Promise<ArrayBuffer> {
  const chunks = await readableStreamToArray(stream)
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return result.buffer
}

/**
 * Convert a ReadableStream to a Blob
 */
export async function readableStreamToBlob(
  stream: ReadableStream<Uint8Array>,
  type?: string,
): Promise<Blob> {
  const buffer = await readableStreamToArrayBuffer(stream)
  return new Blob([buffer], { type })
}

/**
 * Convert a ReadableStream to JSON
 */
export async function readableStreamToJSON<T = unknown>(
  stream: ReadableStream<Uint8Array>,
): Promise<T> {
  const text = await readableStreamToText(stream)
  return JSON.parse(text) as T
}

// =============================================================================
// ArrayBufferSink
// =============================================================================

export class ArrayBufferSink {
  private chunks: Uint8Array[] = []

  write(data: string | ArrayBuffer | Uint8Array): void {
    let bytes: Uint8Array
    if (typeof data === 'string') {
      bytes = new TextEncoder().encode(data)
    } else if (data instanceof ArrayBuffer) {
      bytes = new Uint8Array(data)
    } else {
      bytes = data
    }
    this.chunks.push(bytes)
  }

  end(): ArrayBuffer {
    const totalLength = this.chunks.reduce((sum, c) => sum + c.byteLength, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0
    for (const chunk of this.chunks) {
      result.set(chunk, offset)
      offset += chunk.byteLength
    }
    this.chunks = []
    return result.buffer
  }

  flush(): void {
    // No-op for ArrayBufferSink
  }

  start(): void {
    this.chunks = []
  }
}

// =============================================================================
// DNS
// =============================================================================

export const dns = {
  async lookup(
    hostname: string,
    _options?: { family?: 4 | 6 },
  ): Promise<{ address: string; family: 4 | 6 }[]> {
    // In workerd, direct DNS lookups are not available
    // Suggest using fetch() which handles DNS internally
    throw new ERR_WORKERD_UNAVAILABLE(
      'Bun.dns.lookup',
      `DNS lookups for '${hostname}' are not available. Use fetch() which handles DNS internally.`,
    )
  },

  async reverse(ip: string): Promise<string[]> {
    throw new ERR_WORKERD_UNAVAILABLE(
      'Bun.dns.reverse',
      `Reverse DNS lookups for '${ip}' are not available in workerd.`,
    )
  },

  async resolve(hostname: string, _recordType?: string): Promise<string[]> {
    throw new ERR_WORKERD_UNAVAILABLE(
      'Bun.dns.resolve',
      `DNS resolution for '${hostname}' is not available in workerd.`,
    )
  },
}

// =============================================================================
// Miscellaneous
// =============================================================================

/**
 * Check if running as the main module
 */
export const main = (() => {
  if (typeof globalThis === 'undefined') return false
  const proc = (globalThis as Record<string, unknown>).process as
    | { argv?: string[] }
    | undefined
  return proc?.argv?.[1] !== undefined
})()

/**
 * Generate a v4 UUID
 */
export function randomUUIDv7(): string {
  // UUIDv7 includes timestamp for sortability
  const timestamp = Date.now()
  const timestampHex = timestamp.toString(16).padStart(12, '0')
  const random = crypto.getRandomValues(new Uint8Array(10))
  const randomHex = Array.from(random)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return [
    timestampHex.slice(0, 8),
    timestampHex.slice(8, 12),
    `7${randomHex.slice(0, 3)}`, // Version 7
    ((parseInt(randomHex.slice(3, 5), 16) & 0x3f) | 0x80)
      .toString(16)
      .padStart(2, '0') + randomHex.slice(5, 7), // Variant
    randomHex.slice(7, 19),
  ].join('-')
}

/**
 * Peek at a promise without blocking
 *
 * Note: In standard JavaScript, we cannot synchronously peek at promise state.
 * This implementation tracks promise resolution to provide peek-like behavior.
 */
const resolvedPromises = new WeakMap<
  Promise<unknown>,
  { resolved: boolean; value: unknown; error: unknown }
>()

export function peek<T>(promise: Promise<T>): T | Promise<T> {
  // Check if we've already tracked this promise
  const cached = resolvedPromises.get(promise as Promise<unknown>)
  if (cached) {
    if (cached.resolved) {
      if (cached.error !== undefined) {
        throw cached.error
      }
      return cached.value as T
    }
    return promise
  }

  // Start tracking the promise
  const tracker = {
    resolved: false,
    value: undefined as unknown,
    error: undefined as unknown,
  }
  resolvedPromises.set(promise as Promise<unknown>, tracker)

  promise
    .then((value) => {
      tracker.resolved = true
      tracker.value = value
    })
    .catch((error) => {
      tracker.resolved = true
      tracker.error = error
    })

  return promise
}

/**
 * Force garbage collection (no-op in workerd)
 */
export function gc(): void {
  // No-op - GC is handled by the runtime
}

/**
 * Shrink memory (no-op in workerd)
 */
export function shrink(): void {
  // No-op - memory management is handled by the runtime
}

/**
 * Generate heap snapshot (not available in workerd)
 */
export function generateHeapSnapshot(): never {
  throw new Error('generateHeapSnapshot is not available in workerd')
}

/**
 * Open file in editor (not available in workerd)
 */
export function openInEditor(
  _path: string,
  _options?: { line?: number; column?: number },
): never {
  throw new Error('openInEditor is not available in workerd')
}

/**
 * Convert file URL to path
 */
export function fileURLToPath(url: string | URL): string {
  const urlObj = typeof url === 'string' ? new URL(url) : url
  if (urlObj.protocol !== 'file:') {
    throw new Error('URL must use file: protocol')
  }
  return urlObj.pathname
}

/**
 * Convert path to file URL
 */
export function pathToFileURL(path: string): URL {
  return new URL(`file://${path.startsWith('/') ? '' : '/'}${path}`)
}

// =============================================================================
// Default Export
// =============================================================================

export default {
  // File operations
  file,
  write,

  // Server
  serve,
  getServeHandler,

  // Environment
  env,

  // Version
  version,
  revision,

  // Utilities
  sleep,
  sleepSync,
  nanoseconds,
  escapeHTML,
  stringWidth,
  deepEquals,
  inspect,

  // Hashing
  hash,
  password,

  // Streams
  readableStreamToArray,
  readableStreamToText,
  readableStreamToArrayBuffer,
  readableStreamToBlob,
  readableStreamToJSON,
  ArrayBufferSink,

  // DNS
  dns,

  // Misc
  main,
  randomUUIDv7,
  peek,
  gc,
  shrink,
  generateHeapSnapshot,
  openInEditor,
  fileURLToPath,
  pathToFileURL,
}
