/**
 * Crucible Database - SQLit adapter for agent, room, and message storage
 */

export interface DatabaseConfig {
  endpoint: string
  database: string
  timeout?: number
}

export interface AgentRecord {
  agent_id: string
  name: string
  owner: string
  bot_type?: string
  active?: boolean
  created_at?: string
  updated_at?: string
}

export interface RoomRecord {
  room_id: string
  name: string
  room_type?: string
  owner?: string
  active?: boolean
  created_at?: string
  updated_at?: string
}

export interface MessageRecord {
  id?: string
  room_id: string
  agent_id: string
  content: string
  created_at?: string
}

export interface CreateAgentParams {
  agentId: string
  name: string
  owner: string
  botType?: string
}

export interface CreateRoomParams {
  roomId: string
  name: string
  roomType?: string
  owner?: string
}

export interface CreateMessageParams {
  roomId: string
  agentId: string
  content: string
}

export interface ListAgentsOptions {
  limit?: number
  offset?: number
  owner?: string
}

export interface GetMessagesOptions {
  limit?: number
  offset?: number
}

/**
 * Crucible Database client for SQLit
 */
export class CrucibleDatabase {
  private endpoint: string
  private database: string
  private timeout: number
  private connected = false

  constructor(config: DatabaseConfig) {
    this.endpoint = config.endpoint
    this.database = config.database
    this.timeout = config.timeout ?? 5000
  }

  get isConnected(): boolean {
    return this.connected
  }

  /**
   * Connect to the SQLit database
   * @returns True if connection successful, false otherwise
   */
  async connect(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(`${this.endpoint}/health`, {
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        return false
      }

      // Create tables if they don't exist
      await this.initializeTables()
      this.connected = true
      return true
    } catch {
      this.connected = false
      return false
    }
  }

  private async initializeTables(): Promise<void> {
    const createAgentsTable = `
      CREATE TABLE IF NOT EXISTS agents (
        agent_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner TEXT NOT NULL,
        bot_type TEXT DEFAULT 'ai_agent',
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `

    const createRoomsTable = `
      CREATE TABLE IF NOT EXISTS rooms (
        room_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        room_type TEXT DEFAULT 'chat',
        owner TEXT,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `

    const createMessagesTable = `
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(room_id),
        FOREIGN KEY (agent_id) REFERENCES agents(agent_id)
      )
    `

    await this.exec(createAgentsTable)
    await this.exec(createRoomsTable)
    await this.exec(createMessagesTable)
  }

  /**
   * Execute a SQL statement
   */
  async exec(sql: string, params?: (string | number)[]): Promise<void> {
    const response = await fetch(`${this.endpoint}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        database: this.database,
        sql,
        params: params ?? [],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`SQL execution failed: ${error}`)
    }
  }

  /**
   * Query the database and return rows
   */
  async query<T>(sql: string, params?: (string | number)[]): Promise<T[]> {
    const response = await fetch(`${this.endpoint}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        database: this.database,
        sql,
        params: params ?? [],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`SQL query failed: ${error}`)
    }

    const data = await response.json()
    return data.rows ?? data ?? []
  }

  // Agent Operations

  async createAgent(params: CreateAgentParams): Promise<AgentRecord | null> {
    const sql = `
      INSERT INTO agents (agent_id, name, owner, bot_type)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(agent_id) DO UPDATE SET
        name = excluded.name,
        owner = excluded.owner,
        bot_type = excluded.bot_type,
        updated_at = CURRENT_TIMESTAMP
    `
    await this.exec(sql, [
      params.agentId,
      params.name,
      params.owner,
      params.botType ?? 'ai_agent',
    ])

    return this.getAgent(params.agentId)
  }

  async getAgent(agentId: string): Promise<AgentRecord | null> {
    const sql = 'SELECT * FROM agents WHERE agent_id = ?'
    const rows = await this.query<AgentRecord>(sql, [agentId])
    return rows[0] ?? null
  }

  async updateAgent(
    agentId: string,
    updates: Partial<CreateAgentParams>,
  ): Promise<void> {
    const setClauses: string[] = []
    const params: (string | number)[] = []

    if (updates.name !== undefined) {
      setClauses.push('name = ?')
      params.push(updates.name)
    }
    if (updates.owner !== undefined) {
      setClauses.push('owner = ?')
      params.push(updates.owner)
    }
    if (updates.botType !== undefined) {
      setClauses.push('bot_type = ?')
      params.push(updates.botType)
    }

    if (setClauses.length === 0) return

    setClauses.push('updated_at = CURRENT_TIMESTAMP')
    params.push(agentId)

    const sql = `UPDATE agents SET ${setClauses.join(', ')} WHERE agent_id = ?`
    await this.exec(sql, params)
  }

  async listAgents(options?: ListAgentsOptions): Promise<AgentRecord[]> {
    let sql = 'SELECT * FROM agents'
    const params: (string | number)[] = []

    if (options?.owner) {
      sql += ' WHERE owner = ?'
      params.push(options.owner)
    }

    sql += ' ORDER BY created_at DESC'

    if (options?.limit) {
      sql += ' LIMIT ?'
      params.push(options.limit)
    }

    if (options?.offset) {
      sql += ' OFFSET ?'
      params.push(options.offset)
    }

    return this.query<AgentRecord>(sql, params)
  }

  // Room Operations

  async createRoom(params: CreateRoomParams): Promise<RoomRecord | null> {
    const sql = `
      INSERT INTO rooms (room_id, name, room_type, owner)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(room_id) DO UPDATE SET
        name = excluded.name,
        room_type = excluded.room_type,
        owner = excluded.owner,
        updated_at = CURRENT_TIMESTAMP
    `
    await this.exec(sql, [
      params.roomId,
      params.name,
      params.roomType ?? 'chat',
      params.owner ?? '',
    ])

    return this.getRoom(params.roomId)
  }

  async getRoom(roomId: string): Promise<RoomRecord | null> {
    const sql = 'SELECT * FROM rooms WHERE room_id = ?'
    const rows = await this.query<RoomRecord>(sql, [roomId])
    return rows[0] ?? null
  }

  async listRooms(limit?: number): Promise<RoomRecord[]> {
    let sql = 'SELECT * FROM rooms ORDER BY created_at DESC'
    const params: number[] = []

    if (limit) {
      sql += ' LIMIT ?'
      params.push(limit)
    }

    return this.query<RoomRecord>(sql, params)
  }

  // Message Operations

  async createMessage(
    params: CreateMessageParams,
  ): Promise<MessageRecord | null> {
    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const sql = `
      INSERT INTO messages (id, room_id, agent_id, content)
      VALUES (?, ?, ?, ?)
    `
    await this.exec(sql, [id, params.roomId, params.agentId, params.content])

    const rows = await this.query<MessageRecord>(
      'SELECT * FROM messages WHERE id = ?',
      [id],
    )
    return rows[0] ?? null
  }

  async getMessages(
    roomId: string,
    options?: GetMessagesOptions,
  ): Promise<MessageRecord[]> {
    let sql =
      'SELECT * FROM messages WHERE room_id = ? ORDER BY created_at DESC'
    const params: (string | number)[] = [roomId]

    if (options?.limit) {
      sql += ' LIMIT ?'
      params.push(options.limit)
    }

    if (options?.offset) {
      sql += ' OFFSET ?'
      params.push(options.offset)
    }

    return this.query<MessageRecord>(sql, params)
  }
}




