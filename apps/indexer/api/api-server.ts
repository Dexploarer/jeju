/**
 * Unified API server entry point
 *
 * Uses SQLit (distributed SQLite) as the primary database
 * No PostgreSQL dependency - fully decentralized
 */

import { getLocalhostHost } from '@jejunetwork/config'
import { startA2AServer } from './a2a-server'
import { config } from './config'
import { getDatabaseId } from './db'
import { startMCPServer } from './mcp-server'
import { startRestServer } from './rest-server'
import {
  closeDataSource,
  initializeSQLitWithRetry,
  isSchemaReady,
  setSchemaVerified,
  verifySQLitSchema,
} from './utils/db'

async function main(): Promise<void> {
  console.log('🚀 Starting Indexer API servers...')
  console.log(`[Indexer] Database: SQLit (${getDatabaseId()})`)

  // Initialize SQLit database
  const initialized = await initializeSQLitWithRetry(3, 2000)

  if (!initialized) {
    console.error('[Indexer] SQLit initialization failed')
    process.exit(1)
  }

  // Verify schema exists
  const schemaReady = await verifySQLitSchema()
  setSchemaVerified(schemaReady)

  if (!schemaReady) {
    console.warn(
      '[Indexer] Database schema not ready - REST API will return 503 for data queries',
    )
    console.warn('[Indexer] Run the processor to create schema and index data')
  }

  // Start all API servers
  await Promise.all([startRestServer(), startA2AServer(), startMCPServer()])

  const host = getLocalhostHost()
  const status = isSchemaReady() ? 'sqlit (ready)' : 'sqlit (no data)'
  console.log(`
┌──────────────────────────────────────────┐
│   Indexer API Servers Running            │
├──────────────────────────────────────────┤
│  Mode:    ${status.padEnd(30)}│
│  GraphQL: http://${host}:4350/graphql  │
│  REST:    http://${host}:4352          │
│  A2A:     http://${host}:4351          │
│  MCP:     http://${host}:4353          │
│  DB:      SQLit (decentralized)          │
└──────────────────────────────────────────┘`)
}

async function shutdown(): Promise<void> {
  console.log('\n[Indexer] Shutting down...')
  await closeDataSource()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

main().catch((error: Error) => {
  console.error('[Indexer] Startup failed:', error.message)

  // Log more details in development
  if (!config.isProduction) {
    console.error(error.stack)
  }

  process.exit(1)
})
