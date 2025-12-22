/**
 * Crucible Agent Runtime - REAL ElizaOS Integration
 *
 * This is NOT a mock or larp. This uses the actual ElizaOS AgentRuntime with:
 * - Real PGLite database for memory persistence
 * - Real action/provider/evaluator system
 * - Real state composition
 * - DWS for inference (decentralized)
 * - Jeju plugin for network actions
 */

import {
  AgentRuntime,
  type Character,
  type UUID,
  type Memory,
  type IAgentRuntime,
  type Plugin,
  type Content,
  stringToUuid,
} from '@elizaos/core';
import { createDatabaseAdapter } from '@elizaos/plugin-sql';
import { getDWSComputeUrl } from '@jejunetwork/config';
import type { AgentCharacter } from '../types';
import { createLogger, type Logger } from './logger';

const log = createLogger('ElizaRuntime');

// ============================================================================
// DWS Integration (Decentralized Inference)
// ============================================================================

function getDWSEndpoint(): string {
  return process.env.DWS_URL ?? getDWSComputeUrl();
}

export async function checkDWSHealth(): Promise<boolean> {
  const endpoint = getDWSEndpoint();
  const r = await fetch(`${endpoint}/health`, { signal: AbortSignal.timeout(2000) }).catch(() => null);
  return r?.ok ?? false;
}

export async function checkDWSInferenceAvailable(): Promise<{ available: boolean; nodes: number; error?: string }> {
  const endpoint = getDWSEndpoint();
  const r = await fetch(`${endpoint}/compute/nodes/stats`, { signal: AbortSignal.timeout(2000) }).catch(() => null);
  if (!r?.ok) {
    return { available: false, nodes: 0, error: 'DWS not reachable' };
  }
  const stats = (await r.json()) as { inference?: { activeNodes?: number } };
  const activeNodes = stats.inference?.activeNodes ?? 0;
  return {
    available: activeNodes > 0,
    nodes: activeNodes,
    error: activeNodes === 0 ? 'No inference nodes registered. Run: cd apps/dws && bun run inference' : undefined,
  };
}

// ============================================================================
// DWS Model Provider Plugin for ElizaOS
// ============================================================================

/**
 * Creates a DWS-based model provider plugin for ElizaOS
 */
function createDWSModelPlugin(): Plugin {
  return {
    name: 'dws-inference',
    description: 'DWS decentralized inference provider',
    
    // Register model handlers for text generation
    models: {
      TEXT_GENERATION: async (
        _runtime: IAgentRuntime,
        params: { prompt: string; system?: string; temperature?: number; maxTokens?: number }
      ): Promise<string> => {
        const endpoint = getDWSEndpoint();
        const model = 'llama-3.1-8b-instant';

        const messages = [];
        if (params.system) {
          messages.push({ role: 'system', content: params.system });
        }
        messages.push({ role: 'user', content: params.prompt });

        const response = await fetch(`${endpoint}/compute/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages,
            temperature: params.temperature ?? 0.7,
            max_tokens: params.maxTokens ?? 1024,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`DWS inference failed: ${response.status} ${error}`);
        }

        const data = (await response.json()) as {
          choices: Array<{ message: { content: string } }>;
        };
        return data.choices[0]?.message?.content ?? '';
      },
      
      TEXT_SMALL: async (
        runtime: IAgentRuntime,
        params: { prompt: string; system?: string; temperature?: number; maxTokens?: number }
      ): Promise<string> => {
        // Route to same handler
        return runtime.useModel('TEXT_GENERATION', params);
      },
      
      TEXT_LARGE: async (
        runtime: IAgentRuntime,
        params: { prompt: string; system?: string; temperature?: number; maxTokens?: number }
      ): Promise<string> => {
        // Route to same handler
        return runtime.useModel('TEXT_GENERATION', params);
      },
    },
  };
}

// ============================================================================
// Character Conversion
// ============================================================================

/**
 * Convert Crucible character format to ElizaOS Character format
 */
function toElizaCharacter(char: AgentCharacter, agentId: string): Character {
  return {
    id: stringToUuid(agentId),
    name: char.name,
    bio: Array.isArray(char.bio) ? char.bio : [char.bio ?? ''],
    system: char.system,
    topics: char.topics ?? [],
    adjectives: char.adjectives ?? [],
    messageExamples: char.messageExamples ?? [],
    postExamples: char.postExamples ?? [],
    style: {
      all: char.style?.all ?? [],
      chat: char.style?.chat ?? [],
      post: char.style?.post ?? [],
    },
    settings: {
      ...char.settings,
    },
    plugins: [],
  };
}

// ============================================================================
// Runtime Types
// ============================================================================

export interface RuntimeConfig {
  agentId: string;
  character: AgentCharacter;
  logger?: Logger;
  dbPath?: string;
}

export interface RuntimeMessage {
  id: string;
  userId: string;
  roomId: string;
  content: { text: string; source?: string };
  createdAt: number;
}

export interface RuntimeResponse {
  text: string;
  action?: string;
  actions?: Array<{ name: string; params: Record<string, string> }>;
  memoriesUsed?: number;
}

// ============================================================================
// Crucible Agent Runtime (Real ElizaOS Wrapper)
// ============================================================================

/**
 * CrucibleAgentRuntime - Wrapper around REAL ElizaOS AgentRuntime
 *
 * This is NOT a mock. It uses the actual ElizaOS AgentRuntime with:
 * - PGLite database for memory persistence
 * - Real plugin system (actions, providers, evaluators)
 * - Real state composition
 * - DWS for inference
 */
export class CrucibleAgentRuntime {
  private config: RuntimeConfig;
  private log: Logger;
  private elizaRuntime: AgentRuntime | null = null;
  private initialized = false;

  constructor(config: RuntimeConfig) {
    this.config = config;
    this.log = config.logger ?? createLogger(`Runtime:${config.agentId}`);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.log.info('Initializing REAL ElizaOS runtime', { agentId: this.config.agentId });

    // Check DWS availability
    const dwsOk = await checkDWSHealth();
    if (!dwsOk) {
      throw new Error(`DWS not available at ${getDWSEndpoint()}. Start DWS: cd apps/dws && bun run dev`);
    }

    // Check inference nodes
    const inference = await checkDWSInferenceAvailable();
    if (!inference.available) {
      this.log.warn('No inference nodes available', { error: inference.error });
    } else {
      this.log.info('DWS inference available', { nodes: inference.nodes });
    }

    // Convert character to ElizaOS format
    const character = toElizaCharacter(this.config.character, this.config.agentId);

    // Create database adapter (PGLite for local persistence)
    const dataDir = this.config.dbPath ?? `.crucible-data/${this.config.agentId}`;
    const agentUUID = stringToUuid(this.config.agentId);
    
    let adapter;
    try {
      adapter = createDatabaseAdapter({ dataDir }, agentUUID);
      this.log.info('Database adapter created', { dataDir });
    } catch (e) {
      this.log.error('Failed to create database adapter', { error: String(e) });
      throw new Error(`Database adapter creation failed: ${e}`);
    }

    // Load plugins
    const plugins: Plugin[] = [createDWSModelPlugin()];

    // Load jeju plugin
    try {
      const jejuMod = await import('@jejunetwork/eliza-plugin');
      if (jejuMod.jejuPlugin) {
        plugins.push(jejuMod.jejuPlugin);
        this.log.info('Jeju plugin loaded', { actions: jejuMod.jejuPlugin.actions?.length ?? 0 });
      }
    } catch (e) {
      this.log.warn('Jeju plugin not available', { error: String(e) });
    }

    // Create the REAL ElizaOS runtime
    this.elizaRuntime = new AgentRuntime({
      agentId: agentUUID,
      character,
      plugins,
      adapter,
      settings: {
        DWS_URL: getDWSEndpoint(),
        DWS_COMPUTE_URL: getDWSEndpoint() + '/compute',
      },
    });

    // Initialize the runtime (this sets up the database, registers plugins, etc.)
    await this.elizaRuntime.initialize();

    this.log.info('REAL ElizaOS runtime initialized', {
      agentId: this.config.agentId,
      characterName: character.name,
      actions: this.elizaRuntime.actions?.length ?? 0,
      providers: this.elizaRuntime.providers?.length ?? 0,
      evaluators: this.elizaRuntime.evaluators?.length ?? 0,
    });

    this.initialized = true;
  }

  /**
   * Process a message through the REAL ElizaOS pipeline
   */
  async processMessage(message: RuntimeMessage): Promise<RuntimeResponse> {
    if (!this.initialized || !this.elizaRuntime) {
      await this.initialize();
    }

    if (!this.elizaRuntime) {
      throw new Error('Runtime not initialized');
    }

    this.log.info('Processing message via REAL ElizaOS', {
      agentId: this.config.agentId,
      userId: message.userId,
      roomId: message.roomId,
      textLength: message.content.text.length,
    });

    const roomId = stringToUuid(message.roomId);
    const entityId = stringToUuid(message.userId);

    // Create memory for the incoming message
    const incomingMemory: Memory = {
      id: stringToUuid(message.id),
      entityId,
      roomId,
      content: {
        text: message.content.text,
        source: message.content.source ?? 'api',
      } as Content,
      createdAt: message.createdAt,
    };

    // Store the incoming message using ElizaOS's memory system
    await this.elizaRuntime.createMemory(incomingMemory, 'messages');

    // Get recent messages for context using ElizaOS's memory system
    const recentMemories = await this.elizaRuntime.getMemories({
      roomId,
      count: 10,
    });

    // Use ElizaOS's state composition (this calls all providers)
    const state = await this.elizaRuntime.composeState(incomingMemory, ['RECENT_MESSAGES']);

    // Generate response using DWS via the registered model handler
    const systemPrompt = this.buildSystemPrompt();
    const conversationContext = this.buildConversationContext(recentMemories);

    const responseText = await this.elizaRuntime.useModel('TEXT_GENERATION', {
      system: systemPrompt,
      prompt: conversationContext,
    });

    // Extract action if present
    const { action, cleanText } = this.extractAction(responseText);

    // Store the agent's response in memory
    const responseMemory: Memory = {
      id: stringToUuid(crypto.randomUUID()),
      entityId: stringToUuid(this.config.agentId),
      roomId,
      content: {
        text: cleanText,
        action,
        source: 'agent',
      } as Content,
      createdAt: Date.now(),
    };

    await this.elizaRuntime.createMemory(responseMemory, 'messages');

    // Execute action if present (using ElizaOS's action system)
    if (action) {
      await this.executeAction(action, incomingMemory, state);
    }

    // Run evaluators (ElizaOS's evaluation system)
    await this.runEvaluators(incomingMemory, responseMemory, state);

    this.log.info('Generated response via REAL ElizaOS', {
      agentId: this.config.agentId,
      responseLength: cleanText.length,
      action,
      memoriesUsed: recentMemories.length,
    });

    return {
      text: cleanText,
      action,
      actions: action ? [{ name: action, params: {} }] : undefined,
      memoriesUsed: recentMemories.length,
    };
  }

  /**
   * Build system prompt from character
   */
  private buildSystemPrompt(): string {
    const char = this.config.character;
    const parts: string[] = [];

    parts.push(`You are ${char.name}.`);

    if (char.system) {
      parts.push(char.system);
    }

    if (char.bio) {
      const bio = Array.isArray(char.bio) ? char.bio.join(' ') : char.bio;
      parts.push(bio);
    }

    if (char.topics?.length) {
      parts.push(`You are knowledgeable about: ${char.topics.join(', ')}.`);
    }

    if (char.adjectives?.length) {
      parts.push(`Your personality traits: ${char.adjectives.join(', ')}.`);
    }

    if (char.style?.all?.length) {
      parts.push(`Communication style: ${char.style.all.join(' ')}`);
    }

    // Include available actions
    const actions = this.elizaRuntime?.actions ?? [];
    if (actions.length > 0) {
      parts.push('\nYou have access to the following actions:');
      for (const action of actions.slice(0, 15)) {
        parts.push(`- ${action.name}: ${action.description ?? 'No description'}`);
      }
      parts.push('\nWhen you need to take an action, respond with [ACTION:ACTION_NAME] followed by your message.');
    }

    return parts.join('\n\n');
  }

  /**
   * Build conversation context from memories
   */
  private buildConversationContext(memories: Memory[]): string {
    if (memories.length === 0) {
      return 'No previous conversation.';
    }

    const lines: string[] = ['Recent conversation:'];
    for (const mem of memories.slice(-10)) {
      const speaker = mem.entityId === stringToUuid(this.config.agentId) ? this.config.character.name : 'User';
      const text = (mem.content as Content).text ?? '';
      if (text) {
        lines.push(`${speaker}: ${text}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Extract action from response text
   */
  private extractAction(text: string): { action?: string; cleanText: string } {
    const actionMatch = text.match(/\[ACTION:([A-Z_]+)\]/i);
    if (actionMatch) {
      return {
        action: actionMatch[1].toUpperCase(),
        cleanText: text.replace(actionMatch[0], '').trim(),
      };
    }
    return { cleanText: text };
  }

  /**
   * Execute an action using ElizaOS's action system
   */
  private async executeAction(actionName: string, message: Memory, state: unknown): Promise<void> {
    if (!this.elizaRuntime) return;

    const action = this.elizaRuntime.actions?.find(
      (a) => a.name.toUpperCase() === actionName.toUpperCase()
    );

    if (!action) {
      this.log.warn('Action not found in ElizaOS', { actionName });
      return;
    }

    if (!action.handler) {
      this.log.warn('Action has no handler', { actionName });
      return;
    }

    try {
      // Validate action first
      if (action.validate) {
        const isValid = await action.validate(this.elizaRuntime, message);
        if (!isValid) {
          this.log.warn('Action validation failed', { actionName });
          return;
        }
      }

      // Execute the action handler
      await action.handler(this.elizaRuntime, message, state, {}, async () => {});
      this.log.info('Action executed via ElizaOS', { actionName });
    } catch (e) {
      this.log.error('Action execution failed', { actionName, error: String(e) });
    }
  }

  /**
   * Run evaluators using ElizaOS's evaluator system
   */
  private async runEvaluators(message: Memory, response: Memory, state: unknown): Promise<void> {
    if (!this.elizaRuntime) return;

    const evaluators = this.elizaRuntime.evaluators ?? [];
    for (const evaluator of evaluators) {
      try {
        if (evaluator.handler) {
          await evaluator.handler(this.elizaRuntime, message, state, {}, async () => {});
        }
      } catch (e) {
        this.log.warn('Evaluator failed', { name: evaluator.name, error: String(e) });
      }
    }
  }

  /**
   * Get recent memories from a room using ElizaOS's memory system
   */
  async getMemories(roomId: string, count = 10): Promise<Memory[]> {
    if (!this.elizaRuntime) return [];

    try {
      return await this.elizaRuntime.getMemories({
        roomId: stringToUuid(roomId),
        count,
      });
    } catch (e) {
      this.log.warn('Failed to get memories', { error: String(e) });
      return [];
    }
  }

  /**
   * Search memories using ElizaOS's semantic search
   */
  async searchMemories(query: string, count = 5): Promise<Memory[]> {
    if (!this.elizaRuntime) return [];

    try {
      return await this.elizaRuntime.searchMemories({
        query,
        count,
      });
    } catch (e) {
      this.log.warn('Failed to search memories', { error: String(e) });
      return [];
    }
  }

  // ============ Lifecycle ============

  isInitialized(): boolean {
    return this.initialized;
  }

  getAgentId(): string {
    return this.config.agentId;
  }

  getCharacter(): AgentCharacter {
    return this.config.character;
  }

  /**
   * Get the underlying ElizaOS AgentRuntime
   */
  getElizaRuntime(): AgentRuntime | null {
    return this.elizaRuntime;
  }

  hasActions(): boolean {
    return (this.elizaRuntime?.actions?.length ?? 0) > 0;
  }

  getAvailableActions(): Array<{ name: string; description: string }> {
    return (
      this.elizaRuntime?.actions?.map((a) => ({
        name: a.name,
        description: a.description ?? '',
      })) ?? []
    );
  }

  /**
   * Shutdown the runtime
   */
  async shutdown(): Promise<void> {
    if (this.elizaRuntime) {
      await this.elizaRuntime.stop();
      this.elizaRuntime = null;
    }
    this.initialized = false;
    this.log.info('ElizaOS runtime shutdown');
  }
}

/**
 * Create a new Crucible agent runtime
 */
export function createCrucibleRuntime(config: RuntimeConfig): CrucibleAgentRuntime {
  return new CrucibleAgentRuntime(config);
}

// ============================================================================
// Runtime Manager
// ============================================================================

/**
 * Runtime manager for multiple agents
 */
export class CrucibleRuntimeManager {
  private runtimes = new Map<string, CrucibleAgentRuntime>();
  private log = createLogger('RuntimeManager');

  async createRuntime(config: RuntimeConfig): Promise<CrucibleAgentRuntime> {
    if (this.runtimes.has(config.agentId)) {
      return this.runtimes.get(config.agentId)!;
    }

    const runtime = new CrucibleAgentRuntime(config);
    await runtime.initialize();
    this.runtimes.set(config.agentId, runtime);

    this.log.info('Runtime created', { agentId: config.agentId });
    return runtime;
  }

  getRuntime(agentId: string): CrucibleAgentRuntime | undefined {
    return this.runtimes.get(agentId);
  }

  getAllRuntimes(): CrucibleAgentRuntime[] {
    return Array.from(this.runtimes.values());
  }

  async shutdown(): Promise<void> {
    for (const runtime of this.runtimes.values()) {
      await runtime.shutdown();
    }
    this.runtimes.clear();
    this.log.info('All runtimes shut down');
  }
}

export const runtimeManager = new CrucibleRuntimeManager();
