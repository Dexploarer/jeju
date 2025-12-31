/**
 * SQLit Store adapter for Subsquid processor
 * Replaces TypeormDatabase with direct SQLit writes
 */

import { getSQLit, type SQLitClient } from '@jejunetwork/db'
import type { Store } from '@subsquid/typeorm-store'

export class SQLitStore implements Store {
  private client: SQLitClient
  private databaseId: string
  private entities: Map<string, any[]> = new Map()

  constructor(databaseId: string) {
    this.client = getSQLit()
    this.databaseId = databaseId
  }

  async save<E>(entity: E | E[]): Promise<void> {
    const entities = Array.isArray(entity) ? entity : [entity]
    if (entities.length === 0) return

    // Group entities by constructor/table
    for (const e of entities) {
      const constructor = (e as any).constructor
      const tableName = this.getTableName(constructor)

      if (!this.entities.has(tableName)) {
        this.entities.set(tableName, [])
      }
      this.entities.get(tableName)!.push(e)
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
      const constructor = (e as any).constructor
      const tableName = this.getTableName(constructor)
      const id = (e as any).id

      await this.client.exec(
        `DELETE FROM ${this.quoteIdent(tableName)} WHERE id = ?`,
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

    let sql = `SELECT * FROM ${this.quoteIdent(tableName)}`
    const params: any[] = []

    if (options?.where) {
      const conditions: string[] = []
      for (const [key, value] of Object.entries(options.where)) {
        conditions.push(`${this.quoteIdent(key)} = ?`)
        params.push(value)
      }
      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`
      }
    }

    if (options?.order) {
      const orderClauses: string[] = []
      for (const [key, direction] of Object.entries(options.order)) {
        orderClauses.push(`${this.quoteIdent(key)} ${direction}`)
      }
      if (orderClauses.length > 0) {
        sql += ` ORDER BY ${orderClauses.join(', ')}`
      }
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
      `SELECT * FROM ${this.quoteIdent(tableName)} WHERE id = ? LIMIT 1`,
      [id],
      this.databaseId
    )
    return result.rows[0] as E | undefined
  }

  async count<E>(
    entityClass: { new (...args: any[]): E },
    options?: any
  ): Promise<number> {
    const tableName = this.getTableName(entityClass)

    let sql = `SELECT COUNT(*) as count FROM ${this.quoteIdent(tableName)}`
    const params: any[] = []

    if (options?.where) {
      const conditions: string[] = []
      for (const [key, value] of Object.entries(options.where)) {
        conditions.push(`${this.quoteIdent(key)} = ?`)
        params.push(value)
      }
      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`
      }
    }

    const result = await this.client.query(sql, params, this.databaseId)
    return Number(result.rows[0]?.count || 0)
  }

  /**
   * Flush all pending writes to SQLit
   */
  async flush(): Promise<void> {
    for (const [tableName, entities] of this.entities.entries()) {
      if (entities.length === 0) continue

      // Batch insert/upsert entities
      await this.batchUpsert(tableName, entities)
    }

    // Clear pending entities
    this.entities.clear()
  }

  private async batchUpsert(tableName: string, entities: any[]): Promise<void> {
    if (entities.length === 0) return

    const firstEntity = entities[0]
    const columns = Object.keys(firstEntity).filter(k => k !== 'constructor')

    // Validate column names
    for (const col of columns) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col)) {
        console.warn(`[SQLitStore] Invalid column name: ${col}`)
        return
      }
    }

    const quotedColumns = columns.map(c => this.quoteIdent(c))
    const placeholders = columns.map(() => '?').join(', ')

    const values: any[] = []
    const valuesClauses: string[] = []

    for (const entity of entities) {
      valuesClauses.push(`(${placeholders})`)
      for (const col of columns) {
        const value = entity[col]
        if (value === null || value === undefined) {
          values.push(null)
        } else if (value instanceof Date) {
          values.push(value.toISOString())
        } else if (typeof value === 'bigint') {
          values.push(value.toString())
        } else if (typeof value === 'object') {
          values.push(JSON.stringify(value))
        } else {
          values.push(value)
        }
      }
    }

    const updateCols = columns.filter(c => c !== 'id')
    const updateSet = updateCols
      .map(c => `${this.quoteIdent(c)} = excluded.${this.quoteIdent(c)}`)
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

  private getTableName(entityClass: any): string {
    // Convert PascalCase to snake_case
    const name = entityClass.name || 'unknown'
    return name
      .replace(/([a-z\d])([A-Z])/g, '$1_$2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      .toLowerCase()
  }

  private quoteIdent(name: string): string {
    return `"${name.replace(/"/g, '""')}"`
  }
}

/**
 * Create SQLit tables from TypeORM entity metadata
 */
export async function initializeSQLitSchema(
  client: SQLitClient,
  databaseId: string,
  entities: any[]
): Promise<void> {
  // This would need to introspect TypeORM decorators to create tables
  // For now, we'll assume tables are created manually or via migrations
  console.log('[SQLitStore] Schema initialization - tables should exist')
}
