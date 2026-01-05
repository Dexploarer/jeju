import { getCurrentNetwork, getRpcUrl } from '@jejunetwork/config'
import { type BanCheckConfig, BanChecker } from '@jejunetwork/shared'
import type { Address } from 'viem'
import { z } from 'zod'

// Schema for address extraction from request body
const AddressBodySchema = z
  .object({
    address: z.string().nullable(),
    from: z.string().nullable(),
    sender: z.string().nullable(),
    agentOwner: z.string().nullable(),
  })
  .passthrough() // Allow other fields but only validate address-related ones

// LAZY import config to avoid module-level getCurrentNetwork() calls in DWS context
import { config } from '../config'

// Skip paths that don't need ban checking
const SKIP_PATHS = ['/health', '/info', '/metrics', '/.well-known']

// Create checker lazily - don't initialize at module level
let checker: BanChecker | null = null
let checkerInitialized = false

function getChecker(): BanChecker | null {
  if (checkerInitialized) return checker
  checkerInitialized = true
  
  // Get config lazily at runtime
  const network = getCurrentNetwork()
  const rpcUrl = getRpcUrl(network)
  const banManagerAddress = config.banManagerAddress as Address | undefined
  const moderationMarketplaceAddress = config.moderationMarketplaceAddress as Address | undefined
  
  if (banManagerAddress) {
    const banConfig: BanCheckConfig = {
      banManagerAddress,
      moderationMarketplaceAddress,
      rpcUrl,
      network,
      cacheTtlMs: 30000,
      failClosed: true,
    }
    checker = new BanChecker(banConfig)
  }
  
  return checker
}

interface BanResponse {
  error: string
  message: string
  banType: number | undefined
  caseId: `0x${string}` | null | undefined
  canAppeal: boolean | undefined
}

interface ElysiaContext {
  request: Request
  set: { status?: number | string }
}

/**
 * Elysia middleware that checks ban status
 */
export function banCheckMiddleware() {
  return async (ctx: ElysiaContext): Promise<BanResponse | undefined> => {
    const { request, set } = ctx
    // Skip if no ban manager configured (local dev)
    const banChecker = getChecker()
    if (!banChecker) {
      return undefined
    }

    const url = new URL(request.url)
    const path = url.pathname

    // Skip certain paths
    if (SKIP_PATHS.some((skipPath) => path.startsWith(skipPath))) {
      return undefined
    }

    // Extract address from various sources
    // Note: x-jeju-address header is used (signature verified by ownership check)
    let address: string | null =
      request.headers.get('x-jeju-address') ?? url.searchParams.get('address')

    if (!address) {
      // Try to get from JSON body with schema validation
      const contentType = request.headers.get('content-type') ?? ''
      if (contentType.includes('application/json')) {
        const clonedRequest = request.clone()
        const rawBody = await clonedRequest.json()
        if (rawBody !== null) {
          const parsed = AddressBodySchema.safeParse(rawBody)
          if (parsed.success) {
            address =
              parsed.data.address ??
              parsed.data.from ??
              parsed.data.sender ??
              parsed.data.agentOwner ??
              null
          }
        }
      }
    }

    // No address to check - allow through
    if (!address) {
      return undefined
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return undefined
    }

    const result = await banChecker.checkBan(address as Address)

    if (!result.allowed) {
      set.status = 403
      return {
        error: 'BANNED',
        message:
          result.status?.reason ?? 'User is banned from Crucible services',
        banType: result.status?.banType,
        caseId: result.status?.caseId,
        canAppeal: result.status?.canAppeal,
      }
    }

    return undefined
  }
}
