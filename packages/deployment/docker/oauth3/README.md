# OAuth3 Docker Deployments

TEE-based OAuth3 agent deployments for different TEE environments.

## Environments

### Local Development (Simulated TEE)
```bash
docker compose -f dstack.compose.yaml --profile local up
```

### dStack (Intel TDX)
Requires Intel TDX-enabled hardware:
```bash
docker compose -f dstack.compose.yaml --profile testnet up
```

### Phala Network
Standard cloud deployment using Phala's TEE abstraction:
```bash
# Testnet
docker compose -f phala.compose.yaml --profile testnet up

# Mainnet
docker compose -f phala.compose.yaml --profile mainnet up
```

## Configuration

Copy `env.example` from `packages/oauth3/docker/` and configure:
- OAuth provider credentials (Google, GitHub, Twitter, Discord)
- Chain configuration (RPC URL, Chain ID)
- MPC settings (threshold, party count)
- Storage endpoints (DWS/IPFS)

## Architecture

Each deployment runs 3 OAuth3 agent nodes in a 2-of-3 MPC configuration:
- Node 1: Primary coordinator
- Node 2-3: MPC participants

Traffic is load-balanced via nginx with sticky sessions for OAuth callbacks.

## Building

Images are built from `packages/oauth3/docker/`:
```bash
cd ../../oauth3
docker build -t oauth3-agent -f docker/Dockerfile .
docker build -t oauth3-mpc -f docker/Dockerfile.mpc .
```

## Kubernetes

For production Kubernetes deployments, use the Helm chart:
```bash
helm install oauth3 ../kubernetes/helm/oauth3 -f values-testnet.yaml
```
