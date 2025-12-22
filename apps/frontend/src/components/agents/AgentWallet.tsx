/**
 * Agent Wallet Component
 */
export interface AgentWalletProps {
  agentId: string
  className?: string
}

export function AgentWallet({ agentId: _agentId, className }: AgentWalletProps) {
  return (
    <div className={className}>
      <p className="text-muted-foreground">Agent wallet coming soon.</p>
    </div>
  )
}
