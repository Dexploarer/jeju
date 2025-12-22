/**
 * Agents List Page
 *
 * Displays user's AI agents with filtering and navigation to create/view agents.
 */

import { cn } from '@babylon/shared';
import { useQuery } from '@tanstack/react-query';
import { Activity, Bot, Plus, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LoginButton } from '../../components/auth/LoginButton';
import { Avatar } from '../../components/shared/Avatar';
import { PageContainer } from '../../components/shared/PageContainer';
import { Skeleton } from '../../components/shared/Skeleton';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../hooks/useAuth';
import { edenClient } from '../../lib/eden';

interface Agent {
  id: string;
  name: string;
  description?: string;
  profileImageUrl?: string;
  pointsBalance: number;
  isActive: boolean;
  autonomousEnabled: boolean;
  modelTier: 'free' | 'pro';
  status: string;
  lifetimePnL: string;
  totalTrades: number;
  winRate: number;
  lastTickAt?: string;
  lastChatAt?: string;
  createdAt: string;
}

interface AgentsResponse {
  agents: Agent[];
}

export default function AgentsPage() {
  const { authenticated, ready, getAccessToken } = useAuth();
  const [filter, setFilter] = useState<'all' | 'active' | 'idle'>('all');

  const { data: agents = [], isLoading: loading } = useQuery({
    queryKey: ['agents', filter],
    queryFn: async (): Promise<Agent[]> => {
      const token = await getAccessToken();

      if (!token) {
        throw new Error('No access token available');
      }

      const params: { autonomousTrading?: boolean } = {};
      if (filter === 'active') {
        params.autonomousTrading = true;
      } else if (filter === 'idle') {
        params.autonomousTrading = false;
      }

      const response = await edenClient.api.agents.get({
        query: params,
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.error) {
        throw new Error('Failed to fetch agents');
      }

      const data = response.data as AgentsResponse;
      return data.agents || [];
    },
    enabled: ready && authenticated,
  });

  if (ready && !authenticated) {
    return (
      <PageContainer noPadding className="flex flex-col">
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-md text-center">
            <Bot className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
            <h2 className="mb-2 font-bold text-foreground text-xl">log in</h2>
            <p className="mb-6 text-muted-foreground">
              Sign in to create and manage AI agents that can chat and trade
              autonomously
            </p>
            <LoginButton />
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6 p-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="mb-2 font-bold text-3xl">My Agents</h1>
            <p className="text-muted-foreground">
              Create and manage AI agents that can chat and trade autonomously
            </p>
          </div>
          <Link to="/agents/create">
            <Button className="flex items-center gap-2 bg-[#0066FF] px-4 py-2 text-primary-foreground hover:bg-[#2952d9]">
              <Plus className="h-5 w-5" />
              Create Agent
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              'rounded-full px-4 py-2 font-medium text-sm transition-all',
              filter === 'all'
                ? 'bg-[#0066FF] text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            )}
          >
            All
          </button>
          <button
            onClick={() => setFilter('active')}
            className={cn(
              'rounded-full px-4 py-2 font-medium text-sm transition-all',
              filter === 'active'
                ? 'bg-[#0066FF] text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            )}
          >
            Active
          </button>
          <button
            onClick={() => setFilter('idle')}
            className={cn(
              'rounded-full px-4 py-2 font-medium text-sm transition-all',
              filter === 'idle'
                ? 'bg-[#0066FF] text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            )}
          >
            Idle
          </button>
        </div>

        {/* Agents Grid */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-lg bg-muted/30 p-6">
                <div className="mb-4 flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="mb-2 h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-[#0066FF]/20 bg-gradient-to-br from-[#0066FF]/10 to-purple-500/10 px-4 py-16">
            <Bot className="mb-4 h-16 w-16 text-[#0066FF]" />
            <h3 className="mb-2 font-bold text-2xl">No Agents Yet</h3>
            <p className="mb-6 max-w-md text-center text-muted-foreground text-sm">
              Create your first AI agent to start trading and chatting
            </p>
            <Link to="/agents/create">
              <Button className="flex items-center gap-2 bg-[#0066FF] px-4 py-2 text-primary-foreground hover:bg-[#2952d9]">
                <Plus className="h-5 w-5" />
                Create Agent
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <Link key={agent.id} to={`/agents/${agent.id}`}>
                <div className="cursor-pointer rounded-lg border border-transparent bg-muted/30 p-6 transition-all hover:border-[#0066FF]/30 hover:bg-muted">
                  {/* Header */}
                  <div className="mb-4 flex items-start gap-4">
                    <Avatar
                      id={agent.id}
                      name={agent.name}
                      type="user"
                      size="lg"
                      src={agent.profileImageUrl}
                      imageUrl={agent.profileImageUrl}
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-lg">
                        {agent.name}
                      </h3>
                      <div className="flex items-center gap-2 text-sm">
                        <span
                          className={
                            agent.autonomousEnabled
                              ? 'text-green-400'
                              : 'text-muted-foreground'
                          }
                        >
                          {agent.autonomousEnabled ? (
                            <>
                              <Activity className="mr-1 inline h-3 w-3" />
                              Active
                            </>
                          ) : (
                            'Idle'
                          )}
                        </span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-muted-foreground capitalize">
                          {agent.modelTier}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {agent.description && (
                    <p className="mb-4 line-clamp-2 text-muted-foreground text-sm">
                      {agent.description}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 border-border border-t pt-4">
                    <div>
                      <div className="mb-1 text-muted-foreground text-xs">
                        Balance
                      </div>
                      <div className="font-semibold">
                        {agent.pointsBalance} pts
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-muted-foreground text-xs">
                        P&L
                      </div>
                      <div
                        className={cn(
                          'flex items-center gap-1 font-semibold',
                          parseFloat(agent.lifetimePnL) >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        )}
                      >
                        <TrendingUp className="h-3 w-3" />
                        {parseFloat(agent.lifetimePnL).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-muted-foreground text-xs">
                        Trades
                      </div>
                      <div className="font-semibold">{agent.totalTrades}</div>
                    </div>
                    <div>
                      <div className="mb-1 text-muted-foreground text-xs">
                        Win Rate
                      </div>
                      <div className="font-semibold">
                        {(agent.winRate * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
