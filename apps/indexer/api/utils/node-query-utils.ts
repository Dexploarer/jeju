/**
 * Node query utilities
 * Shared utilities for querying nodes
 */

import { find, type NodeStake } from '../db'

export interface NodesQueryOptions {
  active?: boolean
  limit: number
}

/**
 * Get nodes from SQLit with optional filtering
 */
export async function getNodes(
  options: NodesQueryOptions,
): Promise<NodeStake[]> {
  if (typeof options.limit !== 'number' || options.limit <= 0) {
    throw new Error(
      `Invalid limit: ${options.limit}. Must be a positive number.`,
    )
  }

  const where: { isActive?: boolean } = {}
  if (options.active !== undefined) {
    where.isActive = options.active
  }

  return find<NodeStake>('NodeStake', {
    where,
    order: { stakeAmount: 'DESC' },
    take: options.limit,
  })
}
