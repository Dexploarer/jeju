/**
 * Agent Chat Component
 */
export interface AgentChatProps {
  agentId: string
  className?: string
}

export function AgentChat({ agentId: _agentId, className }: AgentChatProps) {
  return (
    <div className={className}>
      <p className="text-muted-foreground">Agent chat coming soon.</p>
    </div>
  )
}
