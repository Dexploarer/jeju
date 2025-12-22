# Port Allocations

Standard port assignments for Jeju services.

## Applications

| Service | Port | Description |
|---------|------|-------------|
| Gateway | 4001 | Bridge, staking, registration UI |
| Gateway A2A | 4003 | Agent-to-Agent protocol |
| Bazaar | 4006 | DeFi, NFTs, launchpad UI |
| Compute | 4007 | AI inference marketplace |
| Storage | 4010 | IPFS/Arweave storage |
| Crucible | 4020 | Agent orchestration |
| Indexer GraphQL | 4350 | Blockchain data API |
| Documentation | 4004 | This site |
| Facilitator | 3402 | x402 payment verification |

## Chain Infrastructure

| Service | Port | Description |
|---------|------|-------------|
| L1 RPC | 6545 | Local Ethereum L1 (avoids Anvil/Hardhat 8545) |
| L2 RPC (HTTP) | 6546 | Jeju JSON-RPC |
| L2 RPC (WS) | 6547 | Jeju WebSocket |
| L1 Beacon | 4000 | Consensus layer |

## Supporting Services

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 23798 | Indexer database |
| IPFS API | 5001 | IPFS node API |
| IPFS Gateway | 8080 | IPFS HTTP gateway |
| IPFS Swarm | 4100 | IPFS peer connections |
| Ollama | 11434 | Local LLM inference |

## Monitoring

| Service | Port | Description |
|---------|------|-------------|
| Prometheus | 9090 | Metrics collection |
| Grafana | 4009 | Dashboards |

## Override Ports

Set environment variables to change default ports:

```bash
# In .env.local
GATEWAY_PORT=5001
BAZAAR_PORT=5006
INDEXER_GRAPHQL_PORT=5350
L2_RPC_PORT=6546
```

## Port Conflicts

If a port is in use:

```bash
# Find process using port
lsof -i :6546

# Kill it
kill -9 <PID>

# Or use cleanup script
bun run cleanup
```

## Docker Port Mapping

When running in Docker, map to host ports:

```yaml
services:
  gateway:
    ports:
      - "4001:4001"  # host:container
  indexer:
    ports:
      - "4350:4350"
```
