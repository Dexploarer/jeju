/**
 * Transaction utilities
 * Shared business logic for transaction-related operations
 */

import { find, type Transaction } from '../db'

export interface TransactionsQueryOptions {
  limit: number
  offset: number
}

/**
 * Get transactions from SQLit with pagination
 */
export async function getTransactions(
  options: TransactionsQueryOptions,
): Promise<Transaction[]> {
  if (typeof options.limit !== 'number' || options.limit <= 0) {
    throw new Error(
      `Invalid limit: ${options.limit}. Must be a positive number.`,
    )
  }
  if (typeof options.offset !== 'number' || options.offset < 0) {
    throw new Error(
      `Invalid offset: ${options.offset}. Must be a non-negative number.`,
    )
  }

  return find<Transaction>('Transaction', {
    order: { blockNumber: 'DESC' },
    take: options.limit,
    skip: options.offset,
  })
}

/**
 * Get a single transaction by hash
 */
export async function getTransactionByHash(
  hash: string,
): Promise<Transaction | null> {
  if (!hash || hash.trim().length === 0) {
    throw new Error('hash is required and must be a non-empty string')
  }

  const results = await find<Transaction>('Transaction', {
    where: { hash },
    take: 1,
  })

  return results[0] ?? null
}
