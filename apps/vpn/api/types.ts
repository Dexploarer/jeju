/** VPN Server Types */

import type { Address } from 'viem'
import type {
  ContributionState,
  VPNNodeState,
  VPNServerConfig,
  VPNSessionState,
} from './schemas'

export type {
  VPNNodeState,
  VPNServerConfig,
  VPNSessionState,
  ContributionState,
}

/** Per-user contribution settings stored server-side */
export interface UserContributionSettings {
  address: Address
  enabled: boolean
  maxBandwidthPercent: number
  shareCDN: boolean
  shareVPNRelay: boolean
  earningMode: boolean
  updatedAt: number
}

/** Residential proxy / bandwidth sharing status */
export interface BandwidthStatus {
  is_registered: boolean
  is_active: boolean
  node_address?: string
  stake_amount: string
  total_bytes_shared: string
  total_sessions: number
  total_earnings: string
  pending_rewards: string
  current_connections: number
  uptime_score: number
  success_rate: number
  coordinator_connected: boolean
}

/** Residential proxy / bandwidth sharing settings */
export interface BandwidthSettings {
  enabled: boolean
  node_type: string
  max_bandwidth_mbps: number
  max_concurrent_connections: number
  allowed_ports: number[]
  blocked_domains: string[]
  schedule_enabled: boolean
  schedule_start_hour?: number
  schedule_end_hour?: number
}

/** Residential proxy / bandwidth sharing stats */
export interface BandwidthStats {
  bytes_shared_today: string
  bytes_shared_week: string
  bytes_shared_month: string
  sessions_today: number
  sessions_week: number
  avg_session_duration_ms: number
  peak_bandwidth_mbps: number
  earnings_today: string
  earnings_week: string
  earnings_month: string
}

export interface VPNServiceContext {
  config: VPNServerConfig
  nodes: Map<string, VPNNodeState>
  sessions: Map<string, VPNSessionState>
  contributions: Map<string, ContributionState>
  contributionSettings: Map<string, UserContributionSettings>
  // Bandwidth sharing (Grass-style)
  bandwidthStatus?: Map<string, BandwidthStatus>
  bandwidthSettings?: Map<string, BandwidthSettings>
  bandwidthStats?: Map<string, BandwidthStats>
}
