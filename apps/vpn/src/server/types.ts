/**
 * VPN Server Types
 *
 * Server-specific composite types (imports schema types directly)
 */

import type {
  ContributionState,
  VPNNodeState,
  VPNServerConfig,
  VPNSessionState,
} from './schemas'

export interface VPNServiceContext {
  config: VPNServerConfig
  nodes: Map<string, VPNNodeState>
  sessions: Map<string, VPNSessionState>
  contributions: Map<string, ContributionState>
}
