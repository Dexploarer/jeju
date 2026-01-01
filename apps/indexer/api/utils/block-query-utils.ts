/**
 * Block query utilities
 * Shared utilities for querying blocks
 */

import { type Block, find } from '../db'

export interface BlocksQueryOptions {
  limit: number
  offset: number
}

/**
 * Get blocks with pagination, ordered by block number descending
 */
export async function getBlocks(options: BlocksQueryOptions): Promise<Block[]> {
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

  return find<Block>('Block', {
    order: { number: 'DESC' },
    take: options.limit,
    skip: options.offset,
  })
}
