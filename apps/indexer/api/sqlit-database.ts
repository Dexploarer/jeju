/**
 * SQLit Database adapter for Subsquid processor
 * Implements the Database interface to work with processor.run()
 */

import { getSQLit, type SQLitClient } from '@jejunetwork/db'
import type { Database, Store } from '@subsquid/typeorm-store'

interface BatchContext {
  log: any
  blocks: any[]
  isHead: boolean
}

export class SQLitDatabase implements Database<Store> {
  private client: SQLitClient
  private databaseId: string

  constructor(options: { databaseId: string }) {
    this.client = getSQLit()
    this.databaseId = options.databaseId
  }

  async connect(): Promise<number> {
    // Check if database exists and is accessible
    try {
      const result = await this.client.query(
        'SELECT 1 as test',
        [],
        this.databaseId
      )
      console.log('[SQLitDatabase] Connected to SQLit database:', this.databaseId)
      return 0 // Return the last processed block height
    } catch (error) {
      console.error('[SQLitDatabase] Connection failed:', error)
      throw error
    }
  }

  async transact(
    from: number,
    to: BatchContext,
    cb: (store: Store) => Promise<void>
  ): Promise<void> {
    const store = new SQLitStoreImpl(this.client, this.databaseId)

    try {
      // Execute the callback with our store
      await cb(store)

      // Flush all pending writes
      await store.flush()

      if (to.blocks.length > 0) {
        const lastBlock = to.blocks[to.blocks.length - 1]
        to.log.info(
          `Processed blocks ${from}-${lastBlock.header.height}, saved to SQLit`
        )
      }
    } catch (error) {
      console.error('[SQLitDatabase] Transaction failed:', error)
      throw error
    }
  }

  async advance(height: number): Promise<void> {
    // Store checkpoint/height in a metadata table
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
        this.databaseId
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
        this.databaseId
      )
    } catch (error) {
      console.warn('[SQLitDatabase] Failed to save checkpoint:', error)
    }
  }

  supportsHotBlocks(): boolean {
    return false // SQLit doesn't support hot blocks yet
  }
}

class SQLitStoreImpl implements Store {
  private client: SQLitClient
  private databaseId: string
  private pendingWrites: Map<string, any[]> = new Map()

  constructor(client: SQLitClient, databaseId: string) {
    this.client = client
    this.databaseId = databaseId
  }

  async save<E>(entity: E | E[]): Promise<void> {
    const entities = Array.isArray(entity) ? entity : [entity]
    if (entities.length === 0) return

    for (const e of entities) {
      const tableName = this.getTableName((e as any).constructor)
      if (!this.pendingWrites.has(tableName)) {
        this.pendingWrites.set(tableName, [])
      }
      this.pendingWrites.get(tableName)!.push(e)
    }
  }

  async insert<E>(entity: E | E[]): Promise<void> {
    return this.save(entity)
  }

  async upsert<E>(entity: E | E[]): Promise<void> {
    return this.save(entity)
  }

  async remove<E>(entity: E | E[]): Promise<void> {
    const entities = Array.isArray(entity) ? entity : [entity]
    if (entities.length === 0) return

    for (const e of entities) {
      const tableName = this.getTableName((e as any).constructor)
      const id = (e as any).id

      await this.client.exec(
        `DELETE FROM "${tableName}" WHERE id = ?`,
        [id],
        this.databaseId
      )
    }
  }

  async find<E>(
    entityClass: { new (...args: any[]): E },
    options?: any
  ): Promise<E[]> {
    const tableName = this.getTableName(entityClass)
    let sql = `SELECT * FROM "${tableName}"`
    const params: any[] = []

    if (options?.where) {
      const conditions: string[] = []
      for (const [key, value] of Object.entries(options.where)) {
        conditions.push(`"${key}" = ?`)
        params.push(value)
      }
      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`
      }
    }

    if (options?.order) {
      const orderClauses: string[] = []
      for (const [key, direction] of Object.entries(options.order)) {
        orderClauses.push(`"${key}" ${direction}`)
      }
      sql += ` ORDER BY ${orderClauses.join(', ')}`
    }

    if (options?.take) {
      sql += ` LIMIT ${options.take}`
    }

    const result = await this.client.query(sql, params, this.databaseId)
    return result.rows as E[]
  }

  async get<E>(
    entityClass: { new (...args: any[]): E },
    id: string
  ): Promise<E | undefined> {
    const tableName = this.getTableName(entityClass)
    const result = await this.client.query(
      `SELECT * FROM "${tableName}" WHERE id = ? LIMIT 1`,
      [id],
      this.databaseId
    )
    return result.rows[0] as E | undefined
  }

  async count<E>(entityClass: { new (...args: any[]): E }, options?: any): Promise<number> {
    const tableName = this.getTableName(entityClass)
    let sql = `SELECT COUNT(*) as count FROM "${tableName}"`
    const params: any[] = []

    if (options?.where) {
      const conditions: string[] = []
      for (const [key, value] of Object.entries(options.where)) {
        conditions.push(`"${key}" = ?`)
        params.push(value)
      }
      sql += ` WHERE ${conditions.join(' AND ')}`
    }

    const result = await this.client.query(sql, params, this.databaseId)
    return Number(result.rows[0]?.count || 0)
  }

  async flush(): Promise<void> {
    for (const [tableName, entities] of this.pendingWrites.entries()) {
      if (entities.length === 0) continue
      await this.batchUpsert(tableName, entities)
    }
    this.pendingWrites.clear()
  }

  private async batchUpsert(tableName: string, entities: any[]): Promise<void> {
    if (entities.length === 0) return

    const sample = entities[0]
    const columns = Object.keys(sample).filter(
      k => k !== 'constructor' && !k.startsWith('_')
    )

    const quotedCols = columns.map(c => `"${c}"`)
    const placeholders = columns.map(() => '?').join(', ')
    const values: any[] = []
    const valuesClauses: string[] = []

    for (const entity of entities) {
      valuesClauses.push(`(${placeholders})`)
      for (const col of columns) {
        const val = entity[col]
        if (val === null || val === undefined) {
          values.push(null)
        } else if (val instanceof Date) {
          values.push(val.toISOString())
        } else if (typeof val === 'bigint') {
          values.push(val.toString())
        } else if (typeof val === 'object' && !Buffer.isBuffer(val)) {
          values.push(JSON.stringify(val))
        } else {
          values.push(val)
        }
      }
    }

    const updateCols = columns.filter(c => c !== 'id')
    const updateSet = updateCols.map(c => `"${c}" = excluded."${c}"`).join(', ')

    const sql = `
      INSERT INTO "${tableName}" (${quotedCols.join(', ')})
      VALUES ${valuesClauses.join(', ')}
      ON CONFLICT (id) DO UPDATE SET ${updateSet}
    `.trim()

    try {
      await this.client.exec(sql, values, this.databaseId)
      console.log(`[SQLitStore] Saved ${entities.length} ${tableName} records`)
    } catch (error: any) {
      console.error(`[SQLitStore] Failed to save ${tableName}:`, error.message)
      // Don't throw - continue processing other tables
    }
  }

  private getTableName(entityClass: any): string {
    const name = entityClass.name || 'unknown'
    return name
      .replace(/([a-z\d])([A-Z])/g, '$1_$2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      .toLowerCase()
  }
}
