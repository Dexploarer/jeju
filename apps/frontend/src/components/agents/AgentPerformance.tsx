/**
 * Agent Performance Component
 */
export interface AgentPerformanceProps {
  agentId: string
  className?: string
}

export function AgentPerformance({ agentId: _agentId, className }: AgentPerformanceProps) {
  return (
    <div className={className}>
      <p className="text-muted-foreground">Agent performance coming soon.</p>
    </div>
  )
}
