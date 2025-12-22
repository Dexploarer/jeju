# Docker Deployments

Docker Compose configurations for Jeju infrastructure.

## Local Development

### Localnet (`localnet.compose.yaml`)

Core infrastructure for local development:

```bash
# Via jeju CLI (recommended)
jeju dev

# Or directly with Docker Compose (from monorepo root)
docker compose -f packages/deployment/docker/localnet.compose.yaml up -d
```

Services:
- **IPFS**: Decentralized storage (port 5001, gateway 4180)
- **PostgreSQL**: Indexer database (port 5434)
- **Cache Service**: Redis-compatible cache (port 4115)
- **DA Server**: Data availability (port 4010)
- **JNS Gateway**: Name resolution (port 4005)
- **Trigger Service**: Compute triggers (port 4016)

Profiles:
- Default: Core services only
- `--profile production`: Add Docker-based CQL
- `--profile full`: Add ERC-4337 bundler

### OAuth3 (`oauth3/`)

TEE-based authentication agents. See [oauth3/README.md](oauth3/README.md).

### Farcaster Hubble (`farcaster-hubble/`)

Farcaster hub node for social features.

## Service-Specific Configs

- `covenantsql/`: CovenantSQL database
- `dovecot/`: Email server for auth
- `ipfs/`: IPFS node initialization

## Usage Notes

1. The `jeju dev` command automatically starts required services
2. Build contexts are relative to monorepo root
3. Network name is `jeju` for inter-service communication
4. All services have healthchecks configured

## Volumes

Data persists in Docker volumes:
- `ipfs-data`: IPFS node data
- `cache-data`: Cache service data
- `da-data`: DA server data
- `postgres-data`: PostgreSQL data
