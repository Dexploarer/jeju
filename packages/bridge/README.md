# @jeju/zksolbridge

Production-grade Solana↔EVM bridge with ZK Light Client verification. Trustless, no intermediaries.

## Architecture

Zero-knowledge proof verification for maximum security - no validators, no multisigs, just math.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ZKSOLBRIDGE INFRASTRUCTURE                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐                           ┌─────────────────┐      │
│  │   EVM Chains    │◄─────── Relayer ─────────►│     Solana      │      │
│  │ (ETH/Base/Arb/  │         Service           │                 │      │
│  │  OP/BSC/Jeju)   │                           │                 │      │
│  └────────┬────────┘                           └────────┬────────┘      │
│           │                                             │               │
│  ┌────────▼────────┐      ┌─────────────┐      ┌────────▼────────┐      │
│  │ Solana Light    │◄─────│   SP1       │─────►│ EVM Light       │      │
│  │ Client (ZK)     │      │   Prover    │      │ Client (ZK)     │      │
│  │ • Groth16       │      │   Service   │      │ • BN254         │      │
│  │ • Consensus     │      │             │      │ • Sync Cmte     │      │
│  └─────────────────┘      └─────────────┘      └─────────────────┘      │
│                                  │                                       │
│  ┌───────────────────────────────┴───────────────────────────────┐      │
│  │                         ZK Circuits (SP1)                      │      │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐ │      │
│  │  │ Ed25519    │  │ Solana     │  │ Ethereum   │  │ Transfer │ │      │
│  │  │ Batch Sig  │  │ Consensus  │  │ Consensus  │  │ Inclusion│ │      │
│  └──┴────────────┴──┴────────────┴──┴────────────┴──┴──────────┴─┘      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Features

- **Bidirectional Bridging**: Transfer tokens in both directions (EVM↔Solana)
- **ZK Light Clients**: Trustless verification via zero-knowledge proofs
- **Native Cross-Chain Tokens**: No wrapped naming
- **TEE Batching**: Efficient proof aggregation to reduce costs
- **Self-Hosted**: Run your own proving infrastructure
- **DAO-Governed**: Fees and parameters controlled by Council

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) >= 1.0
- [Foundry](https://getfoundry.sh) (for EVM contracts)
- [Anchor](https://www.anchor-lang.com) (for Solana programs)
- [SP1](https://docs.succinct.xyz) (for ZK proving)

### Installation

```bash
cd packages/bridge
bun install
```

### Local Development

```bash
# Start local EVM (Anvil) + Solana Test Validator
bun run local:start

# Deploy contracts
bun run deploy:local

# Run the orchestrator
bun run orchestrator:local
```

### Testnet Deployment

```bash
# Deploy to testnets
bun run deploy:testnet

# Run orchestrator in testnet mode
bun run orchestrator:testnet
```

### ZK Setup

```bash
# Install SP1 toolchain
bun run setup:sp1

# Build ZK circuits
bun run build:circuits
```

## Bridge Performance

Trustless transfers with cryptographic verification:

| Route | Time | Security |
|-------|------|----------|
| EVM → Solana | ~10-15 min | ZK proof of consensus |
| Solana → EVM | ~10-15 min | ZK proof of consensus |

## Configuration

### Environment Variables

```bash
# EVM RPC endpoints
ETH_RPC_URL=https://eth.llamarpc.com
BASE_RPC_URL=https://mainnet.base.org
JEJU_RPC_URL=https://rpc.jeju.network

# Solana RPC
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Prover configuration
PROVER_MODE=self-hosted  # or 'succinct-network'
PROVER_WORKERS=4

# TEE endpoint (optional, for batching)
TEE_ENDPOINT=http://localhost:8080/tee
```

### Fee Configuration

Fees are governed by `FeeConfig.sol` and can be changed via Council:

```solidity
struct DeFiFees {
    uint16 swapProtocolFeeBps;    // 5 = 0.05%
    uint16 bridgeFeeBps;          // 10 = 0.1%
    uint16 crossChainMarginBps;   // 1000 = 10%
}
```

## File Structure

```
packages/bridge/
├── circuits/                 # SP1 ZK circuits
│   ├── ed25519/              # Ed25519 batch signature
│   ├── consensus/            # Solana consensus proof
│   ├── ethereum/             # Ethereum sync committee
│   └── state/                # Transfer inclusion proof
├── contracts/                # Solidity contracts
│   ├── bridges/              # Light client & bridge
│   ├── verifiers/            # Groth16 verifier
│   └── tokens/               # Cross-chain token
├── programs/                 # Solana Anchor programs
│   ├── evm-light-client/     # Ethereum light client
│   └── token-bridge/         # Token bridge program
├── geyser/                   # Data ingestion
│   ├── consensus-plugin/     # Solana Geyser plugin
│   └── ethereum-watcher/     # Beacon chain watcher
├── prover/                   # ZK proving infrastructure
│   └── services/             # SP1 prover service
├── src/                      # TypeScript SDK
│   ├── clients/              # EVM & Solana clients
│   ├── tee/                  # TEE batching service
│   ├── relayer/              # Cross-chain orchestration
│   └── monitoring/           # Health & metrics
├── config/                   # Configuration files
│   ├── local.json
│   ├── testnet.json
│   └── mainnet.json
└── tests/                    # Test suites
    ├── unit/
    ├── integration/
    └── e2e/
```

## Monitoring

The bridge exposes health and metrics endpoints:

```bash
# System health
curl http://localhost:8083/monitoring/health

# Metrics (Prometheus format)
curl http://localhost:8083/monitoring/metrics

# Readiness (for k8s)
curl http://localhost:8083/monitoring/ready
```

## Security

- **ZK Proofs**: All cross-chain state verified cryptographically
- **Light Clients**: No trusted intermediaries or multisigs
- **TEE Attestation**: Optional for enhanced batch verification
- **Replay Protection**: Nonces prevent double-spending

## Related

- `@jeju/token` - Token deployment
- `packages/contracts/src/eil/` - Cross-chain paymaster
- `apps/council/` - DAO governance for fee changes
