import { Elysia, t } from 'elysia'
import { config } from '../config'

interface AutonomousStatus {
  enabled: boolean
  running?: boolean
  agentCount?: number
  agents?: Array<{
    id: string
    character: string
    lastTick: number
    tickCount: number
  }>
  message?: string
}

interface RegisterAgentRequest {
  characterId: string
  tickIntervalMs?: number
  capabilities?: {
    canChat?: boolean
    canTrade?: boolean
    canVote?: boolean
    canPropose?: boolean
    canStake?: boolean
    a2a?: boolean
    compute?: boolean
  }
}

// Elysia validation schema for register agent request
const RegisterAgentSchema = t.Object({
  characterId: t.String({ minLength: 1 }),
  tickIntervalMs: t.Optional(t.Number({ minimum: 1000 })),
  capabilities: t.Optional(
    t.Object({
      canChat: t.Optional(t.Boolean()),
      canTrade: t.Optional(t.Boolean()),
      canVote: t.Optional(t.Boolean()),
      canPropose: t.Optional(t.Boolean()),
      canStake: t.Optional(t.Boolean()),
      a2a: t.Optional(t.Boolean()),
      compute: t.Optional(t.Boolean()),
    }),
  ),
})

// Simple in-memory store for autonomous agents
// In production, this should be persisted to a database
const autonomousAgents = new Map<
  string,
  {
    id: string
    character: string
    tickIntervalMs: number
    lastTick: number
    tickCount: number
    capabilities: RegisterAgentRequest['capabilities']
  }
>()

let autonomousRunning = false

export function createAutonomousRouter() {
  const router = new Elysia({ prefix: '/autonomous' })

  // Get autonomous status
  router.get('/status', () => {
    const status: AutonomousStatus = {
      enabled: config.autonomousEnabled,
      running: autonomousRunning,
      agentCount: autonomousAgents.size,
      agents: Array.from(autonomousAgents.values()).map((agent) => ({
        id: agent.id,
        character: agent.character,
        lastTick: agent.lastTick,
        tickCount: agent.tickCount,
      })),
    }

    if (!config.autonomousEnabled) {
      status.message =
        'Autonomous mode is disabled. Set AUTONOMOUS_ENABLED=true to enable.'
    }

    return status
  })

  // Start autonomous runner
  router.post('/start', () => {
    if (!config.autonomousEnabled) {
      return {
        success: false,
        error:
          'Autonomous mode is disabled. Set AUTONOMOUS_ENABLED=true to enable.',
      }
    }

    autonomousRunning = true
    return {
      success: true,
      message: 'Autonomous runner started',
      agentCount: autonomousAgents.size,
    }
  })

  // Stop autonomous runner
  router.post('/stop', () => {
    autonomousRunning = false
    return {
      success: true,
      message: 'Autonomous runner stopped',
    }
  })

  // Register agent for autonomous mode
  router.post(
    '/agents',
    async ({ body }) => {
      if (!config.autonomousEnabled) {
        return {
          success: false,
          error:
            'Autonomous mode is disabled. Set AUTONOMOUS_ENABLED=true to enable.',
        }
      }

      const request = body as RegisterAgentRequest
      const agentId = `${request.characterId}-${Date.now()}`
      const tickIntervalMs =
        request.tickIntervalMs ?? config.defaultTickIntervalMs

      autonomousAgents.set(agentId, {
        id: agentId,
        character: request.characterId,
        tickIntervalMs,
        lastTick: Date.now(),
        tickCount: 0,
        capabilities: request.capabilities,
      })

      return {
        success: true,
        agentId,
        message: `Agent ${request.characterId} registered for autonomous mode`,
      }
    },
    {
      body: RegisterAgentSchema,
    },
  )

  // Remove agent from autonomous mode
  router.delete('/agents/:agentId', ({ params }) => {
    const { agentId } = params
    const removed = autonomousAgents.delete(agentId)

    if (!removed) {
      return {
        success: false,
        error: `Agent ${agentId} not found`,
      }
    }

    return {
      success: true,
      message: `Agent ${agentId} removed from autonomous mode`,
    }
  })

  return router
}
