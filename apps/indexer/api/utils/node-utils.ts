/**
 * Node utilities
 * Shared business logic for node-related operations
 */

import type { NodeStake } from '../db'

export interface NodeResponse {
  nodeId: string
  operator: string
  stakedToken: string
  stakedAmount: string
  stakedValueUSD: string
  rpcUrl: string
  geographicRegion: number
  isActive: boolean
  isSlashed: boolean
  uptimeScore: string | null
}

/**
 * Map NodeStake database record to API response
 */
export function mapNodeResponse(node: NodeStake): NodeResponse {
  if (!node) {
    throw new Error('NodeStake is required')
  }
  return {
    nodeId: node.id,
    operator: node.operatorId ?? '',
    stakedToken: 'JEJU',
    stakedAmount: node.stakeAmount,
    stakedValueUSD: node.totalRewards,
    rpcUrl: '',
    geographicRegion: 0,
    isActive: node.isActive,
    isSlashed: false,
    uptimeScore: node.uptimeScore?.toString() ?? null,
  }
}
