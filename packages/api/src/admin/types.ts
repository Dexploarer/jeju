/**
 * Admin Types
 */

import type { Address } from 'viem'
import { AdminRole } from '../auth/types.js'

/**
 * Admin user with role information
 */
export interface AdminUser {
  address: Address
  method: string
  sessionId?: string
  permissions?: string[]
  role: AdminRole
}

/**
 * Admin validation result
 */
export interface AdminValidationResult {
  valid: boolean
  admin?: AdminUser
  error?: string
}

/**
 * Admin configuration
 */
export interface AdminConfig {
  /** Map of addresses to their admin roles */
  admins: Map<Address, AdminRole>
  /** Required role for access (if not specified, any admin role works) */
  requiredRole?: AdminRole
}

/**
 * Role hierarchy for permission checks
 */
export const ROLE_HIERARCHY: Record<AdminRole, number> = {
  [AdminRole.SUPER_ADMIN]: 3,
  [AdminRole.ADMIN]: 2,
  [AdminRole.MODERATOR]: 1,
}

export { AdminRole }
