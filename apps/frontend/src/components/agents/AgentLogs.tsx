/**
 * Agent Logs Component
 */
export interface AgentLogsProps {
  agentId: string
  className?: string
}

export function AgentLogs({ agentId: _agentId, className }: AgentLogsProps) {
  return (
    <div className={className}>
      <p className="text-muted-foreground">Agent logs coming soon.</p>
    </div>
  )
}
