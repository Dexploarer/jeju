/**
 * SQLit Database adapter for Subsquid processor
 * Implements a compatible interface to work with processor.run()
 */

import { getSQLit, type QueryParam, type SQLitClient } from '@jejunetwork/db'

/** Logger interface matching Subsquid's processor logger */
interface ProcessorLogger {
  info(message: string): void
  warn(message: string): void
  error(message: string): void
  debug(message: string): void
}

/** Block header interface */
interface BlockHeader {
  height: number
  hash: string
  timestamp: number
}

/** Block interface for batch context */
interface ProcessorBlock {
  header: BlockHeader
  logs: Array<{ address: string; topics: string[]; data: string }>
  transactions: Array<{ hash: string; from: string; to: string }>
}

/** Batch context passed to transact() */
interface BatchContext {
  log: ProcessorLogger
  blocks: ProcessorBlock[]
  isHead: boolean
}

/** Entity base interface - entities must have an id */
interface EntityBase {
  id: string
}

/** Entity constructor type */
type EntityClass<E> = { new (...args: unknown[]): E; name: string }

/** Find options for queries */
interface FindOptions {
  where?: Record<string, unknown>
  order?: Record<string, 'ASC' | 'DESC'>
  take?: number
  skip?: number
}

/** SQLit Store implementation */
export class SQLitStoreImpl {
  private client: SQLitClient
  private databaseId: string
  private pendingWrites: Map<string, EntityBase[]> = new Map()
  private pendingDeletes: Map<string, string[]> = new Map()

  constructor(client: SQLitClient, databaseId: string) {
    this.client = client
    this.databaseId = databaseId
  }

  async save<E extends EntityBase>(entity: E | E[]): Promise<void> {
    const entities = Array.isArray(entity) ? entity : [entity]
    if (entities.length === 0) return

    for (const e of entities) {
      const tableName = this.getTableName(e.constructor as EntityClass<E>)
      if (!this.pendingWrites.has(tableName)) {
        this.pendingWrites.set(tableName, [])
      }
      this.pendingWrites.get(tableName)?.push(e)
    }
  }

  async insert<E extends EntityBase>(entity: E | E[]): Promise<void> {
    return this.save(entity)
  }

  async upsert<E extends EntityBase>(entity: E | E[]): Promise<void> {
    return this.save(entity)
  }

  async remove<E extends EntityBase>(entity: E | E[]): Promise<void> {
    const entities = Array.isArray(entity) ? entity : [entity]
    if (entities.length === 0) return

    for (const e of entities) {
      const tableName = this.getTableName(e.constructor as EntityClass<E>)
      if (!this.pendingDeletes.has(tableName)) {
        this.pendingDeletes.set(tableName, [])
      }
      this.pendingDeletes.get(tableName)?.push(e.id)
    }
  }

  async find<E extends EntityBase>(
    entityClass: EntityClass<E>,
    options?: FindOptions,
  ): Promise<E[]> {
    const tableName = this.getTableName(entityClass)
    let sql = `SELECT * FROM "${tableName}"`
    const params: QueryParam[] = []

    if (options?.where) {
      const conditions: string[] = []
      for (const [key, value] of Object.entries(options.where)) {
        conditions.push(`"${this.toSnakeCase(key)}" = ?`)
        params.push(this.toQueryParam(value))
      }
      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`
      }
    }

    if (options?.order) {
      const orderClauses: string[] = []
      for (const [key, direction] of Object.entries(options.order)) {
        orderClauses.push(`"${this.toSnakeCase(key)}" ${direction}`)
      }
      sql += ` ORDER BY ${orderClauses.join(', ')}`
    }

    if (options?.take) {
      sql += ` LIMIT ${options.take}`
    }

    if (options?.skip) {
      sql += ` OFFSET ${options.skip}`
    }

    const result = await this.client.query(sql, params, this.databaseId)
    return result.rows as E[]
  }

  async findOne<E extends EntityBase>(
    entityClass: EntityClass<E>,
    options?: FindOptions,
  ): Promise<E | undefined> {
    const results = await this.find(entityClass, { ...options, take: 1 })
    return results[0]
  }

  async get<E extends EntityBase>(
    entityClass: EntityClass<E>,
    id: string,
  ): Promise<E | undefined> {
    const tableName = this.getTableName(entityClass)
    const result = await this.client.query(
      `SELECT * FROM "${tableName}" WHERE id = ? LIMIT 1`,
      [id],
      this.databaseId,
    )
    return result.rows[0] as E | undefined
  }

  async count<E extends EntityBase>(
    entityClass: EntityClass<E>,
    options?: FindOptions,
  ): Promise<number> {
    const tableName = this.getTableName(entityClass)
    let sql = `SELECT COUNT(*) as count FROM "${tableName}"`
    const params: QueryParam[] = []

    if (options?.where) {
      const conditions: string[] = []
      for (const [key, value] of Object.entries(options.where)) {
        conditions.push(`"${this.toSnakeCase(key)}" = ?`)
        params.push(this.toQueryParam(value))
      }
      sql += ` WHERE ${conditions.join(' AND ')}`
    }

    const result = await this.client.query(sql, params, this.databaseId)
    const countRow = result.rows[0] as { count: number } | undefined
    return Number(countRow?.count ?? 0)
  }

  async flush(): Promise<void> {
    // Process deletes first
    for (const [tableName, ids] of this.pendingDeletes.entries()) {
      if (ids.length === 0) continue
      const placeholders = ids.map(() => '?').join(', ')
      await this.client.exec(
        `DELETE FROM "${tableName}" WHERE id IN (${placeholders})`,
        ids,
        this.databaseId,
      )
    }
    this.pendingDeletes.clear()

    // Process writes
    for (const [tableName, entities] of this.pendingWrites.entries()) {
      if (entities.length === 0) continue
      await this.batchUpsert(tableName, entities)
    }
    this.pendingWrites.clear()
  }

  private async batchUpsert(
    tableName: string,
    entities: EntityBase[],
  ): Promise<void> {
    if (entities.length === 0) return

    // Get columns from first entity, excluding functions and private props
    const sample = entities[0] as unknown as Record<string, unknown>
    const columns = Object.keys(sample).filter((k) => {
      if (k === 'constructor' || k.startsWith('_')) return false
      const val = sample[k]
      return typeof val !== 'function'
    })

    // Convert column names to snake_case for DB
    const dbColumns = columns.map((c) => this.toSnakeCase(c))
    const quotedCols = dbColumns.map((c) => `"${c}"`)
    const placeholders = columns.map(() => '?').join(', ')
    const values: QueryParam[] = []
    const valuesClauses: string[] = []

    for (const entity of entities) {
      const entityRecord = entity as unknown as Record<string, unknown>
      valuesClauses.push(`(${placeholders})`)
      for (const col of columns) {
        const val = entityRecord[col]
        values.push(this.toQueryParam(val))
      }
    }

    const updateCols = dbColumns.filter((c) => c !== 'id')
    const updateSet = updateCols.map((c) => `"${c}" = excluded."${c}"`).join(', ')

    const sql = `
      INSERT INTO "${tableName}" (${quotedCols.join(', ')})
      VALUES ${valuesClauses.join(', ')}
      ON CONFLICT (id) DO UPDATE SET ${updateSet}
    `.trim()

    try {
      await this.client.exec(sql, values, this.databaseId)
      console.log(`[SQLitStore] Saved ${entities.length} ${tableName} records`)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      console.error(`[SQLitStore] Failed to save ${tableName}:`, errorMessage)
      // Log the first few values for debugging
      console.error(`[SQLitStore] Columns: ${columns.join(', ')}`)
    }
  }

  private getTableName<E>(entityClass: EntityClass<E>): string {
    const name = entityClass.name || 'unknown'
    return this.toSnakeCase(name)
  }

  private toSnakeCase(str: string): string {
    return str
      .replace(/([a-z\d])([A-Z])/g, '$1_$2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      .toLowerCase()
  }

  private toQueryParam(val: unknown): QueryParam {
    if (val === null || val === undefined) {
      return null
    }
    if (val instanceof Date) {
      return val.toISOString()
    }
    if (typeof val === 'bigint') {
      return val.toString()
    }
    if (typeof val === 'boolean') {
      return val ? 1 : 0
    }
    if (typeof val === 'object') {
      // Handle entity references - extract id if it's an entity
      if ('id' in val && typeof (val as { id: unknown }).id === 'string') {
        return (val as { id: string }).id
      }
      // Handle arrays (like traceAddress)
      if (Array.isArray(val)) {
        return JSON.stringify(val)
      }
      return JSON.stringify(val)
    }
    if (typeof val === 'string' || typeof val === 'number') {
      return val
    }
    return String(val)
  }
}

/** SQLit Database implementation */
export class SQLitDatabase {
  private client: SQLitClient
  private databaseId: string

  constructor(options: { databaseId: string }) {
    this.client = getSQLit()
    this.databaseId = options.databaseId
  }

  async connect(): Promise<number> {
    try {
      await this.client.query('SELECT 1 as test', [], this.databaseId)
      console.log(
        '[SQLitDatabase] Connected to SQLit database:',
        this.databaseId,
      )

      // Get last processed height
      const result = await this.client.query<{ height: number }>(
        'SELECT height FROM _squid_processor_status WHERE id = 1',
        [],
        this.databaseId,
      ).catch(() => ({ rows: [] }))

      return result.rows[0]?.height ?? 0
    } catch (error) {
      console.error('[SQLitDatabase] Connection failed:', error)
      throw error
    }
  }

  async transact(
    from: number,
    to: BatchContext,
    cb: (store: SQLitStoreImpl) => Promise<void>,
  ): Promise<void> {
    const store = new SQLitStoreImpl(this.client, this.databaseId)

    try {
      await cb(store)
      await store.flush()

      if (to.blocks.length > 0) {
        const lastBlock = to.blocks[to.blocks.length - 1]
        to.log.info(
          `Processed blocks ${from}-${lastBlock.header.height}, saved to SQLit`,
        )
      }
    } catch (error) {
      console.error('[SQLitDatabase] Transaction failed:', error)
      throw error
    }
  }

  async advance(height: number): Promise<void> {
    try {
      await this.client.exec(
        `
        CREATE TABLE IF NOT EXISTS _squid_processor_status (
          id INTEGER PRIMARY KEY,
          height INTEGER NOT NULL,
          timestamp TEXT NOT NULL
        )
      `,
        [],
        this.databaseId,
      )

      await this.client.exec(
        `
        INSERT INTO _squid_processor_status (id, height, timestamp)
        VALUES (1, ?, ?)
        ON CONFLICT (id) DO UPDATE SET
          height = excluded.height,
          timestamp = excluded.timestamp
      `,
        [height, new Date().toISOString()],
        this.databaseId,
      )
    } catch (error) {
      console.warn('[SQLitDatabase] Failed to save checkpoint:', error)
    }
  }

  supportsHotBlocks(): boolean {
    return false
  }

  getStore(): SQLitStoreImpl {
    return new SQLitStoreImpl(this.client, this.databaseId)
  }
}
