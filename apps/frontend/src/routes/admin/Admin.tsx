/**
 * Admin Dashboard Page
 *
 * @description Main admin dashboard providing access to various administrative tabs for managing
 * system statistics, game control, fees, users, groups, notifications, reports, AI models,
 * training data, agents, and escrow. Requires admin authentication.
 *
 * @page /admin
 * @access Admin only
 */

import { cn } from '@babylon/shared';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  BarChart,
  Bell,
  Bot,
  Coins,
  Database,
  DollarSign,
  Flag,
  Gamepad2,
  Layers,
  MessageSquare,
  Scale,
  Shield,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AdminManagementTab } from '../../components/admin/AdminManagementTab';
import { AgentsTab } from '../../components/admin/AgentsTab';
import { AIModelsTab } from '../../components/admin/AIModelsTab';
import { EscrowManagementTab } from '../../components/admin/EscrowManagementTab';
import { FeesTab } from '../../components/admin/FeesTab';
import { GameControlTab } from '../../components/admin/GameControlTab';
import { GroupsTab } from '../../components/admin/GroupsTab';
import { HumanReviewTab } from '../../components/admin/HumanReviewTab';
import { NotificationsTab } from '../../components/admin/NotificationsTab';
import { RegistryTab } from '../../components/admin/RegistryTab';
import { ReportsTab } from '../../components/admin/ReportsTab';
import { StatsTab } from '../../components/admin/StatsTab';
import { TradingFeedTab } from '../../components/admin/TradingFeedTab';
import { TrainingDataTab } from '../../components/admin/TrainingDataTab';
import { UserManagementTab } from '../../components/admin/UserManagementTab';
import { PageContainer } from '../../components/shared/PageContainer';
import { Skeleton } from '../../components/shared/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { edenClient } from '../../lib/eden';

/**
 * Available admin dashboard tabs
 */
type Tab =
  | 'stats'
  | 'game-control'
  | 'fees'
  | 'trades'
  | 'users'
  | 'registry'
  | 'groups'
  | 'notifications'
  | 'admins'
  | 'reports'
  | 'human-review'
  | 'ai-models'
  | 'training-data'
  | 'agents'
  | 'escrow'
  | 'ico';

/**
 * Admin Dashboard Component
 */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const { authenticated, ready } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('stats');

  // Check if running on localhost to allow dev access
  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1');

  const { data: isAuthorized, isLoading: loading } = useQuery({
    queryKey: ['admin', 'access'],
    queryFn: async (): Promise<boolean> => {
      if (!authenticated) {
        if (!isLocalhost) {
          navigate('/');
        }
        return false;
      }

      // Check if user is admin by trying to fetch admin stats
      const response = await edenClient.api.admin.stats.get();

      if (response.error) {
        return false;
      }

      return true;
    },
    enabled: ready,
    staleTime: 5 * 60 * 1000, // 5 minutes - admin status doesn't change often
  });

  if (loading) {
    return (
      <PageContainer>
        <div className="flex h-full items-center justify-center">
          <div className="w-full max-w-md space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!isAuthorized) {
    return (
      <PageContainer>
        <div className="flex h-full flex-col items-center justify-center">
          <Shield className="mb-4 h-16 w-16 text-muted-foreground" />
          <h1 className="mb-2 font-bold text-2xl">Access Denied</h1>
          <p className="text-muted-foreground">
            You don&apos;t have permission to access the admin dashboard.
          </p>
        </div>
      </PageContainer>
    );
  }

  const tabs = [
    { id: 'stats' as const, label: 'Dashboard', icon: BarChart },
    { id: 'game-control' as const, label: 'Game Control', icon: Gamepad2 },
    { id: 'fees' as const, label: 'Fees', icon: DollarSign },
    { id: 'trades' as const, label: 'Trading Feed', icon: Activity },
    { id: 'users' as const, label: 'Users', icon: Users },
    { id: 'reports' as const, label: 'Reports', icon: Flag },
    { id: 'human-review' as const, label: 'Human Review', icon: Scale },
    { id: 'admins' as const, label: 'Admins', icon: ShieldCheck },
    { id: 'registry' as const, label: 'Registry', icon: Layers },
    { id: 'groups' as const, label: 'Groups', icon: MessageSquare },
    { id: 'agents' as const, label: 'Agents', icon: Bot },
    { id: 'ai-models' as const, label: 'AI Models', icon: Sparkles },
    { id: 'training-data' as const, label: 'Training Data', icon: Database },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'escrow' as const, label: 'Escrow', icon: DollarSign },
    { id: 'ico' as const, label: 'ICO', icon: Coins, href: '/admin/ico' },
  ];

  return (
    <PageContainer className="flex flex-col">
      {/* Header */}
      <div className="mb-4 border-border border-b pb-4">
        <div className="mb-1 flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="font-bold text-2xl md:text-3xl">Admin Dashboard</h1>
        </div>
        <p className="text-muted-foreground">
          System management and monitoring
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto border-border border-b">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isLink = 'href' in tab && tab.href;

          if (isLink) {
            return (
              <Link
                key={tab.id}
                to={tab.href}
                className={cn(
                  'flex items-center gap-2 whitespace-nowrap px-4 py-2 font-medium transition-colors',
                  '-mb-[1px] border-b-2',
                  'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap px-4 py-2 font-medium transition-colors',
                '-mb-[1px] border-b-2',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'stats' && <StatsTab />}
        {activeTab === 'game-control' && <GameControlTab />}
        {activeTab === 'fees' && <FeesTab />}
        {activeTab === 'trades' && <TradingFeedTab />}
        {activeTab === 'users' && <UserManagementTab />}
        {activeTab === 'reports' && <ReportsTab />}
        {activeTab === 'human-review' && <HumanReviewTab />}
        {activeTab === 'admins' && <AdminManagementTab />}
        {activeTab === 'registry' && <RegistryTab />}
        {activeTab === 'groups' && <GroupsTab />}
        {activeTab === 'agents' && <AgentsTab />}
        {activeTab === 'ai-models' && <AIModelsTab />}
        {activeTab === 'training-data' && <TrainingDataTab />}
        {activeTab === 'notifications' && <NotificationsTab />}
        {activeTab === 'escrow' && <EscrowManagementTab />}
      </div>
    </PageContainer>
  );
}
