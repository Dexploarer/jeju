/**
 * Oracle operator utilities
 * Shared business logic for oracle operator operations
 */

import { find, type OracleOperator } from '../db'

/**
 * Get oracle operator by address
 */
export async function getOracleOperatorByAddress(
  address: string,
): Promise<OracleOperator | null> {
  if (!address || address.trim().length === 0) {
    throw new Error('address is required and must be a non-empty string')
  }

  const normalizedAddress = address.toLowerCase()

  const results = await find<OracleOperator>('OracleOperator', {
    where: { operatorAddress: normalizedAddress },
    take: 1,
  })

  return results[0] ?? null
}
