// Copyright (c) 2024 Jeju Network
// Tests for bun:sqlite compatibility layer
// Licensed under the Apache 2.0 license

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  Database,
  OPEN_CREATE,
  OPEN_READONLY,
  OPEN_READWRITE,
  SQLITE_OK,
  SQLITE_VERSION,
  SQLITE_VERSION_NUMBER,
  Statement,
} from './sqlite'

describe('bun:sqlite', () => {
  let db: Database

  beforeEach(() => {
    db = new Database(':memory:')
  })

  afterEach(() => {
    db.close()
  })

  describe('Database', () => {
    test('creates in-memory database', () => {
      expect(db.open).toBe(true)
      expect(db.inMemory).toBe(true)
      expect(db.path).toBe(':memory:')
    })

    test('closes database', () => {
      db.close()
      expect(db.open).toBe(false)
    })

    test('exec creates table', () => {
      db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)')
      const rows = db.query('SELECT * FROM users')
      expect(rows).toEqual([])
    })

    test('exec with multiple statements', () => {
      db.exec(`
        CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);
        CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT)
      `)

      // Both tables should exist
      const users = db.query('SELECT * FROM users')
      const posts = db.query('SELECT * FROM posts')
      expect(users).toEqual([])
      expect(posts).toEqual([])
    })

    test('run inserts data', () => {
      db.exec(
        'CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)',
      )

      const result = db.run('INSERT INTO users (name) VALUES (?)', 'Alice')
      expect(result.changes).toBe(1)
      expect(result.lastInsertRowid).toBe(1)
    })

    test('query returns rows', () => {
      db.exec(
        'CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)',
      )
      db.run('INSERT INTO users (name) VALUES (?)', 'Alice')
      db.run('INSERT INTO users (name) VALUES (?)', 'Bob')

      const rows = db.query<{ id: number; name: string }>('SELECT * FROM users')
      expect(rows.length).toBe(2)
      expect(rows[0].name).toBe('Alice')
      expect(rows[1].name).toBe('Bob')
    })

    test('query with WHERE clause', () => {
      db.exec(
        'CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)',
      )
      db.run('INSERT INTO users (name) VALUES (?)', 'Alice')
      db.run('INSERT INTO users (name) VALUES (?)', 'Bob')

      const rows = db.query<{ id: number; name: string }>(
        'SELECT * FROM users WHERE name = ?',
        'Alice',
      )
      expect(rows.length).toBe(1)
      expect(rows[0].name).toBe('Alice')
    })

    test('query with ORDER BY', () => {
      db.exec(
        'CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)',
      )
      db.run('INSERT INTO users (name) VALUES (?)', 'Charlie')
      db.run('INSERT INTO users (name) VALUES (?)', 'Alice')
      db.run('INSERT INTO users (name) VALUES (?)', 'Bob')

      const rows = db.query<{ id: number; name: string }>(
        'SELECT * FROM users ORDER BY name',
      )
      expect(rows[0].name).toBe('Alice')
      expect(rows[1].name).toBe('Bob')
      expect(rows[2].name).toBe('Charlie')
    })

    test('query with LIMIT', () => {
      db.exec(
        'CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)',
      )
      db.run('INSERT INTO users (name) VALUES (?)', 'Alice')
      db.run('INSERT INTO users (name) VALUES (?)', 'Bob')
      db.run('INSERT INTO users (name) VALUES (?)', 'Charlie')

      const rows = db.query<{ id: number; name: string }>(
        'SELECT * FROM users LIMIT 2',
      )
      expect(rows.length).toBe(2)
    })

    test('UPDATE modifies rows', () => {
      db.exec(
        'CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)',
      )
      db.run('INSERT INTO users (name) VALUES (?)', 'Alice')

      const result = db.run(
        'UPDATE users SET name = ? WHERE name = ?',
        'Alicia',
        'Alice',
      )
      expect(result.changes).toBe(1)

      const rows = db.query<{ name: string }>('SELECT name FROM users')
      expect(rows[0].name).toBe('Alicia')
    })

    test('DELETE removes rows', () => {
      db.exec(
        'CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)',
      )
      db.run('INSERT INTO users (name) VALUES (?)', 'Alice')
      db.run('INSERT INTO users (name) VALUES (?)', 'Bob')

      const result = db.run('DELETE FROM users WHERE name = ?', 'Alice')
      expect(result.changes).toBe(1)

      const rows = db.query('SELECT * FROM users')
      expect(rows.length).toBe(1)
    })

    test('DROP TABLE removes table', () => {
      db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY)')
      db.exec('DROP TABLE users')

      expect(() => db.query('SELECT * FROM users')).toThrow(
        'No such table: users',
      )
    })

    test('transaction executes function', () => {
      db.exec(
        'CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)',
      )

      const _result = db.transaction((tx) => {
        tx.run('INSERT INTO users (name) VALUES (?)', 'Alice')
        tx.run('INSERT INTO users (name) VALUES (?)', 'Bob')
        return tx.query('SELECT COUNT(*) as count FROM users')
      })

      // Transaction should have completed
      expect(db.inTransaction).toBe(false)
    })
  })

  describe('Statement', () => {
    test('prepare creates statement', () => {
      db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)')
      const stmt = db.prepare('SELECT * FROM users WHERE id = ?')
      expect(stmt).toBeInstanceOf(Statement)
      expect(stmt.paramsCount).toBe(1)
    })

    test('statement.all returns all rows', () => {
      db.exec(
        'CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)',
      )
      db.run('INSERT INTO users (name) VALUES (?)', 'Alice')
      db.run('INSERT INTO users (name) VALUES (?)', 'Bob')

      const stmt = db.prepare<{ id: number; name: string }>(
        'SELECT * FROM users',
      )
      const rows = stmt.all()
      expect(rows.length).toBe(2)
    })

    test('statement.get returns first row', () => {
      db.exec(
        'CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)',
      )
      db.run('INSERT INTO users (name) VALUES (?)', 'Alice')

      const stmt = db.prepare<{ id: number; name: string }>(
        'SELECT * FROM users',
      )
      const row = stmt.get()
      expect(row?.name).toBe('Alice')
    })

    test('statement.get returns null for no results', () => {
      db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)')

      const stmt = db.prepare<{ id: number; name: string }>(
        'SELECT * FROM users',
      )
      const row = stmt.get()
      expect(row).toBeNull()
    })

    test('statement.run executes mutation', () => {
      db.exec(
        'CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)',
      )

      const stmt = db.prepare('INSERT INTO users (name) VALUES (?)')
      const result = stmt.run('Alice')
      expect(result.changes).toBe(1)
    })

    test('statement.values returns array of arrays', () => {
      db.exec(
        'CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)',
      )
      db.run('INSERT INTO users (name) VALUES (?)', 'Alice')

      const stmt = db.prepare('SELECT * FROM users')
      const values = stmt.values()
      expect(Array.isArray(values)).toBe(true)
      expect(Array.isArray(values[0])).toBe(true)
    })

    test('statement.finalize prevents further use', () => {
      db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)')
      const stmt = db.prepare('SELECT * FROM users')
      stmt.finalize()

      expect(() => stmt.all()).toThrow('Statement has been finalized')
    })

    test('statements are cached', () => {
      db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)')
      const stmt1 = db.prepare('SELECT * FROM users')
      const stmt2 = db.prepare('SELECT * FROM users')
      expect(stmt1).toBe(stmt2)
    })
  })

  describe('Data Types', () => {
    test('handles NULL values', () => {
      db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)')
      db.run('INSERT INTO test (id, value) VALUES (?, ?)', 1, null)

      const rows = db.query<{ id: number; value: string | null }>(
        'SELECT * FROM test',
      )
      expect(rows[0].value).toBeNull()
    })

    test('handles integer values', () => {
      db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, value INTEGER)')
      db.run('INSERT INTO test (id, value) VALUES (?, ?)', 1, 42)

      const rows = db.query<{ id: number; value: number }>('SELECT * FROM test')
      expect(rows[0].value).toBe(42)
    })

    test('handles text values', () => {
      db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)')
      db.run('INSERT INTO test (id, value) VALUES (?, ?)', 1, 'hello world')

      const rows = db.query<{ id: number; value: string }>('SELECT * FROM test')
      expect(rows[0].value).toBe('hello world')
    })

    test('handles text with special characters', () => {
      db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)')
      db.run('INSERT INTO test (id, value) VALUES (?, ?)', 1, "O'Brien")

      const rows = db.query<{ id: number; value: string }>('SELECT * FROM test')
      expect(rows[0].value).toBe("O'Brien")
    })
  })

  describe('Constants', () => {
    test('exports SQLITE_VERSION', () => {
      expect(SQLITE_VERSION).toBe('3.45.0')
    })

    test('exports SQLITE_VERSION_NUMBER', () => {
      expect(SQLITE_VERSION_NUMBER).toBe(3045000)
    })

    test('exports open flags', () => {
      expect(OPEN_READONLY).toBe(1)
      expect(OPEN_READWRITE).toBe(2)
      expect(OPEN_CREATE).toBe(4)
    })

    test('exports status codes', () => {
      expect(SQLITE_OK).toBe(0)
    })
  })

  describe('Error Handling', () => {
    test('throws on unsupported SQL', () => {
      expect(() => db.exec('EXPLAIN SELECT 1')).toThrow('Unsupported SQL')
    })

    test('throws on invalid table', () => {
      expect(() => db.query('SELECT * FROM nonexistent')).toThrow(
        'No such table',
      )
    })

    test('throws on closed database', () => {
      db.close()
      expect(() => db.exec('SELECT 1')).toThrow('Database is closed')
    })
  })
})

describe('SQLit Connection', () => {
  test('parses sqlit:// connection string', () => {
    // This tests the parsing logic without actual connection
    const db = new Database('sqlit://test-database')
    expect(db.path).toBe('sqlit://test-database')
    expect(db.inMemory).toBe(false)
  })

  test('async methods available for SQLit backend', () => {
    const db = new Database('sqlit://test-database')

    // Should have async methods
    expect(typeof db.queryAsync).toBe('function')
    expect(typeof db.execAsync).toBe('function')

    db.close()
  })

  test('sync methods throw for SQLit backend', () => {
    const db = new Database('sqlit://test-database')

    expect(() => db.exec('SELECT 1')).toThrow(
      'SQLit backend requires async execution',
    )
    expect(() => db.query('SELECT 1')).toThrow(
      'SQLit backend requires async execution',
    )

    db.close()
  })
})
