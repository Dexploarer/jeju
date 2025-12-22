/**
 * Agent Detail Page
 *
 * @description Detailed view for a single AI agent, displaying agent profile,
 * chat interface, wallet, logs, performance metrics, and settings.
 *
 * @route /agents/:agentId
 * @access Authenticated (agent owner)
 */

import { cn } from '@babylon/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  ArrowLeft,
  Bot,
  FileText,
  MessageCircle,
  Settings,
  TrendingUp,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { AgentChat } from '@/components/agents/AgentChat';
import { AgentLogs } from '@/components/agents/AgentLogs';
import { AgentPerformance } from '@/components/agents/AgentPerformance';
import { AgentSettings } from '@/components/agents/AgentSettings';
import { AgentWallet } from '@/components/agents/AgentWallet';
import { Avatar } from '@/components/shared/Avatar';
import { PageContainer } from '@/components/shared/PageContainer';
import { Skeleton } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';

interface Agent {
  id: string;
  name: string;
  description?: string;
  profileImageUrl?: string;
  system: string;
  bio?: string[];
  personality?: string;
  tradingStrategy?: string;
  pointsBalance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  totalPointsSpent: number;
  isActive: boolean;
  autonomousEnabled: boolean;
  modelTier: 'free' | 'pro';
  status: string;
  errorMessage?: string;
  lifetimePnL: string;
  totalTrades: number;
  profitableTrades: number;
  winRate: number;
  lastTickAt?: string;
  lastChatAt?: string;
  walletAddress?: string;
  agent0TokenId?: number;
  onChainRegistered: boolean;
  a2aEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AgentDetail() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { authenticated, ready, getAccessToken } = useAuth();

  useEffect(() => {
    if (!agentId) {
      navigate('/agents', { replace: true });
    }
  }, [agentId, navigate]);

  const {
    data: agent,
    isLoading: loading,
    refetch: fetchAgent,
  } = useQuery({
    queryKey: ['agent', agentId],
    queryFn: async () => {
      const token = await getAccessToken();

      if (!token) {
        console.error('No access token available');
        toast.error('Authentication required');
        navigate('/agents');
        throw new Error('No access token available');
      }

      const res = await fetch(`/api/agents/${agentId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        toast.error('Agent not found');
        navigate('/agents');
        throw new Error('Agent not found');
      }

      const data = await res.json();
      return data.agent as Agent;
    },
    enabled: !!agentId && ready && authenticated,
  });

  const handleBalanceUpdate = useCallback(
    (newBalance: number) => {
      queryClient.setQueryData(['agent', agentId], (prev: Agent | undefined) =>
        prev ? { ...prev, pointsBalance: newBalance } : prev
      );
    },
    [queryClient, agentId]
  );

  if (!ready || !authenticated) {
    return (
      <PageContainer>
        <div className="mx-auto max-w-7xl space-y-6 p-4">
          <Skeleton className="h-10 w-32" />
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="mx-auto max-w-7xl space-y-6 p-4">
          <Skeleton className="h-10 w-32" />
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!agent) {
    return (
      <PageContainer>
        <div className="p-4">
          <div className="flex flex-col items-center justify-center rounded-lg border border-[#0066FF]/20 bg-gradient-to-br from-[#0066FF]/10 to-purple-500/10 px-4 py-16">
            <Bot className="mb-4 h-16 w-16 text-muted-foreground" />
            <h3 className="mb-2 font-bold text-2xl">Agent Not Found</h3>
            <p className="mb-6 text-muted-foreground text-sm">
              This agent doesn't exist or you don't have access to it
            </p>
            <Link to="/agents">
              <button className="rounded-lg bg-[#0066FF] px-6 py-2 font-medium text-primary-foreground transition-colors hover:bg-[#2952d9]">
                Back to Agents
              </button>
            </Link>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-7xl space-y-6 p-4">
        {/* Header */}
        <div className="mb-8">
          <Button
            onClick={() => navigate('/agents')}
            variant="ghost"
            className="mb-4 flex items-center gap-3 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back</span>
          </Button>
        </div>

        {/* Agent Info Card */}
        <div className="rounded-lg border border-border bg-card/50 p-6 backdrop-blur">
          <div className="flex items-center gap-4">
            <Avatar
              id={agent.id}
              name={agent.name}
              type="user"
              size="lg"
              src={agent.profileImageUrl}
              imageUrl={agent.profileImageUrl}
            />
            <div>
              <h1 className="mb-1 font-bold text-2xl">{agent.name}</h1>
              {agent.description && (
                <p className="mb-2 text-foreground/80">{agent.description}</p>
              )}
              <div className="flex items-center gap-4 text-sm">
                <span
                  className={
                    agent.autonomousEnabled
                      ? 'text-green-400'
                      : 'text-foreground/80'
                  }
                >
                  {agent.autonomousEnabled ? (
                    <>
                      <Activity className="mr-1 inline h-3 w-3" />
                      Autonomous Active
                    </>
                  ) : (
                    'Autonomous Disabled'
                  )}
                </span>
                <span className="text-foreground">•</span>
                <span className="text-foreground/80 capitalize">
                  {agent.modelTier} Mode
                </span>
                {agent.onChainRegistered && (
                  <>
                    <span className="text-gray-600">•</span>
                    <span className="text-blue-400">
                      Agent0 #{agent.agent0TokenId}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="mt-6 grid grid-cols-2 place-items-center gap-4 border-border border-t pt-6 text-center">
            <div>
              <div className="mb-1 text-muted-foreground text-xs">Balance</div>
              <div className="font-semibold text-xl">
                {agent.pointsBalance} pts
              </div>
            </div>
            <div>
              <div className="mb-1 text-muted-foreground text-xs">P&L</div>
              <div
                className={cn(
                  'font-semibold text-xl',
                  parseFloat(agent.lifetimePnL) >= 0
                    ? 'text-green-600'
                    : 'text-red-600'
                )}
              >
                {parseFloat(agent.lifetimePnL).toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="chat" className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-muted/50">
            <TabsTrigger
              value="chat"
              className="data-[state=active]:bg-[#0066FF] data-[state=active]:text-primary-foreground"
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Chat</span>
            </TabsTrigger>
            <TabsTrigger
              value="performance"
              className="data-[state=active]:bg-[#0066FF] data-[state=active]:text-primary-foreground"
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Performance</span>
            </TabsTrigger>
            <TabsTrigger
              value="logs"
              className="data-[state=active]:bg-[#0066FF] data-[state=active]:text-primary-foreground"
            >
              <FileText className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Logs</span>
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="data-[state=active]:bg-[#0066FF] data-[state=active]:text-primary-foreground"
            >
              <Settings className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
            <TabsTrigger
              value="wallet"
              className="data-[state=active]:bg-[#0066FF] data-[state=active]:text-primary-foreground"
            >
              <Bot className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Wallet</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="chat">
              <AgentChat agent={agent} onBalanceUpdate={handleBalanceUpdate} />
            </TabsContent>

            <TabsContent value="performance">
              <AgentPerformance agent={agent} />
            </TabsContent>

            <TabsContent value="logs">
              <AgentLogs agentId={agent.id} />
            </TabsContent>

            <TabsContent value="settings">
              <AgentSettings agent={agent} onUpdate={fetchAgent} />
            </TabsContent>

            <TabsContent value="wallet">
              <AgentWallet agent={agent} onUpdate={fetchAgent} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </PageContainer>
  );
}
