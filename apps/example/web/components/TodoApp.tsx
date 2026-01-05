/**
 * TodoApp Component
 *
 * Todo list with OAuth3 authentication.
 */

import { useJejuAuth } from '@jejunetwork/auth/react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getApiBaseUrl } from '../config'

interface Todo {
  id: string
  title: string
  description: string
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  dueDate: number | null
  createdAt: number
  updatedAt: number
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

function Spinner() {
  return (
    <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
      <title>Loading</title>
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

function PriorityBadge({ priority }: { priority: Todo['priority'] }) {
  const colors = {
    low: 'bg-green-500/20 text-green-400 border-green-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
  }

  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full border ${colors[priority]}`}
    >
      {priority}
    </span>
  )
}

export function TodoApp() {
  const { authenticated, walletAddress, signMessage, loading: authLoading } = useJejuAuth()
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState<Todo['priority']>('medium')

  /**
   * Sign a message and return auth headers
   */
  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (!walletAddress) {
      throw new Error('Wallet not connected')
    }

    const timestamp = Date.now().toString()
    const message = `Authenticate to Example Todo\nAddress: ${walletAddress}\nTimestamp: ${timestamp}`
    const signature = await signMessage(message)

    return {
      'Content-Type': 'application/json',
      'x-jeju-address': walletAddress,
      'x-jeju-timestamp': timestamp,
      'x-jeju-signature': signature,
    }
  }, [walletAddress, signMessage])

  /**
   * Fetch todos from API
   */
  const fetchTodos = useCallback(async () => {
    if (!authenticated) return

    setLoading(true)
    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`${getApiBaseUrl()}/todos`, { headers })
      const data: ApiResponse<Todo[]> = await response.json()

      if (data.success && data.data) {
        setTodos(data.data)
      } else {
        toast.error(data.error ?? 'Failed to fetch todos')
      }
    } catch (err) {
      console.error('Fetch todos error:', err)
      toast.error('Failed to fetch todos')
    } finally {
      setLoading(false)
    }
  }, [authenticated, getAuthHeaders])

  /**
   * Create a new todo
   */
  const createTodo = useCallback(async () => {
    if (!newTitle.trim()) {
      toast.error('Please enter a title')
      return
    }

    setLoading(true)
    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`${getApiBaseUrl()}/todos`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: newTitle.trim(),
          priority: newPriority,
        }),
      })
      const data: ApiResponse<Todo> = await response.json()

      if (data.success && data.data) {
        setTodos((prev) => [data.data!, ...prev])
        setNewTitle('')
        toast.success('Todo created')
      } else {
        toast.error(data.error ?? 'Failed to create todo')
      }
    } catch (err) {
      console.error('Create todo error:', err)
      toast.error('Failed to create todo')
    } finally {
      setLoading(false)
    }
  }, [newTitle, newPriority, getAuthHeaders])

  /**
   * Toggle todo completion
   */
  const toggleTodo = useCallback(
    async (id: string, completed: boolean) => {
      try {
        const headers = await getAuthHeaders()
        const response = await fetch(`${getApiBaseUrl()}/todos/${id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ completed: !completed }),
        })
        const data: ApiResponse<Todo> = await response.json()

        if (data.success && data.data) {
          setTodos((prev) =>
            prev.map((t) => (t.id === id ? data.data! : t)),
          )
        } else {
          toast.error(data.error ?? 'Failed to update todo')
        }
      } catch (err) {
        console.error('Toggle todo error:', err)
        toast.error('Failed to update todo')
      }
    },
    [getAuthHeaders],
  )

  /**
   * Delete a todo
   */
  const deleteTodo = useCallback(
    async (id: string) => {
      try {
        const headers = await getAuthHeaders()
        const response = await fetch(`${getApiBaseUrl()}/todos/${id}`, {
          method: 'DELETE',
          headers,
        })
        const data: ApiResponse<void> = await response.json()

        if (data.success) {
          setTodos((prev) => prev.filter((t) => t.id !== id))
          toast.success('Todo deleted')
        } else {
          toast.error(data.error ?? 'Failed to delete todo')
        }
      } catch (err) {
        console.error('Delete todo error:', err)
        toast.error('Failed to delete todo')
      }
    },
    [getAuthHeaders],
  )

  // Fetch todos when authenticated
  useEffect(() => {
    if (authenticated) {
      fetchTodos()
    } else {
      setTodos([])
    }
  }, [authenticated, fetchTodos])

  // Not authenticated - show connect prompt
  if (!authenticated) {
    return (
      <div className="max-w-xl mx-auto text-center py-20">
        <div className="text-6xl mb-6">📝</div>
        <h2 className="text-2xl font-bold mb-4">Decentralized Todo List</h2>
        <p className="text-gray-400 mb-8">
          Connect your wallet to manage your todos. Your data is stored
          on-chain and secured by Jeju Network.
        </p>
        {authLoading && (
          <div className="flex items-center justify-center gap-3 text-gray-400">
            <Spinner />
            <span>Connecting...</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2">Your Todos</h2>
        <p className="text-gray-400">
          Connected as{' '}
          <span className="font-mono text-emerald-400">
            {walletAddress?.slice(0, 8)}...{walletAddress?.slice(-6)}
          </span>
        </p>
      </div>

      {/* Add Todo Form */}
      <div className="bg-white/5 rounded-xl p-4 mb-6 border border-white/10">
        <div className="flex gap-3">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createTodo()}
            placeholder="What needs to be done?"
            className="flex-1 bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
          />
          <select
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value as Todo['priority'])}
            className="bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500/50"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <button
            type="button"
            onClick={createTodo}
            disabled={loading || !newTitle.trim()}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2.5 rounded-lg font-medium transition-colors"
          >
            {loading ? <Spinner /> : 'Add'}
          </button>
        </div>
      </div>

      {/* Todo List */}
      {loading && todos.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Spinner />
          <span className="ml-3">Loading todos...</span>
        </div>
      ) : todos.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No todos yet</p>
          <p className="text-sm mt-1">Add your first todo above</p>
        </div>
      ) : (
        <div className="space-y-3">
          {todos.map((todo) => (
            <div
              key={todo.id}
              className={`group bg-white/5 rounded-xl p-4 border border-white/10 transition-all ${
                todo.completed ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start gap-4">
                <button
                  type="button"
                  onClick={() => toggleTodo(todo.id, todo.completed)}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                    todo.completed
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'border-gray-500 hover:border-emerald-400'
                  }`}
                >
                  {todo.completed && (
                    <svg className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <h3
                    className={`font-medium ${
                      todo.completed ? 'line-through text-gray-500' : ''
                    }`}
                  >
                    {todo.title}
                  </h3>
                  {todo.description && (
                    <p className="text-sm text-gray-400 mt-1">
                      {todo.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <PriorityBadge priority={todo.priority} />
                    <span className="text-xs text-gray-500">
                      {new Date(todo.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => deleteTodo(todo.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-400 transition-all"
                  title="Delete"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
