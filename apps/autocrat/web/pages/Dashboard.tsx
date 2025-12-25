import {
  FileText,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AutocratStatus } from '../components/AutocratStatus'
import { CEOStatus } from '../components/CEOStatus'
import { ProposalCard } from '../components/ProposalCard'
import {
  type AutocratStatus as AutocratStatusType,
  type CEOStatus as CEOStatusType,
  fetchAutocratStatus,
  fetchCEOStatus,
  fetchGovernanceStats,
  fetchOrchestratorStatus,
  fetchProposals,
  type GovernanceStats,
  type OrchestratorStatus,
  type Proposal,
  startOrchestrator,
  stopOrchestrator,
} from '../config/api'

export default function DashboardPage() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [ceoStatus, setCEOStatus] = useState<CEOStatusType | null>(null)
  const [autocratStatus, setAutocratStatus] =
    useState<AutocratStatusType | null>(null)
  const [stats, setStats] = useState<GovernanceStats | null>(null)
  const [orchestrator, setOrchestrator] = useState<OrchestratorStatus | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [orchestratorLoading, setOrchestratorLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [proposalsData, ceo, autocrat, statsData, orch] = await Promise.all([
      fetchProposals(true).catch(() => ({ proposals: [], total: 0 })),
      fetchCEOStatus().catch(() => null),
      fetchAutocratStatus().catch(() => null),
      fetchGovernanceStats().catch(() => null),
      fetchOrchestratorStatus().catch(() => null),
    ])

    setProposals(proposalsData.proposals)
    setCEOStatus(ceo)
    setAutocratStatus(autocrat)
    setStats(statsData)
    setOrchestrator(orch)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleStartOrchestrator = async () => {
    setOrchestratorLoading(true)
    await startOrchestrator().catch(() => null)
    const status = await fetchOrchestratorStatus().catch(() => null)
    setOrchestrator(status)
    setOrchestratorLoading(false)
  }

  const handleStopOrchestrator = async () => {
    setOrchestratorLoading(true)
    await stopOrchestrator().catch(() => null)
    const status = await fetchOrchestratorStatus().catch(() => null)
    setOrchestrator(status)
    setOrchestratorLoading(false)
  }

  const handleRefreshOrchestrator = async () => {
    setOrchestratorLoading(true)
    const status = await fetchOrchestratorStatus().catch(() => null)
    setOrchestrator(status)
    setOrchestratorLoading(false)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <div className="stat-card">
          <span className="stat-label">Proposals</span>
          <div className="stat-value">
            {loading || !stats ? '—' : stats.totalProposals}
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-label">Decisions</span>
          <div className="stat-value">
            {loading || !stats ? '—' : stats.ceo.decisions}
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-label">Approval</span>
          <div className="stat-value">
            {loading || !stats ? '—' : stats.ceo.approvalRate}
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-label">Min Score</span>
          <div className="stat-value">
            {loading || !stats ? '—' : `${stats.parameters.minQualityScore}%`}
          </div>
        </div>
      </div>

      {/* Main Grid - stacks on mobile */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Active Proposals - full width on mobile, 2/3 on desktop */}
        <div className="lg:col-span-2 order-2 lg:order-1">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-base sm:text-lg font-semibold">
              Active Proposals
            </h2>
            <Link
              to="/proposals"
              className="text-xs sm:text-sm hover:underline"
              style={{ color: 'var(--color-primary)' }}
            >
              View all →
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card-static p-3 sm:p-4 animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : proposals.length > 0 ? (
            <div className="space-y-2 sm:space-y-3">
              {proposals.slice(0, 5).map((proposal) => (
                <ProposalCard key={proposal.proposalId} proposal={proposal} />
              ))}
            </div>
          ) : (
            <div
              className="card-static p-6 sm:p-8 text-center"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <FileText size={28} className="mx-auto mb-3 opacity-50" />
              <p className="mb-3 text-sm">No active proposals</p>
              <Link
                to="/create"
                className="btn-primary inline-flex items-center gap-2 text-sm"
              >
                <Plus size={16} />
                Create Proposal
              </Link>
            </div>
          )}
        </div>

        {/* Sidebar - shows first on mobile for quick status view */}
        <div className="space-y-3 sm:space-y-4 order-1 lg:order-2">
          {/* Orchestrator Controls */}
          <div className="card-static p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2 text-sm">
                <Zap size={16} />
                Orchestrator
              </h3>
              <button
                type="button"
                onClick={handleRefreshOrchestrator}
                disabled={orchestratorLoading}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                aria-label="Refresh status"
              >
                <RefreshCw
                  size={14}
                  className={orchestratorLoading ? 'animate-spin' : ''}
                />
              </button>
            </div>

            {orchestrator ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Status</span>
                  <span
                    className={`flex items-center gap-1.5 text-sm font-medium ${
                      orchestrator.running ? 'text-green-600' : 'text-gray-500'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        orchestrator.running ? 'bg-green-500' : 'bg-gray-400'
                      }`}
                    />
                    {orchestrator.running ? 'Running' : 'Stopped'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Cycles</span>
                  <span className="text-sm font-medium">
                    {orchestrator.cycleCount}
                  </span>
                </div>
                {orchestrator.processedProposals !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Processed</span>
                    <span className="text-sm font-medium">
                      {orchestrator.processedProposals}
                    </span>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  {orchestrator.running ? (
                    <button
                      type="button"
                      onClick={handleStopOrchestrator}
                      disabled={orchestratorLoading}
                      className="btn-secondary flex-1 text-sm flex items-center justify-center gap-1.5"
                    >
                      {orchestratorLoading ? (
                        <Loader2 className="animate-spin" size={14} />
                      ) : (
                        <Pause size={14} />
                      )}
                      Stop
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartOrchestrator}
                      disabled={orchestratorLoading}
                      className="btn-primary flex-1 text-sm flex items-center justify-center gap-1.5"
                    >
                      {orchestratorLoading ? (
                        <Loader2 className="animate-spin" size={14} />
                      ) : (
                        <Play size={14} />
                      )}
                      Start
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Unable to fetch status</p>
            )}
          </div>

          <CEOStatus status={ceoStatus} loading={loading} />
          <AutocratStatus status={autocratStatus} loading={loading} />
        </div>
      </div>
    </div>
  )
}
