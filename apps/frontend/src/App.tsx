/**
 * Frontend App Component
 *
 * Main application component with React Router and providers
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { WagmiProvider } from 'wagmi';
import { Layout } from './components/Layout';
import { LoadingSpinner } from './components/shared/LoadingSpinner';
import { wagmiConfig } from './config/wagmi';

// Lazy load pages for better performance
const HomePage = lazy(() => import('./routes/Home'));
const NotFoundPage = lazy(() => import('./routes/NotFound'));
const AdminPage = lazy(() => import('./routes/admin/Admin'));
const AgentsPage = lazy(() => import('./routes/agents/Agents'));
const CreateAgentPage = lazy(() => import('./routes/agents/create/CreateAgent'));
const BettingPage = lazy(() => import('./routes/betting/Betting'));
const LeaderboardPage = lazy(() => import('./routes/leaderboard/Leaderboard'));
const MarketsPage = lazy(() => import('./routes/markets/Markets'));

function PageLoader() {
  return (
    <div className="flex justify-center py-20">
      <LoadingSpinner size="lg" />
    </div>
  );
}

function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 5000,
          },
        },
      })
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Providers>
        <Layout>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Home */}
              <Route path="/" element={<HomePage />} />

              {/* Admin */}
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin/*" element={<AdminPage />} />

              {/* Agents */}
              <Route path="/agents" element={<AgentsPage />} />
              <Route path="/agents/create" element={<CreateAgentPage />} />

              {/* Betting */}
              <Route path="/betting" element={<BettingPage />} />

              {/* Leaderboard */}
              <Route path="/leaderboard" element={<LeaderboardPage />} />

              {/* Markets */}
              <Route path="/markets" element={<MarketsPage />} />
              <Route path="/markets/*" element={<MarketsPage />} />

              {/* 404 */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </Layout>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--background)',
              color: 'var(--foreground)',
              border: '1px solid var(--border)',
            },
          }}
        />
      </Providers>
    </BrowserRouter>
  );
}
