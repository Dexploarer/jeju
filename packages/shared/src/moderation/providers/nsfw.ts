/**
 * Image Validation Provider
 *
 * IMPORTANT: This provider only validates image format.
 * Actual CSAM detection requires external API (Hive or AWS Rekognition).
 * Configure HIVE_API_KEY or AWS credentials for real image moderation.
 *
 * nsfwjs/TensorFlow does not work with Bun runtime.
 */

import type { ModerationProvider, ModerationResult } from '../types'

const JPEG = [0xff, 0xd8, 0xff]
const PNG = [0x89, 0x50, 0x4e, 0x47]
const GIF = [0x47, 0x49, 0x46, 0x38]
const WEBP_RIFF = [0x52, 0x49, 0x46, 0x46]
const WEBP_MAGIC = [0x57, 0x45, 0x42, 0x50]

export interface NSFWProviderConfig {
  /** Always flag images for external CSAM verification (default: true) */
  alwaysCheckCsam?: boolean
}

export class NSFWDetectionProvider {
  readonly name: ModerationProvider = 'nsfw_local'
  private alwaysCheckCsam: boolean

  constructor(config: NSFWProviderConfig = {}) {
    this.alwaysCheckCsam = config.alwaysCheckCsam ?? true
  }

  async moderateImage(buf: Buffer): Promise<ModerationResult & { metadata?: { needsCsamCheck: boolean } }> {
    const start = Date.now()

    if (!buf || buf.length < 12) {
      return this.error('Empty or invalid image data', start)
    }

    if (!this.isValidImage(buf)) {
      return this.error('Invalid image format (must be JPEG, PNG, GIF, or WebP)', start)
    }

    // This provider can only validate format.
    // Flag ALL images for external CSAM check via Hive/AWS.
    return {
      safe: true,
      action: 'allow',
      severity: 'none',
      categories: [],
      reviewRequired: false,
      processingTimeMs: Date.now() - start,
      providers: ['nsfw_local'],
      metadata: this.alwaysCheckCsam ? { needsCsamCheck: true } : undefined,
    }
  }

  private isValidImage(buf: Buffer): boolean {
    const match = (sig: number[], offset = 0) => sig.every((b, i) => buf[offset + i] === b)
    return match(JPEG) || match(PNG) || match(GIF) || (match(WEBP_RIFF) && match(WEBP_MAGIC, 8))
  }

  private error(reason: string, start: number): ModerationResult {
    return {
      safe: false,
      action: 'block',
      severity: 'low',
      categories: [],
      blockedReason: reason,
      reviewRequired: false,
      processingTimeMs: Date.now() - start,
      providers: ['nsfw_local'],
    }
  }
}

export function needsCsamVerification(result: ModerationResult): boolean {
  return (result as ModerationResult & { metadata?: { needsCsamCheck?: boolean } }).metadata?.needsCsamCheck === true
}
