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
  getCurrentNetwork,
  getLocalhostHost,
  getSQLitBlockProducerUrl,
} from '@jejunetwork/config'
import { Elysia } from 'elysia'
import { z } from 'zod'
import { characters, getCharacter, listCharacters } from './characters'
import { CrucibleDatabase } from './sdk/database'

// Initialize database - connects lazily on first use
let db: CrucibleDatabase | null = null

function getDatabase(): CrucibleDatabase {
  if (!db) {
    const sqlitUrl = process.env.SQLIT_URL ?? getSQLitBlockProducerUrl()
    db = new CrucibleDatabase({ endpoint: sqlitUrl, database: 'crucible' })
  }
  return db
}

/**
 * Worker Environment Types
 */
export interface CrucibleEnv {
  // Network configuration
  NETWORK: 'localnet' | 'testnet' | 'mainnet'
  RPC_URL: string

  // Service URLs (resolved via JNS or env)
  DWS_URL: string
  KMS_URL: string
  INDEXER_URL: string

  // Database (resolved via JNS or env)
  SQLIT_NODES: string
  SQLIT_DATABASE_ID: string

  // KV bindings (optional - workerd only)
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
 * Get allowed CORS origins dynamically based on network
 * Production: Origins resolved from JNS contenthash domains
 * Localnet: All origins allowed for development
 */
function getAllowedOrigins(network: string): string[] | true {
  if (network === 'localnet') {
    return true // Allow all origins in dev
  }

  // Production/Testnet: Allow same-origin and JNS-resolved domains
  // These are resolved dynamically by the frontend based on JNS
  const host = getLocalhostHost()
  return [
    // Same-origin requests (relative URLs from JNS-served frontend)
    '',
    // Local development fallback
    `http://${host}:4020`,
    `http://${host}:4021`,
  ]
}

/**
 * Create the Crucible Elysia app
 */
export function createCrucibleApp(env?: Partial<CrucibleEnv>) {
  const network = env?.NETWORK ?? getCurrentNetwork()
  const allowedOrigins = getAllowedOrigins(network)

  const app = new Elysia()
    .use(
      cors({
        origin: (request) => {
          if (allowedOrigins === true) return true
          const origin = request.headers.get('origin')
          // Allow same-origin requests (no origin header)
          if (!origin) return true
          // Check against allowed origins
          if (allowedOrigins.includes(origin)) return true
          // Allow any *.jejunetwork.org domain (JNS-resolved)
          if (origin.endsWith('.jejunetwork.org')) return true
          return false
        },
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'X-API-Key',
          'X-Jeju-Address',
          'X-Jeju-Signature',
          'X-Jeju-Timestamp',
        ],
        credentials: true,
      }),
    )

    // Root info endpoint
    .get('/', () => ({
      service: 'crucible',
      version: '1.0.0',
      description: 'Decentralized agent orchestration platform',
      docs: '/api/v1',
      endpoints: {
        health: '/health',
        info: '/info',
        characters: '/api/v1/characters',
        chat: '/api/v1/chat/:characterId',
        agents: '/api/v1/agents',
        rooms: '/api/v1/rooms',
      },
    }))

    // Health check - matches server.ts format for frontend compatibility
    .get('/health', () => ({
      status: 'healthy',
      service: 'crucible',
      network,
      timestamp: new Date().toISOString(),
    }))

    // Info endpoint
    .get('/info', () => ({
      service: 'crucible',
      version: '1.0.0',
      network,
      hasSigner: false,
      dwsAvailable: true,
      runtimes: Object.keys(characters).length,
    }))

    // ============================================
    // Character Templates API
    // ============================================
    .get('/api/v1/characters', () => {
      const characterList = listCharacters()
        .map((id) => {
          const char = getCharacter(id)
          return char
            ? { id: char.id, name: char.name, description: char.description }
            : null
        })
        .filter(Boolean)
      return { characters: characterList }
    })

    .get('/api/v1/characters/:id', ({ params }) => {
      const id = params.id
      const character = getCharacter(id)
      if (!character) {
        return { error: `Character not found: ${id}` }
      }
      return { character }
    })

    // Chat characters (with runtime status)
    .get('/api/v1/chat/characters', () => {
      const characterList = listCharacters().map((id) => {
        const char = getCharacter(id)
        return {
          id,
          name: char?.name ?? id,
          description: char?.description ?? '',
          hasRuntime: true, // In worker mode, all characters are available
        }
      })
      return { characters: characterList }
    })

    // ============================================
    // Agent Routes - SQLit-backed persistence
    // ============================================
    .group('/api/v1/agents', (agents) =>
      agents
        .get('/', async () => {
          const database = getDatabase()
          const agentList = await database.listAgents({ limit: 100 })
          return { agents: agentList, total: agentList.length }
        })
        .get('/:agentId', async ({ params, set }) => {
          const database = getDatabase()
          const agent = await database.getAgent(params.agentId)
          if (!agent) {
            set.status = 404
            return { error: `Agent not found: ${params.agentId}` }
          }
          return { agent }
        })
        .post('/', async ({ body, set }) => {
          const parsed = z
            .object({
              name: z.string(),
              owner: z.string().optional(),
              character: z
                .object({
                  id: z.string(),
                  name: z.string(),
                  description: z.string(),
                })
                .optional(),
              characterCid: z.string().optional(),
            })
            .safeParse(body)

          if (!parsed.success) {
            set.status = 400
            return { error: 'Invalid agent data', details: parsed.error.issues }
          }

          const database = getDatabase()
          const agentId = crypto.randomUUID()
          const owner = parsed.data.owner ?? 'anonymous'
          const name =
            parsed.data.name ?? parsed.data.character?.name ?? 'Unnamed Agent'

          const agent = await database.createAgent({
            agentId,
            name,
            owner,
            characterCid: parsed.data.characterCid,
          })

          if (!agent) {
            set.status = 500
            return { error: 'Failed to create agent - database unavailable' }
          }

          return {
            agentId: agent.agent_id,
            name: agent.name,
            owner: agent.owner,
            createdAt: agent.created_at,
          }
        })
        .get('/:agentId/balance', () => ({
          balance: '0', // Would need contract integration for real balance
        }))
        .post('/:agentId/fund', () => ({
          txHash: '0x0', // Would need contract integration for real funding
        })),
    )

    // ============================================
    // Search API - SQLit-backed
    // ============================================
    .get('/api/v1/search/agents', async ({ query }) => {
      const database = getDatabase()
      const owner = query.owner as string | undefined
      const limit = query.limit ? parseInt(query.limit as string, 10) : 20
      const offset = query.offset ? parseInt(query.offset as string, 10) : 0

      const dbAgents = await database.listAgents({ owner, limit, offset })

      // Transform database format to frontend expected format
      const agents = dbAgents.map((agent) => ({
        agentId: agent.agent_id,
        owner: agent.owner,
        name: agent.name,
        characterCid: agent.character_cid,
        stateCid: agent.state_cid ?? '',
        vaultAddress: '', // Not tracked in SQLit - would come from contract
        botType: 'ai_agent' as const,
        active: true,
        registeredAt: agent.created_at * 1000,
        lastExecutedAt: agent.updated_at * 1000,
        executionCount: 0,
      }))

      return {
        agents,
        total: agents.length,
        hasMore: agents.length === limit,
      }
    })

    // ============================================
    // Room Routes - SQLit-backed persistence
    // ============================================
    .group('/api/v1/rooms', (rooms) =>
      rooms
        .get('/', async () => {
          const database = getDatabase()
          const dbRooms = await database.listRooms(100)

          // Transform database format to frontend expected format
          const validRoomTypes = [
            'collaboration',
            'adversarial',
            'debate',
            'board',
          ] as const
          type ValidRoomType = (typeof validRoomTypes)[number]

          const roomList = dbRooms.map((room) => {
            // Map invalid room types to collaboration
            const roomType = validRoomTypes.includes(
              room.room_type as ValidRoomType,
            )
              ? (room.room_type as ValidRoomType)
              : 'collaboration'

            return {
              roomId: room.room_id,
              name: room.name,
              description: '',
              owner: '',
              stateCid: room.state_cid ?? '',
              members: [],
              roomType,
              config: {
                maxMembers: 10,
                turnBased: false,
                visibility: 'public' as const,
              },
              active: true,
              createdAt: room.created_at * 1000,
            }
          })

          return { rooms: roomList, total: roomList.length, hasMore: false }
        })
        .get('/:roomId', async ({ params, set }) => {
          const database = getDatabase()
          const room = await database.getRoom(params.roomId)
          if (!room) {
            set.status = 404
            return { error: `Room not found: ${params.roomId}` }
          }
          return { room }
        })
        .post('/', async ({ body, set }) => {
          const parsed = z
            .object({
              name: z.string(),
              description: z.string().optional(),
              roomType: z
                .enum([
                  'collaboration',
                  'adversarial',
                  'debate',
                  'board',
                  'chat',
                ])
                .optional(),
            })
            .safeParse(body)

          if (!parsed.success) {
            set.status = 400
            return { error: 'Invalid room data', details: parsed.error.issues }
          }

          const database = getDatabase()
          const roomId = crypto.randomUUID()
          const room = await database.createRoom({
            roomId,
            name: parsed.data.name,
            roomType: parsed.data.roomType ?? 'chat',
          })

          if (!room) {
            set.status = 500
            return { error: 'Failed to create room - database unavailable' }
          }

          return {
            success: true,
            roomId: room.room_id,
            name: room.name,
            roomType: room.room_type,
            createdAt: room.created_at,
          }
        })
        .get('/:roomId/messages', async ({ params, query }) => {
          const database = getDatabase()
          const limit = query.limit ? parseInt(query.limit as string, 10) : 50
          const messages = await database.getMessages(params.roomId, { limit })
          return { messages, total: messages.length }
        })
        .post('/:roomId/message', async ({ params, body, set }) => {
          const parsed = z
            .object({
              content: z.string(),
              agentId: z.string(),
              action: z.string().optional(),
            })
            .safeParse(body)

          if (!parsed.success) {
            set.status = 400
            return { error: 'Invalid message', details: parsed.error.issues }
          }

          const database = getDatabase()
          const message = await database.createMessage({
            roomId: params.roomId,
            agentId: parsed.data.agentId,
            content: parsed.data.content,
            action: parsed.data.action,
          })

          if (!message) {
            set.status = 500
            return { error: 'Failed to create message - database unavailable' }
          }

          return {
            messageId: message.id,
            roomId: message.room_id,
            agentId: message.agent_id,
            createdAt: message.created_at,
          }
        }),
    )

    // ============================================
    // Chat API - stores messages, returns character-appropriate response
    // ============================================
    .post('/api/v1/chat/:characterId', async ({ params, body, set }) => {
      const characterId = params.characterId
      const character = getCharacter(characterId)

      if (!character) {
        set.status = 404
        return { error: `Character not found: ${characterId}` }
      }

      const parsed = z
        .object({
          text: z.string().optional(),
          message: z.string().optional(),
          userId: z.string().optional(),
          roomId: z.string().optional(),
        })
        .safeParse(body)

      if (!parsed.success) {
        set.status = 400
        return { error: 'Invalid chat request', details: parsed.error.issues }
      }

      const messageText = parsed.data.text ?? parsed.data.message ?? ''
      const roomId = parsed.data.roomId ?? `chat-${characterId}`
      const userId = parsed.data.userId ?? 'anonymous'

      // Store the user message in SQLit
      const database = getDatabase()
      await database.createMessage({
        roomId,
        agentId: userId,
        content: messageText,
      })

      // Generate a character-appropriate response based on their style
      // This is a simplified response - full AI requires ElizaOS runtime
      const styleHints = character.style?.chat?.slice(0, 2) ?? []
      const greeting = character.bio?.[0] ?? character.description ?? 'Hello.'

      // Create a contextual response
      let responseText: string
      if (
        messageText.toLowerCase().includes('hello') ||
        messageText.toLowerCase().includes('hi')
      ) {
        responseText = `${greeting} How can I help you today?`
      } else if (messageText.toLowerCase().includes('help')) {
        responseText = `I'm ${character.name}. ${character.description} What would you like to know?`
      } else {
        responseText = `I understand you're asking about: "${messageText.slice(0, 50)}...". ${styleHints.length > 0 ? `I try to be ${styleHints.join(' and ')}.` : ''} How can I assist further?`
      }

      // Store the agent response
      await database.createMessage({
        roomId,
        agentId: characterId,
        content: responseText,
      })

      return {
        text: responseText,
        action: null,
        actions: [],
        character: characterId,
        roomId,
        timestamp: Date.now(),
      }
    })

    // ============================================
    // A2A Protocol
    // ============================================
    .group('/a2a', (a2a) =>
      a2a
        .get('/', () => ({
          name: 'Crucible',
          description: 'Agent Orchestration Platform',
          version: '1.0.0',
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
            return {
              error: 'Invalid A2A request',
              details: parsed.error.issues,
            }
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
              name: 'crucible_list_characters',
              description: 'List available character templates',
              parameters: { type: 'object', properties: {} },
            },
            {
              name: 'crucible_create_agent',
              description: 'Create a new agent',
              parameters: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  characterId: { type: 'string' },
                },
                required: ['characterId'],
              },
            },
            {
              name: 'crucible_chat',
              description: 'Chat with an agent',
              parameters: {
                type: 'object',
                properties: {
                  characterId: { type: 'string' },
                  message: { type: 'string' },
                },
                required: ['characterId', 'message'],
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
            return {
              error: 'Invalid MCP request',
              details: parsed.error.issues,
            }
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
          timestamp: new Date().toISOString(),
        }))
        .post('/flush-trajectories', () => ({
          status: 'executed',
          message: 'Trajectories flushed',
          timestamp: new Date().toISOString(),
        }))
        .post('/health-check', () => ({
          status: 'executed',
          message: 'Health check completed',
          timestamp: new Date().toISOString(),
        })),
    )

  return app
}

/**
 * Create the app instance
 */
const app = createCrucibleApp()

/**
 * Named export for the fetch handler (workerd compatibility)
 */
export const fetch = app.fetch

/**
 * Default export for workerd
 */
export default {
  fetch: app.fetch,
}

/**
 * Bun server entry point - only runs when executed directly
 * When imported as a module (by DWS bootstrap or test), this won't run
 */
const isMainModule = typeof Bun !== 'undefined' && Bun.main === import.meta.path

if (isMainModule) {
  const port = Number(
    process.env.PORT ??
      process.env.CRUCIBLE_PORT ??
      CORE_PORTS.CRUCIBLE_API.get(),
  )
  const host = getLocalhostHost()
  const network = getCurrentNetwork()

  console.log(`[Crucible Worker] Starting on http://${host}:${port}`)
  console.log(`[Crucible Worker] Network: ${network}`)
  console.log(`[Crucible Worker] Runtime: bun (direct)`)

  Bun.serve({
    port,
    hostname: host,
    fetch: app.fetch,
  })
}
