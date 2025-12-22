/**
 * Cron Service
 *
 * Type-safe client for the DWS cron/trigger system.
 * Uses direct fetch with typed responses for reliability.
 */

import type { Address } from 'viem'
import { getDatabase } from '../db/client'
import type { CronJob } from '../types'
import { getNextMidnight } from '../utils'

const CRON_ENDPOINT = process.env.CRON_ENDPOINT || 'http://localhost:4200/cron'
const WEBHOOK_BASE = process.env.WEBHOOK_BASE || 'http://localhost:4500'
const CRON_TIMEOUT = 10000

// ============================================================================
// Types
// ============================================================================

interface Reminder {
  id: string
  todoId: string
  owner: Address
  reminderTime: number
  sent: boolean
  createdAt: number
}

interface CronService {
  scheduleReminder(
    todoId: string,
    owner: Address,
    reminderTime: number,
  ): Promise<Reminder>
  cancelReminder(reminderId: string, owner: Address): Promise<boolean>
  listReminders(owner: Address): Promise<Reminder[]>
  getDueReminders(): Promise<Reminder[]>
  markReminderSent(reminderId: string): Promise<boolean>
  scheduleCleanup(owner: Address): Promise<CronJob>
  isHealthy(): Promise<boolean>
}

// ============================================================================
// Error Types
// ============================================================================

export class CronError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message)
    this.name = 'CronError'
  }
}

// ============================================================================
// Database Row Types
// ============================================================================

interface ReminderRow {
  id: string
  todo_id: string
  owner: string
  reminder_time: number
  sent: number
  created_at: number
}

// ============================================================================
// Typed HTTP Client
// ============================================================================

class CronClient {
  constructor(private baseUrl: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
      signal: AbortSignal.timeout(CRON_TIMEOUT),
    })

    if (!response.ok) {
      throw new CronError(
        `Cron request failed: ${response.status}`,
        response.status,
      )
    }

    return response.json() as Promise<T>
  }

  async register(data: {
    id: string
    type: 'once' | 'cron'
    triggerTime?: number
    expression?: string
    webhook: string
    metadata?: Record<string, string>
  }): Promise<{ success: boolean }> {
    return this.request('/register', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async cancel(id: string): Promise<{ success: boolean }> {
    return this.request('/cancel', {
      method: 'POST',
      body: JSON.stringify({ id }),
    })
  }

  async health(): Promise<{ status: string }> {
    return this.request('/health')
  }
}

// ============================================================================
// Compute Cron Service Implementation
// ============================================================================

class ComputeCronService implements CronService {
  private client: CronClient
  private healthLastChecked = 0
  private healthy = false

  constructor() {
    this.client = new CronClient(CRON_ENDPOINT)
  }

  async scheduleReminder(
    todoId: string,
    owner: Address,
    reminderTime: number,
  ): Promise<Reminder> {
    const id = `reminder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const now = Date.now()

    const db = getDatabase()
    await db.exec(
      `INSERT INTO reminders (id, todo_id, owner, reminder_time, sent, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, todoId, owner.toLowerCase(), reminderTime, 0, now],
    )

    await this.registerCronTrigger(id, reminderTime)

    return { id, todoId, owner, reminderTime, sent: false, createdAt: now }
  }

  async cancelReminder(reminderId: string, owner: Address): Promise<boolean> {
    const db = getDatabase()
    const result = await db.exec(
      'DELETE FROM reminders WHERE id = ? AND owner = ?',
      [reminderId, owner.toLowerCase()],
    )

    if (result.rowsAffected > 0) {
      await this.cancelCronTrigger(reminderId)
    }

    return result.rowsAffected > 0
  }

  async listReminders(owner: Address): Promise<Reminder[]> {
    const db = getDatabase()
    const result = await db.query<ReminderRow>(
      'SELECT * FROM reminders WHERE owner = ? ORDER BY reminder_time ASC',
      [owner.toLowerCase()],
    )

    return result.rows.map((row) => ({
      id: row.id,
      todoId: row.todo_id,
      owner: row.owner as Address,
      reminderTime: row.reminder_time,
      sent: row.sent === 1,
      createdAt: row.created_at,
    }))
  }

  async getDueReminders(): Promise<Reminder[]> {
    const db = getDatabase()
    const now = Date.now()

    const result = await db.query<ReminderRow>(
      'SELECT * FROM reminders WHERE reminder_time <= ? AND sent = 0',
      [now],
    )

    return result.rows.map((row) => ({
      id: row.id,
      todoId: row.todo_id,
      owner: row.owner as Address,
      reminderTime: row.reminder_time,
      sent: row.sent === 1,
      createdAt: row.created_at,
    }))
  }

  async markReminderSent(reminderId: string): Promise<boolean> {
    const db = getDatabase()
    const result = await db.exec('UPDATE reminders SET sent = 1 WHERE id = ?', [
      reminderId,
    ])
    return result.rowsAffected > 0
  }

  async scheduleCleanup(owner: Address): Promise<CronJob> {
    const jobId = `cleanup-${owner.toLowerCase().slice(0, 8)}`

    await this.registerCleanupJob(jobId, owner)

    return {
      id: jobId,
      name: 'Data Cleanup',
      schedule: '0 0 * * *',
      endpoint: `${WEBHOOK_BASE}/webhooks/cleanup`,
      enabled: true,
      lastRun: null,
      nextRun: getNextMidnight(),
    }
  }

  async isHealthy(): Promise<boolean> {
    if (Date.now() - this.healthLastChecked < 30000) {
      return this.healthy
    }

    try {
      await this.client.health()
      this.healthy = true
    } catch {
      this.healthy = false
    }
    this.healthLastChecked = Date.now()
    return this.healthy
  }

  private async registerCronTrigger(
    reminderId: string,
    triggerTime: number,
  ): Promise<void> {
    try {
      await this.client.register({
        id: reminderId,
        type: 'once',
        triggerTime,
        webhook: `${WEBHOOK_BASE}/webhooks/reminder/${reminderId}`,
      })
    } catch (error) {
      console.warn(`Failed to register cron trigger: ${error}`)
    }
  }

  private async cancelCronTrigger(triggerId: string): Promise<void> {
    try {
      await this.client.cancel(triggerId)
    } catch (error) {
      if (!String(error).includes('404')) {
        console.warn(`Failed to cancel cron trigger: ${error}`)
      }
    }
  }

  private async registerCleanupJob(
    jobId: string,
    owner: Address,
  ): Promise<void> {
    try {
      await this.client.register({
        id: jobId,
        type: 'cron',
        expression: '0 0 * * *',
        webhook: `${WEBHOOK_BASE}/webhooks/cleanup`,
        metadata: { owner },
      })
    } catch (error) {
      console.warn(`Failed to register cleanup job: ${error}`)
    }
  }
}

// ============================================================================
// Singleton
// ============================================================================

let cronService: CronService | null = null

export function getCronService(): CronService {
  if (!cronService) {
    cronService = new ComputeCronService()
  }
  return cronService
}

// ============================================================================
// Webhook Handlers
// ============================================================================

export async function handleReminderWebhook(reminderId: string): Promise<void> {
  const cron = getCronService()
  await cron.markReminderSent(reminderId)
  console.log(`Reminder ${reminderId} triggered`)
}

export async function handleCleanupWebhook(): Promise<void> {
  const db = getDatabase()
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000

  await db.exec('DELETE FROM todos WHERE completed = 1 AND updated_at < ?', [
    thirtyDaysAgo,
  ])

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  await db.exec('DELETE FROM reminders WHERE sent = 1 AND created_at < ?', [
    sevenDaysAgo,
  ])

  console.log('Cleanup job completed')
}
