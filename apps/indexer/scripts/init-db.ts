#!/usr/bin/env bun
/**
 * Initialize Indexer Database on SQLit
 *
 * Creates the indexer database if it doesn't exist and initializes the schema.
 * Run this before deploying the indexer to a new network.
 *
 * Usage:
 *   JEJU_NETWORK=testnet bun run apps/indexer/scripts/init-db.ts
 */

import { getCurrentNetwork, type NetworkType } from '@jejunetwork/config'
import { SCHEMA_DDL, INDEX_DDL } from '../api/db/schema'

// SQLit endpoint per network
function getSQLitEndpoint(network: NetworkType): string {
  switch (network) {
    case 'localnet':
      return process.env.SQLIT_BLOCK_PRODUCER_ENDPOINT ?? 'http://127.0.0.1:8546'
    case 'testnet':
      return 'https://dws.testnet.jejunetwork.org/sqlit'
    case 'mainnet':
      return 'https://dws.jejunetwork.org/sqlit'
  }
}

// Existing database IDs per network
const EXISTING_DATABASE_IDS: Record<NetworkType, string | null> = {
  localnet: 'indexer-local',
  testnet: '13b03bc72029819feeca85f8cc82bbc9844ebdb04936ee490a9df85a38584c24',
  mainnet: null, // To be created on mainnet deployment
}

interface SQLitResult {
  success: boolean
  status?: string
  data?: Record<string, unknown> | null
  error?: string
}

async function sqlitQuery(
  endpoint: string,
  database: string,
  sql: string,
  args: (string | number | null)[] = [],
): Promise<SQLitResult> {
  const response = await fetch(`${endpoint}/v1/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ database, query: sql, args }),
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    const text = await response.text()
    return { success: false, status: text, error: text }
  }

  return await response.json()
}

async function sqlitExec(
  endpoint: string,
  database: string,
  sql: string,
  args: (string | number | null)[] = [],
): Promise<SQLitResult> {
  const response = await fetch(`${endpoint}/v1/exec`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ database, query: sql, args }),
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    const text = await response.text()
    return { success: false, status: text, error: text }
  }

  return await response.json()
}

async function createDatabase(
  endpoint: string,
  nodeCount = 1,
): Promise<{ success: boolean; databaseId?: string; error?: string }> {
  console.log(`Creating database with ${nodeCount} nodes...`)

  const response = await fetch(`${endpoint}/v1/admin/create?node=${nodeCount}`, {
    method: 'POST',
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    const text = await response.text()
    return { success: false, error: text }
  }

  const result = (await response.json()) as {
    success: boolean
    data?: { database: string }
    status?: string
  }

  if (!result.success) {
    return { success: false, error: result.status }
  }

  return { success: true, databaseId: result.data?.database }
}

async function checkDatabaseExists(
  endpoint: string,
  databaseId: string,
): Promise<boolean> {
  console.log(`Checking if database ${databaseId} exists...`)

  // Try a simple query - if it fails with "no such file", database doesn't exist
  const result = await sqlitQuery(endpoint, databaseId, 'SELECT 1', [])

  if (!result.success) {
    const status = result.status ?? ''
    if (
      status.includes('no such file or directory') ||
      status.includes('unable to open database')
    ) {
      return false
    }
    // Other errors might mean the database exists but has issues
    console.log(`Database check returned: ${status}`)
  }

  return result.success
}

async function initializeSchema(
  endpoint: string,
  databaseId: string,
): Promise<void> {
  console.log('\nInitializing schema...')

  // Create all tables
  let tableCount = 0
  let errorCount = 0

  for (const ddl of SCHEMA_DDL) {
    const tableName = ddl.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1] ?? 'unknown'
    process.stdout.write(`  Creating table ${tableName}...`)

    const result = await sqlitExec(endpoint, databaseId, ddl)

    if (!result.success) {
      console.log(` FAILED: ${result.status}`)
      errorCount++
    } else {
      console.log(' OK')
      tableCount++
    }
  }

  console.log(`\nCreated ${tableCount} tables, ${errorCount} errors`)

  // Create indexes
  console.log('\nCreating indexes...')
  let indexCount = 0

  for (const ddl of INDEX_DDL) {
    const indexName = ddl.match(/CREATE INDEX IF NOT EXISTS (\w+)/)?.[1] ?? 'unknown'
    process.stdout.write(`  Creating index ${indexName}...`)

    const result = await sqlitExec(endpoint, databaseId, ddl)

    if (!result.success) {
      // Index errors are often duplicates, not fatal
      console.log(` skipped (${result.status?.slice(0, 50)}...)`)
    } else {
      console.log(' OK')
      indexCount++
    }
  }

  console.log(`\nCreated ${indexCount} indexes`)
}

async function main(): Promise<void> {
  const network = getCurrentNetwork()
  const endpoint = getSQLitEndpoint(network)

  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║           Indexer Database Initialization                   ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log('')
  console.log(`Network:  ${network}`)
  console.log(`Endpoint: ${endpoint}`)
  console.log('')

  // Check if we have an existing database ID for this network
  let databaseId = EXISTING_DATABASE_IDS[network]

  if (databaseId) {
    console.log(`Using existing database ID: ${databaseId}`)

    // Check if it exists
    const exists = await checkDatabaseExists(endpoint, databaseId)

    if (!exists) {
      console.log('\nDatabase does not exist, creating...')

      // Create a new database
      const createResult = await createDatabase(endpoint, 1)

      if (!createResult.success) {
        console.error(`Failed to create database: ${createResult.error}`)
        process.exit(1)
      }

      const newDatabaseId = createResult.databaseId
      console.log(`\nCreated new database: ${newDatabaseId}`)
      console.log('')
      console.log('IMPORTANT: Update the database ID in these files:')
      console.log('  - apps/indexer/api/worker.ts (DATABASE_IDS constant)')
      console.log('  - apps/indexer/scripts/deploy.ts (databaseIds constant)')
      console.log('')
      console.log(`New database ID for ${network}: ${newDatabaseId}`)

      databaseId = newDatabaseId
    } else {
      console.log('Database exists and is accessible')
    }
  } else {
    console.log('No existing database ID configured, creating new database...')

    const createResult = await createDatabase(endpoint, 1)

    if (!createResult.success) {
      console.error(`Failed to create database: ${createResult.error}`)
      process.exit(1)
    }

    databaseId = createResult.databaseId
    console.log(`\nCreated new database: ${databaseId}`)
    console.log('')
    console.log('IMPORTANT: Add this database ID to:')
    console.log('  - apps/indexer/api/worker.ts (DATABASE_IDS constant)')
    console.log('  - apps/indexer/scripts/deploy.ts (databaseIds constant)')
  }

  if (!databaseId) {
    console.error('No database ID available')
    process.exit(1)
  }

  // Initialize schema
  await initializeSchema(endpoint, databaseId)

  console.log('')
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║           Database Initialization Complete                   ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log('')
  console.log(`Database ID: ${databaseId}`)
  console.log(`Endpoint:    ${endpoint}`)
  console.log('')
}

main().catch((err: Error) => {
  console.error('Initialization failed:', err.message)
  process.exit(1)
})
