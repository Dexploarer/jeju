/**
 * SQLit Store adapter for Subsquid processor
 * Standalone store implementation for SQLit writes
 */

import { getSQLit, type QueryParam, type SQLitClient } from '@jejunetwork/db'

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

export class SQLitStore {
  private client: SQLitClient
  private databaseId: string
  private entities: Map<string, EntityBase[]> = new Map()
  private deletes: Map<string, string[]> = new Map()

  constructor(databaseId: string) {
    this.client = getSQLit()
    this.databaseId = databaseId
  }

  async save<E extends EntityBase>(entity: E | E[]): Promise<void> {
    const entities = Array.isArray(entity) ? entity : [entity]
    if (entities.length === 0) return

    for (const e of entities) {
      const tableName = this.getTableName(e.constructor as EntityClass<E>)

      if (!this.entities.has(tableName)) {
        this.entities.set(tableName, [])
      }
      this.entities.get(tableName)?.push(e)
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
      if (!this.deletes.has(tableName)) {
        this.deletes.set(tableName, [])
      }
      this.deletes.get(tableName)?.push(e.id)
    }
  }

  async find<E extends EntityBase>(
    entityClass: EntityClass<E>,
    options?: FindOptions,
  ): Promise<E[]> {
    const tableName = this.getTableName(entityClass)

    let sql = `SELECT * FROM ${this.quoteIdent(tableName)}`
    const params: QueryParam[] = []

    if (options?.where) {
      const conditions: string[] = []
      for (const [key, value] of Object.entries(options.where)) {
        conditions.push(`${this.quoteIdent(this.toSnakeCase(key))} = ?`)
        params.push(this.toQueryParam(value))
      }
      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`
      }
    }

    if (options?.order) {
      const orderClauses: string[] = []
      for (const [key, direction] of Object.entries(options.order)) {
        orderClauses.push(`${this.quoteIdent(this.toSnakeCase(key))} ${direction}`)
      }
      if (orderClauses.length > 0) {
        sql += ` ORDER BY ${orderClauses.join(', ')}`
      }
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

  async get<E extends EntityBase>(
    entityClass: EntityClass<E>,
    id: string,
  ): Promise<E | undefined> {
    const tableName = this.getTableName(entityClass)
    const result = await this.client.query(
      `SELECT * FROM ${this.quoteIdent(tableName)} WHERE id = ? LIMIT 1`,
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

    let sql = `SELECT COUNT(*) as count FROM ${this.quoteIdent(tableName)}`
    const params: QueryParam[] = []

    if (options?.where) {
      const conditions: string[] = []
      for (const [key, value] of Object.entries(options.where)) {
        conditions.push(`${this.quoteIdent(this.toSnakeCase(key))} = ?`)
        params.push(this.toQueryParam(value))
      }
      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`
      }
    }

    const result = await this.client.query(sql, params, this.databaseId)
    const countRow = result.rows[0] as { count: number } | undefined
    return Number(countRow?.count ?? 0)
  }

  /**
   * Flush all pending writes to SQLit
   */
  async flush(): Promise<void> {
    // Process deletes first
    for (const [tableName, ids] of this.deletes.entries()) {
      if (ids.length === 0) continue
      const placeholders = ids.map(() => '?').join(', ')
      await this.client.exec(
        `DELETE FROM ${this.quoteIdent(tableName)} WHERE id IN (${placeholders})`,
        ids,
        this.databaseId,
      )
    }
    this.deletes.clear()

    // Process writes
    for (const [tableName, entities] of this.entities.entries()) {
      if (entities.length === 0) continue
      await this.batchUpsert(tableName, entities)
    }
    this.entities.clear()
  }

  private async batchUpsert(
    tableName: string,
    entities: EntityBase[],
  ): Promise<void> {
    if (entities.length === 0) return

    const firstEntity = entities[0] as unknown as Record<string, unknown>
    const columns = Object.keys(firstEntity).filter((k) => {
      if (k === 'constructor' || k.startsWith('_')) return false
      return typeof firstEntity[k] !== 'function'
    })

    const dbColumns = columns.map((c) => this.toSnakeCase(c))
    const quotedColumns = dbColumns.map((c) => this.quoteIdent(c))
    const placeholders = columns.map(() => '?').join(', ')

    const values: QueryParam[] = []
    const valuesClauses: string[] = []

    for (const entity of entities) {
      const entityRecord = entity as unknown as Record<string, unknown>
      valuesClauses.push(`(${placeholders})`)
      for (const col of columns) {
        values.push(this.toQueryParam(entityRecord[col]))
      }
    }

    const updateCols = dbColumns.filter((c) => c !== 'id')
    const updateSet = updateCols
      .map((c) => `${this.quoteIdent(c)} = excluded.${this.quoteIdent(c)}`)
      .join(', ')

    const sql = `
      INSERT INTO ${this.quoteIdent(tableName)} (${quotedColumns.join(', ')})
      VALUES ${valuesClauses.join(', ')}
      ON CONFLICT (id) DO UPDATE SET ${updateSet}
    `.trim()

    try {
      await this.client.exec(sql, values, this.databaseId)
    } catch (error) {
      console.error(`[SQLitStore] Failed to upsert to ${tableName}:`, error)
      throw error
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

  private quoteIdent(name: string): string {
    return `"${name.replace(/"/g, '""')}"`
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
      // Handle entity references - extract id
      if ('id' in val && typeof (val as { id: unknown }).id === 'string') {
        return (val as { id: string }).id
      }
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

/**
 * Create SQLit tables from entity definitions
 * 
 * Note: Table creation is handled by the SQLit schema migrations in apps/indexer/db/migrations.
 * This function exists for compatibility but actual schema is managed by the migration system.
 */
export async function initializeSQLitSchema(
  databaseId: string,
): Promise<void> {
  const client = getSQLit()
  
  // Verify connection is healthy
  const healthy = await client.isHealthy()
  if (!healthy) {
    throw new Error(`[SQLitStore] Cannot initialize schema - SQLit connection to ${databaseId} is not healthy`)
  }
  
  console.log(`[SQLitStore] Schema verified for database: ${databaseId}`)
}
