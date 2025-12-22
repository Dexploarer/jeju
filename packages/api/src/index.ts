/**
 * @jejunetwork/api
 *
 * Framework-agnostic API middleware with adapters for Elysia.
 *
 * This package provides:
 * - Authentication (OAuth3, wallet signature, API keys)
 * - Rate limiting with tiered support
 * - Admin role validation
 * - Standardized error handling
 *
 * @example
 * ```typescript
 * import { Elysia } from 'elysia'
 * import {
 *   createElysiaAuth,
 *   simpleRateLimit,
 *   createElysiaErrorHandler,
 * } from '@jejunetwork/api'
 *
 * const app = new Elysia()
 *   .use(createElysiaAuth({
 *     oauth3: { teeAgentUrl: '...', appId: '...' },
 *     walletSignature: { domain: 'example.com' },
 *   }))
 *   .use(simpleRateLimit(100, 60000))
 *   .onError(createElysiaErrorHandler(process.env.NODE_ENV === 'development'))
 *   .get('/protected', ({ address }) => ({ address }))
 * ```
 */

// ============ Auth Module ============

// Core functions
export {
  authenticate,
  constantTimeCompare,
  createWalletAuthMessage,
  extractAuthHeaders,
  parseWalletAuthMessage,
  requireAuth,
  validateAPIKey,
  validateAPIKeyFromHeaders,
  validateOAuth3FromHeaders,
  validateOAuth3Session,
  validateWalletSignature,
  validateWalletSignatureFromHeaders,
  type CombinedAuthConfig,
} from './auth/core.js'

// Types
export {
  AdminRole,
  AuthError,
  AuthErrorCode,
  AuthMethod,
  type AdminUser,
  type AdminValidationResult,
  type APIKeyConfig,
  type APIKeyInfo,
  type APIKeyValidationResult,
  type AuthHeaders,
  type AuthResult,
  type AuthUser,
  type OAuth3Config,
  type OAuth3ValidationResult,
  type WalletSignatureConfig,
  type WalletSignatureValidationResult,
} from './auth/types.js'

// Elysia adapter
export {
  apiKeyAuthPlugin,
  authErrorHandler,
  authPlugin,
  createAuthDerive,
  createAuthGuard,
  createElysiaAuth,
  oauth3AuthPlugin,
  requireAuthMiddleware,
  walletAuthPlugin,
  withAuth,
  type AuthContext,
  type AuthPluginConfig,
} from './auth/elysia.js'

// ============ Rate Limiting Module ============

// Types
export {
  type RateLimitEntry,
  type RateLimiterConfig,
  type RateLimitHeaders,
  type RateLimitResult,
  type RateLimitStore,
  type RateLimitTier,
  RateLimitTiers,
} from './rate-limiting/types.js'

// Core
export {
  createRateLimitHeaders,
  createRateLimitKey,
  extractClientIp,
  getRateLimiter,
  InMemoryRateLimitStore,
  initRateLimiter,
  RateLimiter,
  resetRateLimiter,
} from './rate-limiting/core.js'

// Elysia adapter
export {
  rateLimitPlugin,
  simpleRateLimit,
  tieredRateLimit,
  withRateLimit,
  type RateLimitContext,
  type RateLimitPluginConfig,
} from './rate-limiting/elysia.js'

// ============ Admin Module ============

export {
  type AdminConfig,
  ROLE_HIERARCHY,
} from './admin/types.js'

export {
  createAdminConfig,
  createAdminConfigFromEnv,
  hasPermission,
  isSuperAdmin,
  requireAdmin,
  requireRole,
  validateAdmin,
} from './admin/core.js'

export {
  adminPlugin,
  requireAdminMiddleware,
  requireRoleMiddleware,
  withAdmin,
  withRole,
  type AdminContext,
  type AdminPluginConfig,
} from './admin/elysia.js'

// ============ Error Handling ============

export {
  APIError,
  assert,
  ConflictError,
  createElysiaErrorHandler,
  expectDefined,
  expectValid,
  getStatusCode,
  InternalError,
  NotFoundError,
  sanitizeErrorMessage,
  ServiceUnavailableError,
  toErrorResponse,
  ValidationError,
  type ErrorResponse,
} from './error-handler.js'
