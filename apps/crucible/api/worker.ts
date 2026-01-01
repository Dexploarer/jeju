/**
 * Crucible API Worker
 *
 * Agent orchestration platform - workerd-compatible API worker.
 * Handles agent registration, rooms, triggers, and execution.
 *
 * @see https://elysiajs.com/integrations/cloudflare-worker
 */

import { cors } from '@elysiajs/cors'
import {
  CORE_PORTS,
  getCoreAppUrl,
  getCurrentNetwork,
  getLocalhostHost,
  getRpcUrl,
  getSQLitBlockProducerUrl,
} from '@jejunetwork/config'
import { Elysia } from 'elysia'
import { z } from 'zod'

/**
 * Worker Environment Types
 */
export interface CrucibleEnv {
  // Network configuration
  NETWORK: 'localnet' | 'testnet' | 'mainnet'
  RPC_URL: string

  // Service URLs
  DWS_URL: string
  KMS_URL: string
  INDEXER_URL: string

  // Database
  SQLIT_NODES: string
  SQLIT_DATABASE_ID: string

  // KV bindings (optional)
  CRUCIBLE_CACHE?: KVNamespace
}

interface KVNamespace {
  get(key: string): Promise<string | null>
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>
  delete(key: string): Promise<void>
}

/**
 * Create the Crucible Elysia app
 */
export function createCrucibleApp(env?: Partial<CrucibleEnv>) {
  const network = env?.NETWORK ?? getCurrentNetwork()
  const isDev = network === 'localnet'

  const app = new Elysia()
    .use(
      cors({
        origin: isDev
          ? true
          : [
              'https://crucible.jejunetwork.org',
              'https://jejunetwork.org',
              getCoreAppUrl('CRUCIBLE'),
            ],
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'X-API-Key',
          'X-Jeju-Address',
          'X-Jeju-Signature',
        ],
        credentials: true,
      }),
    )

    // Health check
    .get('/health', () => ({
      status: 'ok',
      service: 'crucible-api',
      version: '2.0.0',
      network,
      runtime: 'workerd',
      endpoints: {
        a2a: '/a2a',
        mcp: '/mcp',
        agents: '/api/agents',
        rooms: '/api/rooms',
      },
    }))

    // ============================================
    // Agent Routes
    // ============================================
    .group('/api/agents', (agents) =>
      agents
        .get('/', () => ({ agents: [], message: 'List registered agents' }))
        .get('/:agentId', ({ params }) => ({
          agentId: params.agentId,
          message: 'Agent details',
        }))
        .post('/', async ({ body }) => {
          const parsed = z
            .object({
              name: z.string(),
              description: z.string().optional(),
              characterUri: z.string().optional(),
            })
            .safeParse(body)

          if (!parsed.success) {
            return { error: 'Invalid agent data', details: parsed.error.issues }
          }

          return { success: true, agentId: crypto.randomUUID() }
        })
        .post('/:agentId/start', ({ params }) => ({
          agentId: params.agentId,
          status: 'started',
        }))
        .post('/:agentId/stop', ({ params }) => ({
          agentId: params.agentId,
          status: 'stopped',
        }))
        .post('/:agentId/chat', async ({ params, body }) => {
          const parsed = z.object({ message: z.string() }).safeParse(body)

          if (!parsed.success) {
            return { error: 'Invalid chat request' }
          }

          return {
            agentId: params.agentId,
            response: 'Agent response placeholder',
          }
        }),
    )

    // ============================================
    // Room Routes
    // ============================================
    .group('/api/rooms', (rooms) =>
      rooms
        .get('/', () => ({ rooms: [], message: 'List agent rooms' }))
        .get('/:roomId', ({ params }) => ({
          roomId: params.roomId,
          message: 'Room details',
        }))
        .post('/', async ({ body }) => {
          const parsed = z
            .object({
              name: z.string(),
              description: z.string().optional(),
              agents: z.array(z.string()).optional(),
            })
            .safeParse(body)

          if (!parsed.success) {
            return { error: 'Invalid room data', details: parsed.error.issues }
          }

          return { success: true, roomId: crypto.randomUUID() }
        })
        .post('/:roomId/message', async ({ params, body }) => {
          const parsed = z.object({ content: z.string() }).safeParse(body)

          if (!parsed.success) {
            return { error: 'Invalid message' }
          }

          return { roomId: params.roomId, messageId: crypto.randomUUID() }
        }),
    )

    // ============================================
    // Trigger Routes
    // ============================================
    .group('/api/triggers', (triggers) =>
      triggers
        .get('/', () => ({ triggers: [], message: 'List triggers' }))
        .post('/', async ({ body }) => {
          const parsed = z
            .object({
              type: z.enum(['cron', 'webhook', 'event']),
              agentId: z.string(),
              config: z.record(z.string(), z.unknown()),
            })
            .safeParse(body)

          if (!parsed.success) {
            return { error: 'Invalid trigger data', details: parsed.error.issues }
          }

          return { success: true, triggerId: crypto.randomUUID() }
        }),
    )

    // ============================================
    // A2A Protocol
    // ============================================
    .group('/a2a', (a2a) =>
      a2a
        .get('/', () => ({
          name: 'Crucible',
          description: 'Agent Orchestration Platform',
          version: '2.0.0',
          protocol: 'a2a',
          capabilities: ['agents', 'rooms', 'triggers', 'execution'],
        }))
        .post('/invoke', async ({ body }) => {
          const parsed = z
            .object({
              skill: z.string(),
              params: z.record(z.string(), z.unknown()).optional(),
            })
            .safeParse(body)

          if (!parsed.success) {
            return { error: 'Invalid A2A request', details: parsed.error.issues }
          }

          return { skill: parsed.data.skill, result: 'Skill executed' }
        }),
    )

    // ============================================
    // MCP Protocol
    // ============================================
    .group('/mcp', (mcp) =>
      mcp
        .get('/', () => ({
          name: 'Crucible MCP Server',
          version: '1.0.0',
          tools: [
            {
              name: 'crucible_create_agent',
              description: 'Create a new agent',
              parameters: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                },
                required: ['name'],
              },
            },
            {
              name: 'crucible_chat',
              description: 'Chat with an agent',
              parameters: {
                type: 'object',
                properties: {
                  agentId: { type: 'string' },
                  message: { type: 'string' },
                },
                required: ['agentId', 'message'],
              },
            },
          ],
        }))
        .post('/invoke', async ({ body }) => {
          const parsed = z
            .object({
              tool: z.string(),
              arguments: z.record(z.string(), z.unknown()),
            })
            .safeParse(body)

          if (!parsed.success) {
            return { error: 'Invalid MCP request', details: parsed.error.issues }
          }

          return { tool: parsed.data.tool, result: 'Tool executed' }
        }),
    )

    // ============================================
    // Cron Routes (for scheduled tasks)
    // ============================================
    .group('/api/cron', (cron) =>
      cron
        .post('/agent-tick', () => ({
          status: 'executed',
          message: 'Agent tick processed',
        }))
        .post('/flush-trajectories', () => ({
          status: 'executed',
          message: 'Trajectories flushed',
        }))
        .post('/health-check', () => ({
          status: 'executed',
          message: 'Health check completed',
        })),
    )

  return app
}

/**
 * Default export for workerd
 */
const app = createCrucibleApp()

export default {
  fetch: app.fetch,
}

/**
 * Bun server entry point (for local development)
 */
if (typeof Bun !== 'undefined') {
  const port = process.env.PORT ?? process.env.CRUCIBLE_PORT ?? CORE_PORTS.CRUCIBLE
  const host = getLocalhostHost()

  console.log(`[Crucible Worker] Starting on http://${host}:${port}`)
  console.log(`[Crucible Worker] Network: ${getCurrentNetwork()}`)

  Bun.serve({
    port: Number(port),
    hostname: host,
    fetch: app.fetch,
  })
}
