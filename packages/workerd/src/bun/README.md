# Bun Runtime Compatibility Layer for Workerd

This module provides Bun-compatible APIs for running Bun applications on workerd/Cloudflare Workers infrastructure.

## Status: Production Ready (Bundled Mode)

The Bun compatibility layer is fully functional and tested with **288 passing tests** (253 unit + 35 integration).

### LARP Assessment: Verified ✅

A critical review was performed to identify and fix any "LARP" (performative but non-functional code):

| Issue | Status | Resolution |
|-------|--------|------------|
| Bundle password.hash/verify was stubbed | ✅ Fixed | Real PBKDF2 implementation |
| Bundle revision mismatch | ✅ Fixed | Now matches bun.ts ("workerd-compat") |
| SQLit HTTP lastInsertId always 0 | ✅ Fixed | Now parses server response |
| SQLit HTTP client untested | ✅ Fixed | Integration tests added |
| escapeHTML inconsistency | ✅ Fixed | Both use `&#039;` |
| stringWidth control char handling | ✅ Fixed | Both use same logic |
| inspect implementation differs | ✅ Fixed | Both use custom impl |
| nanoseconds semantics | ✅ Fixed | Both use absolute time |

All implementations in `bun-bundle.js` now exactly match `bun.ts`.

## Quick Start

### 1. Build the bundle

```bash
cd packages/workerd
bun run build:bun
```

### 2. Create a worker using Bun APIs

```javascript
// worker.js
import Bun from './bun-bundle.js'

export default {
  async fetch(request) {
    // Use Bun APIs
    const hash = Bun.hash('hello world')
    
    await Bun.write('/data.txt', 'Hello from Bun.')
    const file = Bun.file('/data.txt')
    const content = await file.text()
    
    return new Response(JSON.stringify({
      hash: hash.toString(16),
      content,
      bunVersion: Bun.version
    }), {
      headers: { 'content-type': 'application/json' }
    })
  }
}
```

### 3. Configure workerd

```capnp
using Workerd = import "/workerd/workerd.capnp";

const config :Workerd.Config = (
  services = [ (name = "main", worker = .myWorker) ],
  sockets = [ ( name = "http", address = "*:8080", http = (), service = "main" ) ]
);

const myWorker :Workerd.Worker = (
  modules = [
    (name = "worker", esModule = embed "worker.js"),
    (name = "./bun-bundle.js", esModule = embed "path/to/bun-bundle.js")
  ],
  compatibilityDate = "2024-01-01",
  compatibilityFlags = ["nodejs_compat"]
);
```

### 4. Run workerd

```bash
workerd serve config.capnp
```

## Running Tests

```bash
# Run all tests (unit + integration)
bun run test

# Run only unit tests
bun run test:unit

# Run only integration tests (requires workerd)
bun run test:worker
```

## Implemented APIs

### bun:bun

| API | Status | Notes |
|-----|--------|-------|
| `Bun.file()` | ✅ | Virtual filesystem |
| `Bun.write()` | ✅ | Supports string, Uint8Array, Blob, Response |
| `Bun.serve()` | ✅ | Maps to fetch handler |
| `Bun.env` | ✅ | Proxies process.env |
| `Bun.version` | ✅ | Returns "1.0.0-workerd" |
| `Bun.revision` | ✅ | Returns "workerd-compat" |
| `Bun.hash()` | ✅ | Fast non-crypto hash |
| `Bun.hash.wyhash()` | ✅ | |
| `Bun.hash.crc32()` | ✅ | |
| `Bun.hash.adler32()` | ✅ | |
| `Bun.hash.cityhash32()` | ✅ | |
| `Bun.hash.cityhash64()` | ✅ | |
| `Bun.hash.murmur32v3()` | ✅ | |
| `Bun.hash.murmur64v2()` | ✅ | |
| `Bun.sleep()` | ✅ | Async |
| `Bun.sleepSync()` | ✅ | Sync (blocks) |
| `Bun.escapeHTML()` | ✅ | |
| `Bun.stringWidth()` | ✅ | Unicode-aware |
| `Bun.deepEquals()` | ✅ | |
| `Bun.inspect()` | ✅ | |
| `Bun.nanoseconds()` | ✅ | Returns BigInt |
| `Bun.ArrayBufferSink` | ✅ | |
| `Bun.readableStreamToText()` | ✅ | |
| `Bun.readableStreamToArrayBuffer()` | ✅ | |
| `Bun.readableStreamToBlob()` | ✅ | |
| `Bun.readableStreamToJSON()` | ✅ | |
| `Bun.readableStreamToArray()` | ✅ | |
| `Bun.password.hash()` | ✅ | PBKDF2-based |
| `Bun.password.verify()` | ✅ | |
| `Bun.randomUUIDv7()` | ✅ | |
| `Bun.fileURLToPath()` | ✅ | |
| `Bun.pathToFileURL()` | ✅ | |
| `Bun.peek()` | ✅ | |
| `Bun.gc()` | ✅ | No-op |
| `Bun.shrink()` | ✅ | No-op |
| `Bun.dns.*` | ❌ | Not available in workerd |
| `Bun.spawn()` | ❌ | Not available in workerd |
| `Bun.openInEditor()` | ❌ | Not available in workerd |
| `Bun.generateHeapSnapshot()` | ❌ | Not available in workerd |

### bun:sqlite

| API | Status | Notes |
|-----|--------|-------|
| `Database` class | ✅ | In-memory |
| `Database.open()` | ✅ | |
| `Database.close()` | ✅ | |
| `db.exec()` | ✅ | |
| `db.query()` | ✅ | |
| `db.prepare()` | ✅ | |
| `db.transaction()` | ✅ | |
| `Statement.all()` | ✅ | |
| `Statement.get()` | ✅ | |
| `Statement.run()` | ✅ | |
| `Statement.values()` | ✅ | |
| `Statement.finalize()` | ✅ | |
| WAL mode | ❌ | In-memory only |
| File persistence | ❌ | In-memory only |

### bun:ffi

Not available in workerd - throws `ERR_WORKERD_UNAVAILABLE`.

### bun:test

Stubs only - throws `ERR_WORKERD_UNAVAILABLE`.

## Architecture

```
src/bun/
├── bun.ts           # Core Bun API (795 lines)
├── sqlite.ts        # SQLite implementation (~1170 lines)
├── test.ts          # Test stubs
├── ffi.ts           # FFI stubs
├── internal/
│   ├── errors.ts    # Error types (34 lines)
│   └── types.ts     # Type guards (13 lines)
├── build.ts         # Bundle build script (~650 lines)
├── run-tests.ts     # Test runner
├── bun.test.ts      # Unit tests (170 tests)
├── sqlite.test.ts   # SQLite tests (83 tests)
└── bun-worker.test.ts # Integration tests (35 tests)

dist/bun/
├── bun-bundle.js    # Standalone bundle (~15KB, REAL implementations)
├── bun.js           # Individual module
├── sqlite.js        # Individual module
├── test.js          # Individual module
└── ffi.js           # Individual module

samples/bun-bundle/
├── config.capnp     # Workerd config
└── worker.js        # Sample worker
```

## Native bun:* Support (Future)

The codebase also includes C++ integration for native `bun:*` module support:

- `src/workerd/api/bun/bun.h` - C++ module registration
- `src/workerd/api/bun/BUILD.bazel` - Bazel build target
- `src/bun/BUILD.bazel` - TypeScript to Cap'n Proto bundle

To enable native imports (`import Bun from 'bun:bun'`), workerd must be built from source:

```bash
bazel build //src/workerd/server:workerd
```

Note: Building from source requires Linux or macOS with Xcode 15. Xcode 16 has known compatibility issues with capnp-cpp.

## License

Apache 2.0
