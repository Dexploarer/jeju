/**
 * Indexer API Worker
 *
 * Blockchain indexer with GraphQL and REST APIs - workerd-compatible.
 * Queries SQLit directly for data storage and retrieval.
 *
 * @see https://elysiajs.com/integrations/cloudflare-worker
 */

import { cors } from '@elysiajs/cors'
import {
  getCoreAppUrl,
  getCurrentNetwork,
  getLocalhostHost,
} from '@jejunetwork/config'
import { getSQLit } from '@jejunetwork/db'
import { Elysia } from 'elysia'
import { z } from 'zod'

/**
 * Worker Environment Types
 */
export interface IndexerEnv {
  NETWORK: 'localnet' | 'testnet' | 'mainnet'
  RPC_URL: string
  SQLIT_NODES: string
  SQLIT_DATABASE_ID: string
  INDEXER_CACHE?: KVNamespace
}

interface KVNamespace {
  get(key: string): Promise<string | null>
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>
  delete(key: string): Promise<void>
}

// Zod schemas for request validation
const GraphQLRequestSchema = z.object({
  query: z.string(),
  variables: z
    .record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
    )
    .optional(),
  operationName: z.string().optional(),
})

const A2ARequestSchema = z.object({
  skill: z.string(),
  params: z
    .record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
    )
    .optional(),
})

const MCPRequestSchema = z.object({
  tool: z.string(),
  arguments: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.null()]),
  ),
})

// Database ID for SQLit
const DATABASE_ID = process.env.SQLIT_DATABASE_ID ?? 'indexer-testnet'

/**
 * Execute a GraphQL-like query against SQLit
 * Supports basic queries: blocks, transactions, accounts
 */
async function executeGraphQLQuery(
  query: string,
  variables?: Record<string, string | number | boolean | null>,
): Promise<{
  data: Record<string, unknown> | null
  errors?: Array<{ message: string }>
}> {
  const sqlit = getSQLit()

  // Parse the GraphQL query to extract operation
  const blocksMatch = query.match(/blocks\s*(?:\(([^)]*)\))?\s*\{([^}]+)\}/)
  const transactionsMatch = query.match(
    /transactions\s*(?:\(([^)]*)\))?\s*\{([^}]+)\}/,
  )
  const accountsMatch = query.match(/accounts\s*(?:\(([^)]*)\))?\s*\{([^}]+)\}/)

  // Extract limit from query or variables
  const extractLimit = (args: string | undefined): number => {
    if (!args) return 10
    const limitMatch = args.match(/limit:\s*(\d+)/)
    if (limitMatch) return parseInt(limitMatch[1], 10)
    if (args.includes('$limit') && variables?.limit) {
      return typeof variables.limit === 'number' ? variables.limit : 10
    }
    return 10
  }

  // Extract orderBy from query
  const extractOrderBy = (
    args: string | undefined,
  ): { field: string; dir: 'ASC' | 'DESC' } => {
    if (!args) return { field: 'number', dir: 'DESC' }
    const orderMatch = args.match(/orderBy:\s*(\w+)_(ASC|DESC)/)
    if (orderMatch) {
      return {
        field: orderMatch[1].replace(/([A-Z])/g, '_$1').toLowerCase(),
        dir: orderMatch[2] as 'ASC' | 'DESC',
      }
    }
    return { field: 'number', dir: 'DESC' }
  }

  // Extract where clause
  const extractWhere = (
    args: string | undefined,
    vars?: Record<string, string | number | boolean | null>,
  ): Record<string, string | number> => {
    const where: Record<string, string | number> = {}
    if (!args) return where

    // Match patterns like: number_eq: 123 or hash_eq: "0x..."
    const eqMatches = args.matchAll(/(\w+)_eq:\s*(?:"([^"]+)"|(\d+)|\$(\w+))/g)
    for (const match of eqMatches) {
      const field = match[1]
      const stringVal = match[2]
      const numVal = match[3]
      const varName = match[4]

      if (stringVal) {
        where[field] = stringVal
      } else if (numVal) {
        where[field] = parseInt(numVal, 10)
      } else if (varName && vars && varName in vars) {
        const val = vars[varName]
        if (typeof val === 'string' || typeof val === 'number') {
          where[field] = val
        }
      }
    }
    return where
  }

  // Map GraphQL fields to SQL columns
  const mapFields = (fields: string): string[] => {
    return fields
      .split(/[,\s]+/)
      .filter((f) => f && !f.includes('{') && !f.includes('}'))
      .map((f) => f.trim())
      .filter((f) => /^\w+$/.test(f))
  }

  try {
    if (blocksMatch) {
      const args = blocksMatch[1]
      const fields = mapFields(blocksMatch[2])
      const limit = extractLimit(args)
      const orderBy = extractOrderBy(args)
      const where = extractWhere(args, variables)

      let sql = `SELECT * FROM block`
      const params: (string | number)[] = []

      if (Object.keys(where).length > 0) {
        const conditions = Object.entries(where).map(([k, v]) => {
          params.push(v)
          return `"${k}" = ?`
        })
        sql += ` WHERE ${conditions.join(' AND ')}`
      }

      sql += ` ORDER BY "${orderBy.field}" ${orderBy.dir} LIMIT ${limit}`

      const result = await sqlit.query<Record<string, string | number | null>>(
        sql,
        params,
        DATABASE_ID,
      )

      return {
        data: {
          blocks: result.rows.map((row) => {
            const mapped: Record<string, string | number | null> = {}
            for (const field of fields) {
              const snakeField = field.replace(/([A-Z])/g, '_$1').toLowerCase()
              mapped[field] = row[snakeField] ?? row[field] ?? null
            }
            return mapped
          }),
        },
      }
    }

    if (transactionsMatch) {
      const args = transactionsMatch[1]
      const fields = mapFields(transactionsMatch[2])
      const limit = extractLimit(args)
      const orderBy = extractOrderBy(args)
      const where = extractWhere(args, variables)

      let sql = `SELECT * FROM "transaction"`
      const params: (string | number)[] = []

      if (Object.keys(where).length > 0) {
        const conditions = Object.entries(where).map(([k, v]) => {
          params.push(v)
          return `"${k}" = ?`
        })
        sql += ` WHERE ${conditions.join(' AND ')}`
      }

      sql += ` ORDER BY "${orderBy.field}" ${orderBy.dir} LIMIT ${limit}`

      const result = await sqlit.query<Record<string, string | number | null>>(
        sql,
        params,
        DATABASE_ID,
      )

      return {
        data: {
          transactions: result.rows.map((row) => {
            const mapped: Record<string, string | number | null> = {}
            for (const field of fields) {
              const snakeField = field.replace(/([A-Z])/g, '_$1').toLowerCase()
              mapped[field] = row[snakeField] ?? row[field] ?? null
            }
            return mapped
          }),
        },
      }
    }

    if (accountsMatch) {
      const args = accountsMatch[1]
      const fields = mapFields(accountsMatch[2])
      const limit = extractLimit(args)
      const where = extractWhere(args, variables)

      let sql = `SELECT * FROM account`
      const params: (string | number)[] = []

      if (Object.keys(where).length > 0) {
        const conditions = Object.entries(where).map(([k, v]) => {
          params.push(v)
          return `"${k}" = ?`
        })
        sql += ` WHERE ${conditions.join(' AND ')}`
      }

      sql += ` LIMIT ${limit}`

      const result = await sqlit.query<Record<string, string | number | null>>(
        sql,
        params,
        DATABASE_ID,
      )

      return {
        data: {
          accounts: result.rows.map((row) => {
            const mapped: Record<string, string | number | null> = {}
            for (const field of fields) {
              const snakeField = field.replace(/([A-Z])/g, '_$1').toLowerCase()
              mapped[field] = row[snakeField] ?? row[field] ?? null
            }
            return mapped
          }),
        },
      }
    }

    // Introspection query - return basic schema info
    if (query.includes('__schema') || query.includes('__type')) {
      return {
        data: {
          __schema: {
            queryType: { name: 'Query' },
            types: [
              { name: 'Block', kind: 'OBJECT' },
              { name: 'Transaction', kind: 'OBJECT' },
              { name: 'Account', kind: 'OBJECT' },
            ],
          },
        },
      }
    }

    return {
      data: null,
      errors: [
        {
          message:
            'Unsupported query. Supported: blocks, transactions, accounts. Use REST API at /api/* for full functionality.',
        },
      ],
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[GraphQL] Query error:', message)
    return {
      data: null,
      errors: [{ message: `Database error: ${message}` }],
    }
  }
}

/**
 * Create the Indexer Elysia app
 */
export function createIndexerApp(env?: Partial<IndexerEnv>) {
  const network = env?.NETWORK ?? getCurrentNetwork()
  const isDev = network === 'localnet'

  const app = new Elysia()
    .use(
      cors({
        origin: isDev
          ? true
          : [
              'https://indexer.jejunetwork.org',
              'https://indexer.testnet.jejunetwork.org',
              'https://jejunetwork.org',
              'https://gateway.testnet.jejunetwork.org',
              'https://gateway.jejunetwork.org',
              getCoreAppUrl('INDEXER_GRAPHQL'),
            ],
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'X-API-Key',
          'X-Jeju-Address',
        ],
        credentials: true,
      }),
    )
    // Global error handler
    .onError(({ error, set }) => {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[Indexer Worker] Error:', message)

      // Return proper error response instead of 500
      set.status = 200 // GraphQL errors should be 200 with error in body
      return {
        data: null,
        errors: [{ message: `Internal error: ${message}` }],
      }
    })

    // Health check
    .get('/health', () => ({
      status: 'ok',
      service: 'indexer-api',
      version: '2.0.0',
      network,
      runtime: 'workerd',
      databaseId: DATABASE_ID,
      endpoints: {
        graphql: '/graphql',
        rest: '/api',
        a2a: '/a2a',
        mcp: '/mcp',
      },
    }))

    // GraphQL Playground
    .get('/graphql', () => {
      const playgroundHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Indexer GraphQL Playground</title>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/graphiql@3/graphiql.min.js" crossorigin></script>
  <link href="https://unpkg.com/graphiql@3/graphiql.min.css" rel="stylesheet" />
  <style>
    body { margin: 0; height: 100vh; }
    #graphiql { height: 100vh; }
  </style>
</head>
<body>
  <div id="graphiql"></div>
  <script>
    const fetcher = GraphiQL.createFetcher({ url: '/graphql' });
    const defaultQuery = \`query {
  blocks(limit: 5, orderBy: number_DESC) {
    number
    hash
    timestamp
  }
}\`;
    ReactDOM.createRoot(document.getElementById('graphiql')).render(
      React.createElement(GraphiQL, { fetcher, defaultQuery })
    );
  </script>
</body>
</html>`
      return new Response(playgroundHtml, {
        headers: { 'Content-Type': 'text/html' },
      })
    })
    .get('/playground', () => {
      return Response.redirect('/graphql', 302)
    })

    // GraphQL endpoint - executes queries against SQLit
    .post('/graphql', async ({ body }) => {
      const parsed = GraphQLRequestSchema.safeParse(body)

      if (!parsed.success) {
        return {
          data: null,
          errors: [
            { message: `Invalid GraphQL request: ${parsed.error.message}` },
          ],
        }
      }

      const { query, variables } = parsed.data
      return await executeGraphQLQuery(query, variables)
    })

    // REST API Routes
    .group('/api', (api) =>
      api
        .get('/health', () => ({ status: 'ok' }))

        // Blocks
        .get('/blocks', async ({ query }) => {
          const limit = parseInt(String(query.limit ?? '10'), 10)
          const offset = parseInt(String(query.offset ?? '0'), 10)

          try {
            const sqlit = getSQLit()
            const result = await sqlit.query<{
              id: string
              number: number
              hash: string
              timestamp: string
            }>(
              `SELECT * FROM block ORDER BY number DESC LIMIT ? OFFSET ?`,
              [limit, offset],
              DATABASE_ID,
            )
            const countResult = await sqlit.query<{ count: number }>(
              `SELECT COUNT(*) as count FROM block`,
              [],
              DATABASE_ID,
            )
            return {
              blocks: result.rows,
              total: countResult.rows[0]?.count ?? 0,
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            return { blocks: [], total: 0, error: message }
          }
        })
        .get('/blocks/latest', async () => {
          try {
            const sqlit = getSQLit()
            const result = await sqlit.query<{
              id: string
              number: number
              hash: string
              timestamp: string
            }>(
              `SELECT * FROM block ORDER BY number DESC LIMIT 1`,
              [],
              DATABASE_ID,
            )
            return { block: result.rows[0] ?? null }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            return { block: null, error: message }
          }
        })
        .get('/blocks/:blockNumber', async ({ params }) => {
          try {
            const sqlit = getSQLit()
            const blockNumber = parseInt(params.blockNumber, 10)
            const result = await sqlit.query<{
              id: string
              number: number
              hash: string
              timestamp: string
            }>(
              `SELECT * FROM block WHERE number = ? LIMIT 1`,
              [blockNumber],
              DATABASE_ID,
            )
            return { block: result.rows[0] ?? null }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            return {
              blockNumber: params.blockNumber,
              block: null,
              error: message,
            }
          }
        })

        // Transactions
        .get('/transactions', async ({ query }) => {
          const limit = parseInt(String(query.limit ?? '10'), 10)
          const offset = parseInt(String(query.offset ?? '0'), 10)

          try {
            const sqlit = getSQLit()
            const result = await sqlit.query<{
              id: string
              hash: string
              block_number: number
            }>(
              `SELECT * FROM "transaction" ORDER BY block_number DESC LIMIT ? OFFSET ?`,
              [limit, offset],
              DATABASE_ID,
            )
            const countResult = await sqlit.query<{ count: number }>(
              `SELECT COUNT(*) as count FROM "transaction"`,
              [],
              DATABASE_ID,
            )
            return {
              transactions: result.rows,
              total: countResult.rows[0]?.count ?? 0,
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            return { transactions: [], total: 0, error: message }
          }
        })
        .get('/transactions/:hash', async ({ params }) => {
          try {
            const sqlit = getSQLit()
            const result = await sqlit.query<{
              id: string
              hash: string
              block_number: number
            }>(
              `SELECT * FROM "transaction" WHERE hash = ? LIMIT 1`,
              [params.hash],
              DATABASE_ID,
            )
            return { transaction: result.rows[0] ?? null }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            return { hash: params.hash, transaction: null, error: message }
          }
        })

        // Addresses/Accounts
        .get('/addresses/:address', async ({ params }) => {
          try {
            const sqlit = getSQLit()
            const address = params.address.toLowerCase()
            const result = await sqlit.query<{
              id: string
              address: string
              transaction_count: number
            }>(
              `SELECT * FROM account WHERE address = ? OR id = ? LIMIT 1`,
              [address, address],
              DATABASE_ID,
            )
            return {
              account: result.rows[0] ?? null,
              address: params.address,
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            return { address: params.address, account: null, error: message }
          }
        })
        .get('/addresses/:address/transactions', async ({ params, query }) => {
          const limit = parseInt(String(query.limit ?? '10'), 10)
          const address = params.address.toLowerCase()

          try {
            const sqlit = getSQLit()
            const result = await sqlit.query<{ id: string; hash: string }>(
              `SELECT * FROM "transaction" WHERE from_id = ? OR to_id = ? ORDER BY block_number DESC LIMIT ?`,
              [address, address, limit],
              DATABASE_ID,
            )
            return { address: params.address, transactions: result.rows }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            return { address: params.address, transactions: [], error: message }
          }
        })

        // Tokens
        .get('/tokens', async ({ query }) => {
          const limit = parseInt(String(query.limit ?? '10'), 10)

          try {
            const sqlit = getSQLit()
            const result = await sqlit.query<{
              id: string
              address: string
              contract_type: string
            }>(
              `SELECT * FROM contract WHERE is_erc20 = 1 OR is_erc721 = 1 OR is_erc1155 = 1 LIMIT ?`,
              [limit],
              DATABASE_ID,
            )
            return { tokens: result.rows, total: result.rows.length }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            return { tokens: [], total: 0, error: message }
          }
        })
        .get('/tokens/:address', async ({ params }) => {
          try {
            const sqlit = getSQLit()
            const address = params.address.toLowerCase()
            const result = await sqlit.query<{
              id: string
              address: string
              contract_type: string
            }>(
              `SELECT * FROM contract WHERE address = ? LIMIT 1`,
              [address],
              DATABASE_ID,
            )
            return { token: result.rows[0] ?? null }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            return { address: params.address, token: null, error: message }
          }
        })

        // Events
        .get('/events', async ({ query }) => {
          const limit = parseInt(String(query.limit ?? '10'), 10)

          try {
            const sqlit = getSQLit()
            const result = await sqlit.query<{
              id: string
              event_name: string
              timestamp: string
            }>(
              `SELECT * FROM decoded_event ORDER BY timestamp DESC LIMIT ?`,
              [limit],
              DATABASE_ID,
            )
            return { events: result.rows, total: result.rows.length }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            return { events: [], total: 0, error: message }
          }
        })
        .get('/events/:contractAddress', async ({ params, query }) => {
          const limit = parseInt(String(query.limit ?? '10'), 10)
          const contractAddress = params.contractAddress.toLowerCase()

          try {
            const sqlit = getSQLit()
            const result = await sqlit.query<{
              id: string
              event_name: string
              timestamp: string
            }>(
              `SELECT * FROM decoded_event WHERE address_id = ? ORDER BY timestamp DESC LIMIT ?`,
              [contractAddress, limit],
              DATABASE_ID,
            )
            return {
              contractAddress: params.contractAddress,
              events: result.rows,
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            return {
              contractAddress: params.contractAddress,
              events: [],
              error: message,
            }
          }
        })

        // Stats
        .get('/stats', async () => {
          try {
            const sqlit = getSQLit()
            const [blocksCount, txCount, accountsCount, latestBlock] =
              await Promise.all([
                sqlit.query<{ count: number }>(
                  `SELECT COUNT(*) as count FROM block`,
                  [],
                  DATABASE_ID,
                ),
                sqlit.query<{ count: number }>(
                  `SELECT COUNT(*) as count FROM "transaction"`,
                  [],
                  DATABASE_ID,
                ),
                sqlit.query<{ count: number }>(
                  `SELECT COUNT(*) as count FROM account`,
                  [],
                  DATABASE_ID,
                ),
                sqlit.query<{ timestamp: string }>(
                  `SELECT timestamp FROM block ORDER BY number DESC LIMIT 1`,
                  [],
                  DATABASE_ID,
                ),
              ])

            return {
              totalBlocks: blocksCount.rows[0]?.count ?? 0,
              totalTransactions: txCount.rows[0]?.count ?? 0,
              totalAddresses: accountsCount.rows[0]?.count ?? 0,
              lastBlockTime: latestBlock.rows[0]?.timestamp ?? null,
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            return {
              totalBlocks: 0,
              totalTransactions: 0,
              totalAddresses: 0,
              lastBlockTime: null,
              error: message,
            }
          }
        })
        .get('/stats/tps', async () => {
          try {
            const sqlit = getSQLit()
            // Get transaction count in last minute
            const oneMinuteAgo = new Date(Date.now() - 60000).toISOString()
            const result = await sqlit.query<{ count: number }>(
              `SELECT COUNT(*) as count FROM "transaction" t 
               JOIN block b ON t.block_id = b.id 
               WHERE b.timestamp > ?`,
              [oneMinuteAgo],
              DATABASE_ID,
            )
            const txInLastMinute = result.rows[0]?.count ?? 0
            const currentTPS = txInLastMinute / 60

            return {
              currentTPS: Math.round(currentTPS * 100) / 100,
              avgTPS: currentTPS,
              maxTPS: currentTPS,
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            return { currentTPS: 0, avgTPS: 0, maxTPS: 0, error: message }
          }
        }),
    )

    // A2A Protocol
    .group('/a2a', (a2a) =>
      a2a
        .get('/', () => ({
          name: 'Indexer',
          description: 'Blockchain Indexer with GraphQL API',
          version: '2.0.0',
          protocol: 'a2a',
          capabilities: ['query', 'subscribe', 'historical-data'],
        }))
        .post('/invoke', async ({ body }) => {
          const parsed = A2ARequestSchema.safeParse(body)

          if (!parsed.success) {
            return {
              error: 'Invalid A2A request',
              details: parsed.error.issues,
            }
          }

          // Execute skill based on name
          const { skill, params } = parsed.data

          if (skill === 'query_blocks') {
            const limit = typeof params?.limit === 'number' ? params.limit : 10
            try {
              const sqlit = getSQLit()
              const result = await sqlit.query<{
                number: number
                hash: string
                timestamp: string
              }>(
                `SELECT number, hash, timestamp FROM block ORDER BY number DESC LIMIT ?`,
                [limit],
                DATABASE_ID,
              )
              return { skill, result: result.rows }
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err)
              return { skill, error: message }
            }
          }

          return { skill, result: 'Skill not implemented' }
        }),
    )

    // MCP Protocol
    .group('/mcp', (mcp) =>
      mcp
        .get('/', () => ({
          name: 'Indexer MCP Server',
          version: '1.0.0',
          tools: [
            {
              name: 'indexer_query_blocks',
              description: 'Query recent blocks',
              parameters: {
                type: 'object',
                properties: {
                  limit: { type: 'number', default: 10 },
                  offset: { type: 'number', default: 0 },
                },
              },
            },
            {
              name: 'indexer_query_transactions',
              description: 'Query transactions',
              parameters: {
                type: 'object',
                properties: {
                  address: { type: 'string' },
                  limit: { type: 'number', default: 10 },
                },
              },
            },
            {
              name: 'indexer_graphql',
              description: 'Execute GraphQL query',
              parameters: {
                type: 'object',
                properties: {
                  query: { type: 'string' },
                  variables: { type: 'object' },
                },
                required: ['query'],
              },
            },
          ],
        }))
        .post('/invoke', async ({ body }) => {
          const parsed = MCPRequestSchema.safeParse(body)

          if (!parsed.success) {
            return {
              error: 'Invalid MCP request',
              details: parsed.error.issues,
            }
          }

          const { tool, arguments: args } = parsed.data

          if (tool === 'indexer_query_blocks') {
            const limit = typeof args.limit === 'number' ? args.limit : 10
            try {
              const sqlit = getSQLit()
              const result = await sqlit.query<{
                number: number
                hash: string
                timestamp: string
              }>(
                `SELECT number, hash, timestamp FROM block ORDER BY number DESC LIMIT ?`,
                [limit],
                DATABASE_ID,
              )
              return { tool, result: result.rows }
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err)
              return { tool, error: message }
            }
          }

          if (tool === 'indexer_query_transactions') {
            const limit = typeof args.limit === 'number' ? args.limit : 10
            const address =
              typeof args.address === 'string'
                ? args.address.toLowerCase()
                : null

            try {
              const sqlit = getSQLit()
              let sql = `SELECT hash, block_number, from_id, to_id FROM "transaction"`
              const params: (string | number)[] = []

              if (address) {
                sql += ` WHERE from_id = ? OR to_id = ?`
                params.push(address, address)
              }

              sql += ` ORDER BY block_number DESC LIMIT ?`
              params.push(limit)

              const result = await sqlit.query<{
                hash: string
                block_number: number
              }>(sql, params, DATABASE_ID)
              return { tool, result: result.rows }
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err)
              return { tool, error: message }
            }
          }

          if (tool === 'indexer_graphql') {
            const query = typeof args.query === 'string' ? args.query : ''
            return await executeGraphQLQuery(query)
          }

          return { tool, result: 'Tool not implemented' }
        }),
    )

  return app
}

/**
 * Default export for workerd
 */
const app = createIndexerApp()

export default {
  fetch: app.fetch,
}

/**
 * Bun server entry point - only runs when executed directly
 * When imported as a module (by DWS bootstrap or test), this won't run
 */
const isMainModule = typeof Bun !== 'undefined' && Bun.main === import.meta.path

if (isMainModule) {
  const port = Number(process.env.PORT ?? process.env.INDEXER_PORT ?? 4352)
  const host = getLocalhostHost()

  console.log(`[Indexer Worker] Starting on http://${host}:${port}`)
  console.log(`[Indexer Worker] Network: ${getCurrentNetwork()}`)
  console.log(`[Indexer Worker] Database: ${DATABASE_ID}`)

  Bun.serve({
    port,
    hostname: host,
    fetch: app.fetch,
  })
}
