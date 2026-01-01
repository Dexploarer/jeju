/**
 * Account utilities
 * Shared business logic for account-related operations
 */

import { type Account, find } from '../db'

/**
 * Get account by address from SQLit
 */
export async function getAccountByAddress(
  address: string,
): Promise<Account | null> {
  if (!address || address.trim().length === 0) {
    throw new Error('address is required and must be a non-empty string')
  }

  const normalizedAddress = address.toLowerCase()

  const results = await find<Account>('Account', {
    where: { address: normalizedAddress },
    take: 1,
  })

  return results[0] ?? null
}
