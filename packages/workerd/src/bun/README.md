# Bun Runtime for Workerd

This directory contains the Bun compatibility layer for workerd, enabling Bun applications to run on Cloudflare Workers and DWS infrastructure.

## Modules

### `bun` (main namespace)

The core Bun APIs:

- **File Operations**
  - `Bun.file(path)` - Create a BunFile reference
  - `Bun.write(path, data)` - Write data to a file

- **HTTP Server**
  - `Bun.serve(options)` - Start an HTTP server (maps to fetch handler)

- **Environment**
  - `Bun.env` - Environment variables
  - `Bun.version` - Bun version string
  - `Bun.revision` - Revision info

- **Utilities**
  - `Bun.sleep(ms)` - Async sleep
  - `Bun.sleepSync(ms)` - Sync sleep
  - `Bun.nanoseconds()` - High-precision time
  - `Bun.escapeHTML(str)` - HTML escaping
  - `Bun.stringWidth(str)` - String display width
  - `Bun.deepEquals(a, b)` - Deep equality
  - `Bun.inspect(obj)` - Object inspection

- **Hashing**
  - `Bun.hash(data, algorithm)` - Hash data
  - `Bun.password.hash(password)` - Hash password
  - `Bun.password.verify(password, hash)` - Verify password

- **Streams**
  - `Bun.readableStreamToArray(stream)` - Convert stream to array
  - `Bun.readableStreamToText(stream)` - Convert stream to text
  - `Bun.readableStreamToArrayBuffer(stream)` - Convert to ArrayBuffer
  - `Bun.readableStreamToBlob(stream)` - Convert to Blob
  - `Bun.readableStreamToJSON(stream)` - Convert to JSON

### `bun:sqlite`

SQLite database module with SQLit backend for decentralized persistence:

```typescript
import { Database } from 'bun:sqlite';

// In-memory database (local to worker)
const db = new Database(':memory:');
db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)');
db.run('INSERT INTO users (name) VALUES (?)', 'Alice');
const users = db.query('SELECT * FROM users').all();

// Connect to SQLit (decentralized SQLite via DWS)
const sqlitDb = new Database('sqlit://my-database-id');

// Async API for SQLit backend
const users = await sqlitDb.queryAsync('SELECT * FROM users');
await sqlitDb.execAsync('INSERT INTO users (name) VALUES (?)', ['Alice']);
```

**Connection Strings:**
- `:memory:` - In-memory database (lost when worker restarts)
- `sqlit://database-id` - Connect to SQLit with database ID
- `http://host:port/database-id` - Direct HTTP connection to SQLit

**Environment Variables for SQLit:**
- `SQLIT_ENDPOINT` - SQLit HTTP endpoint (default: `http://localhost:4661`)
- `SQLIT_DATABASE_ID` - Default database ID
- `SQLIT_TIMEOUT` - Request timeout in milliseconds (default: `30000`)
- `SQLIT_DEBUG` - Enable debug logging (`true`/`false`)

### `bun:test`

Test runner stubs (tests should run in actual Bun):

```typescript
import { test, expect } from 'bun:test';
// Will throw in workerd - use 'bun test' instead
```

### `bun:ffi`

Foreign Function Interface stubs (not available in workerd):

```typescript
import { dlopen } from 'bun:ffi';
// Will throw - FFI requires native code execution
```

## SQLit Integration

This implementation integrates with SQLit, Jeju Network's decentralized SQLite service:

### In-Memory Mode (`:memory:`)
For local development or ephemeral data:
- Full SQL support via built-in parser
- Data is lost when worker restarts
- No network calls required

### SQLit Mode (`sqlit://`)
For persistent, decentralized storage:
- Connects to SQLit via HTTP API
- Data persisted with BFT-Raft consensus
- Requires SQLit service running

### API

**Sync API** (for in-memory only):
```typescript
db.exec(sql)           // Execute DDL/multiple statements
db.run(sql, ...params) // Execute single statement, returns { changes, lastInsertRowid }
db.query(sql, ...params) // Execute SELECT, returns rows
db.prepare(sql)        // Create prepared statement
```

**Async API** (for SQLit backend):
```typescript
await db.execAsync(sql, params)   // Execute statement
await db.queryAsync(sql, params)  // Execute SELECT
```

**Statement API**:
```typescript
stmt.run(...params)    // Execute, returns { changes, lastInsertRowid }
stmt.all(...params)    // Get all rows
stmt.get(...params)    // Get first row or null
stmt.values(...params) // Get array of value arrays
stmt.finalize()        // Finalize statement
```

## Limitations

Due to the sandboxed nature of workerd, some Bun features are not available:

1. **File System**: Real filesystem operations are not available. `Bun.file()` and `Bun.write()` use in-memory storage.

2. **SQLite (in-memory)**: Local in-memory SQL with basic query support. For persistent storage, use SQLit backend.

3. **Process Spawning**: `Bun.spawn()` is not available.

4. **FFI**: Native code execution is not supported.

5. **Test Runner**: Tests should be run using `bun test` directly, not in workerd.

## Running Tests

```bash
# Run bun:sqlite tests
cd packages/workerd
bun test src/bun/sqlite.test.ts

# Run all bun module tests
bun test src/bun/
```

## Integration with DWS

To run a Bun application on DWS Workers:

1. Ensure your app uses only supported Bun APIs
2. Configure SQLit environment variables for database access
3. Build your app with `bun build --target bun`
4. Deploy to DWS using the worker deployment API

The `Bun.serve()` handler will be connected to the workerd fetch handler automatically.
