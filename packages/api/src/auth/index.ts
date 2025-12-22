/**
 * Auth Module
 *
 * Framework-agnostic authentication with adapters for Elysia.
 *
 * @example
 * // Using core functions directly
 * import { authenticate, validateOAuth3Session } from '@jejunetwork/api/auth/core'
 *
 * // Using Elysia adapter
 * import { authPlugin, createElysiaAuth } from '@jejunetwork/api/auth/elysia'
 */

// Core - framework-agnostic functions
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
} from './core.js'

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
} from './types.js'

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
} from './elysia.js'
