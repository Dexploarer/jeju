/**
 * Admin Module
 *
 * Framework-agnostic admin role validation with Elysia adapter.
 */

// Types
export {
  AdminRole,
  type AdminConfig,
  type AdminUser,
  type AdminValidationResult,
  ROLE_HIERARCHY,
} from './types.js'

// Core
export {
  createAdminConfig,
  createAdminConfigFromEnv,
  hasPermission,
  isSuperAdmin,
  requireAdmin,
  requireRole,
  validateAdmin,
} from './core.js'

// Elysia adapter
export {
  adminPlugin,
  requireAdminMiddleware,
  requireRoleMiddleware,
  withAdmin,
  withRole,
  type AdminContext,
  type AdminPluginConfig,
} from './elysia.js'
