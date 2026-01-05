/**
 * Example App - Main Application
 *
 * Demonstrates OAuth3 authentication with Jeju Network.
 */

import { OAuth3Provider } from '@jejunetwork/auth/react'
import { JejuAuthButton } from '@jejunetwork/ui/auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Toaster } from 'sonner'
import { getOAuth3Config } from './config'
import { TodoApp } from './components/TodoApp'

function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 5000,
          },
        },
      }),
    [],
  )

  const oauth3Config = useMemo(() => getOAuth3Config(), [])

  return (
    <OAuth3Provider config={oauth3Config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </OAuth3Provider>
  )
}

function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b border-white/10">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📝</span>
          <h1 className="text-xl font-bold text-gradient">Example Todo</h1>
        </div>
        <JejuAuthButton
          appName="Example"
          appIcon="📝"
          variant="default"
        />
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="border-t border-white/10 py-8 mt-auto">
      <div className="container mx-auto px-4 text-center">
        <p className="text-sm text-gray-500">
          Powered by{' '}
          <span className="text-emerald-400 font-medium">Jeju Network</span>
        </p>
        <p className="text-xs text-gray-600 mt-2">
          Built with OAuth3 • SQLit • DWS
        </p>
      </div>
    </footer>
  )
}

export function App() {
  return (
    <Providers>
      <div className="min-h-screen flex flex-col bg-[#0a0a0a] text-white">
        <Header />
        <main className="flex-1 container mx-auto px-4 pt-24 pb-12">
          <TodoApp />
        </main>
        <Footer />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#1f2937',
              color: '#f9fafb',
              border: '1px solid #374151',
              borderRadius: '0.75rem',
            },
          }}
        />
      </div>
    </Providers>
  )
}
