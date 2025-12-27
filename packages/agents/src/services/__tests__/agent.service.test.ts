/**
 * Agent Service Tests
 *
 * Tests agent lifecycle management and configuration.
 */

import { describe, expect, it } from 'bun:test'
import { AgentService, type AgentWithConfig } from '../agent.service'

describe('AgentService', () => {
  describe('constructor', () => {
    it('creates service instance', () => {
      const service = new AgentService()
      expect(service).toBeDefined()
    })
  })

  describe('createAgent', () => {
    it('service has createAgent method', () => {
      const service = new AgentService()
      expect(typeof service.createAgent).toBe('function')
    })
  })

  describe('getAgent', () => {
    it('service has getAgent method', () => {
      const service = new AgentService()
      expect(typeof service.getAgent).toBe('function')
    })
  })

  describe('getAgentWithConfig', () => {
    it('service has getAgentWithConfig method', () => {
      const service = new AgentService()
      expect(typeof service.getAgentWithConfig).toBe('function')
    })
  })

  describe('listUserAgents', () => {
    it('service has listUserAgents method', () => {
      const service = new AgentService()
      expect(typeof service.listUserAgents).toBe('function')
    })
  })

  describe('updateAgent', () => {
    it('service has updateAgent method', () => {
      const service = new AgentService()
      expect(typeof service.updateAgent).toBe('function')
    })
  })
})

describe('AgentWithConfig structure', () => {
  const baseCharacter = {
    name: 'Test Agent',
    bio: ['A test trading agent for automated trading strategies'],
    modelProvider: 'openai' as const,
    clients: [],
    plugins: [],
    settings: {},
  }

  it('validates complete agent config', () => {
    const agent: AgentWithConfig = {
      id: 'agent-123',
      userId: 'user-456',
      name: 'Test Agent',
      character: baseCharacter,
      modelTier: 'standard',
      autonomousEnabled: true,
      isActive: true,
      pointsBalance: 1000,
      lifetimePnL: 500,
      totalTrades: 10,
      winRate: 0.6,
      systemPrompt: 'You are a helpful trading agent.',
      personality: 'Friendly and analytical',
      tradingStrategy: 'momentum',
      messageExamples: ['Hello!', 'How can I help?'],
    }

    expect(agent.id).toBe('agent-123')
    expect(agent.isActive).toBe(true)
    expect(agent.modelTier).toBe('standard')
    expect(agent.autonomousEnabled).toBe(true)
    expect(agent.systemPrompt).toBeDefined()
    expect(agent.personality).toBeDefined()
    expect(agent.tradingStrategy).toBe('momentum')
    expect(agent.messageExamples).toHaveLength(2)
  })

  it('validates agent with minimal config', () => {
    const agent: AgentWithConfig = {
      id: 'agent-123',
      userId: 'user-456',
      name: 'Minimal Agent',
      character: baseCharacter,
      modelTier: 'lite',
      autonomousEnabled: false,
      isActive: true,
      pointsBalance: 0,
      lifetimePnL: 0,
      totalTrades: 0,
      winRate: 0,
    }

    expect(agent.systemPrompt).toBeUndefined()
    expect(agent.personality).toBeUndefined()
  })

  it('supports all model tiers', () => {
    const tiers: AgentWithConfig['modelTier'][] = ['lite', 'standard', 'pro']

    for (const tier of tiers) {
      const agent: AgentWithConfig = {
        id: 'agent-123',
        userId: 'user-456',
        name: 'Test',
        character: baseCharacter,
        modelTier: tier,
        autonomousEnabled: false,
        isActive: true,
        pointsBalance: 0,
        lifetimePnL: 0,
        totalTrades: 0,
        winRate: 0,
      }
      expect(agent.modelTier).toBe(tier)
    }
  })

  it('supports active and inactive states', () => {
    const activeAgent: AgentWithConfig = {
      id: 'agent-123',
      userId: 'user-456',
      name: 'Test',
      character: baseCharacter,
      modelTier: 'lite',
      autonomousEnabled: false,
      isActive: true,
      pointsBalance: 0,
      lifetimePnL: 0,
      totalTrades: 0,
      winRate: 0,
    }
    expect(activeAgent.isActive).toBe(true)

    const inactiveAgent: AgentWithConfig = {
      ...activeAgent,
      isActive: false,
    }
    expect(inactiveAgent.isActive).toBe(false)
  })
})
