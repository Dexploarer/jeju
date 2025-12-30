# DWS Migration Guide: AWS → Pure Decentralized Infrastructure

Complete guide for migrating Jeju testnet apps from AWS/Kubernetes to pure decentralized infrastructure using DWS.

## Overview

**Current State**: Apps run on AWS EKS with ALB ingress, serving placeholder static pages
**Target State**: Apps run entirely on decentralized infrastructure

- Frontend → IPFS (pinned via DWS)
- Backend → DWS Compute (with Phala TEE)
- Routing → DWS Ingress Controller
- DNS → `*.testnet.jejunetwork.org` + `*.jns.testnet.jejunetwork.org`

## Architecture

### Before (AWS)
```
DNS: *.testnet.jejunetwork.org
  ↓
AWS Route 53
  ↓
AWS ALB (Application Load Balancer)
  ↓
EKS Kubernetes Ingress
  ↓
nginx pods → Static placeholder HTML
  ↓
❌ No backend, no real app
```

### After (Pure DWS)
```
DNS: *.testnet.jejunetwork.org OR *.jns.testnet.jejunetwork.org
  ↓
DWS Ingress Controller
  ├─ / → JNS Gateway → IPFS (frontend)
  └─ /api/* → DWS Compute (backend with TEE)
```

## Key Components

### 1. **Frontend on IPFS**
- Built with `bun run build:frontend`
- Uploaded to IPFS via DWS Storage API
- Pinned permanently on DWS nodes
- Registered in JNS (Jeju Name Service)
- Served via JNS Gateway

### 2. **Backend on DWS Compute**
- Deployed to DWS compute marketplace
- Runs in Phala TEE (Trusted Execution Environment)
- Serverless/edge computing model
- Scales automatically (min/max instances)
- Attestation for security

### 3. **JNS (Jeju Name Service)**
- On-chain name registry (like ENS)
- Maps `appname.jeju` → IPFS contenthash
- Resolves via JNS Gateway
- Enables decentralized frontend serving

### 4. **DWS Ingress Controller**
- Routes requests based on host/path
- Supports both DNS patterns:
  - `appname.testnet.jejunetwork.org` (primary, less ugly)
  - `appname.jns.testnet.jejunetwork.org` (explicit JNS)
- Handles TLS/HTTPS automatically
- Distributed rate limiting

### 5. **Phala TEE Integration**
- Confidential computing platform
- API Key: `phak_ycVEhuwQsLmTzQRaFVkTeWAx9Sk5qWujbU2H4Ki4Mh4`
- Provides attestation for backend integrity
- Required for sensitive operations (keys, AI, etc.)

## Configuration Files

### App Manifest (`jeju-manifest.json`)

Each app defines its deployment config:

```json
{
  "name": "autocrat",
  "version": "3.0.0",
  "jns": {
    "name": "autocrat.jeju",
    "url": "https://autocrat.jejunetwork.org"
  },
  "decentralization": {
    "frontend": {
      "ipfs": true,
      "buildDir": "dist",
      "jnsName": "autocrat.jeju"
    }
  },
  "dws": {
    "backend": {
      "enabled": true,
      "runtime": "bun",
      "entrypoint": "api/server.ts",
      "memory": 512,
      "minInstances": 1,
      "maxInstances": 10,
      "teeRequired": true
    },
    "tee": {
      "enabled": true,
      "platform": "phala",
      "attestation": true
    }
  }
}
```

### Environment (`.env.dws-testnet`)

```bash
# Network
NETWORK=testnet
DEPLOYER_PRIVATE_KEY=0x...

# TEE
PHALA_API_KEY=phak_ycVEhuwQsLmTzQRaFVkTeWAx9Sk5qWujbU2H4Ki4Mh4

# Endpoints
DWS_URL=https://dws.testnet.jejunetwork.org
IPFS_GATEWAY_URL=https://ipfs.testnet.jejunetwork.org

# Settings
APIS_DECENTRALIZED=true
FRONTEND_ON_IPFS=true
BACKEND_ON_DWS=true
```

## Deployment Scripts

### Quick Deploy (All-in-One)

Deploy autocrat to pure DWS:
```bash
export DEPLOYER_PRIVATE_KEY=0x...
./packages/deployment/scripts/deploy/deploy-autocrat-dws.sh
```

### Manual Step-by-Step

#### 1. Upload Frontend to IPFS
```bash
cd apps/autocrat
bun run build:frontend
cd ../..

bun run packages/deployment/scripts/deploy/upload-frontends.ts testnet
```

Output:
```
✅ autocrat
   Root CID: QmXXXXXXXXXXXXXXXXXX
   Index CID: QmYYYYYYYYYYYYYYYYYY
   JNS: autocrat.jeju
```

#### 2. Register JNS Name
```bash
bun run packages/deployment/scripts/deploy/register-jns.ts testnet
```

This:
- Registers `autocrat.jeju` (if not registered)
- Sets contenthash → IPFS CID
- Makes frontend discoverable via JNS

#### 3. Deploy Backend to DWS
```bash
bun run packages/deployment/scripts/deploy/deploy-app-to-dws-full.ts autocrat testnet
```

This:
- Packages backend code
- Deploys to DWS compute
- Configures Phala TEE
- Creates ingress rules
- Tests deployment

#### 4. Verify
```bash
# Frontend (from IPFS)
curl https://autocrat.testnet.jejunetwork.org/

# Backend API
curl https://autocrat.testnet.jejunetwork.org/health

# JNS resolution
curl https://autocrat.jns.testnet.jejunetwork.org/
```

## DNS Configuration

### Both Patterns Supported

1. **Primary** (less ugly): `*.testnet.jejunetwork.org`
   - More user-friendly
   - Hides JNS implementation detail
   - Example: `https://autocrat.testnet.jejunetwork.org`

2. **Explicit JNS**: `*.jns.testnet.jejunetwork.org`
   - Makes JNS usage clear
   - Aligns with JNS Gateway
   - Example: `https://autocrat.jns.testnet.jejunetwork.org`

### How It Works

**Option 1: Direct JNS Gateway**
```
autocrat.jns.testnet.jejunetwork.org
  ↓
DWS JNS Gateway
  ↓
Resolve autocrat.jeju → IPFS CID
  ↓
Fetch from IPFS
```

**Option 2: Ingress Proxy**
```
autocrat.testnet.jejunetwork.org
  ↓
DWS Ingress Controller
  ↓
Route based on path:
  / → JNS Gateway → IPFS
  /api → DWS Compute
```

### DNS Records

Currently pointing to AWS ALB. Need to update to DWS:

```bash
# Get DWS Ingress IP
kubectl get svc -n dws dws-ingress-controller

# Update DNS (Route 53 or your DNS provider)
*.testnet.jejunetwork.org → <DWS_INGRESS_IP>
*.jns.testnet.jejunetwork.org → <JNS_GATEWAY_IP>
```

## Migration Checklist

For each app in `apps/`:

- [ ] **Review manifest** - Ensure `jeju-manifest.json` has:
  - `jns.name` defined
  - `decentralization.frontend` configured
  - `dws.backend` configured if has API
  - `dws.tee` configured if needs TEE

- [ ] **Build frontend**
  ```bash
  cd apps/<appname>
  bun run build:frontend
  ```

- [ ] **Upload to IPFS**
  ```bash
  bun run packages/deployment/scripts/deploy/upload-frontends.ts testnet
  ```

- [ ] **Register JNS**
  ```bash
  bun run packages/deployment/scripts/deploy/register-jns.ts testnet
  ```

- [ ] **Deploy backend** (if applicable)
  ```bash
  bun run packages/deployment/scripts/deploy/deploy-app-to-dws-full.ts <appname> testnet
  ```

- [ ] **Configure ingress**
  - Ensure both DNS patterns route correctly
  - Frontend → IPFS
  - API → DWS backend

- [ ] **Test**
  - Frontend loads
  - API responds
  - Both DNS patterns work

- [ ] **Monitor**
  - Check DWS metrics
  - Verify TEE attestation
  - Monitor IPFS pinning

## Routing Configuration

### Frontend Routing (SPA)

For single-page apps (React, etc.):

```json
// In jeju-manifest.json
{
  "decentralization": {
    "frontend": {
      "spa": true
    }
  }
}
```

JNS Gateway will:
- Serve `index.html` for all routes
- Enable client-side routing
- Set proper MIME types

### API Routing

Backend endpoints are proxied through ingress:

```
https://autocrat.testnet.jejunetwork.org/api/v1/proposals
  ↓
DWS Ingress
  ↓
Match path: /api/*
  ↓
Route to: DWS Compute Worker
  ↓
Autocrat backend (running in TEE)
```

### CORS Configuration

Backends need to allow both domains:

```typescript
// apps/autocrat/api/server.ts
const ALLOWED_ORIGINS = [
  'https://autocrat.testnet.jejunetwork.org',
  'https://autocrat.jns.testnet.jejunetwork.org',
  'https://testnet.jejunetwork.org',
]
```

## Troubleshooting

### Frontend Not Loading

**Symptom**: `https://autocrat.testnet.jejunetwork.org` returns 404

**Checks**:
1. Is frontend uploaded to IPFS?
   ```bash
   cat packages/deployment/frontend-upload-result-testnet.json
   ```

2. Is JNS contenthash set?
   ```bash
   bun run packages/deployment/scripts/deploy/register-jns.ts testnet
   ```

3. Is JNS Gateway running?
   ```bash
   curl https://jns.testnet.jejunetwork.org/health
   ```

4. Can you access via JNS pattern?
   ```bash
   curl https://autocrat.jns.testnet.jejunetwork.org/
   ```

### Backend API Not Responding

**Symptom**: `/health` or `/api/*` returns 404/502

**Checks**:
1. Is backend deployed to DWS?
   ```bash
   curl https://dws.testnet.jejunetwork.org/compute/workers
   ```

2. Is ingress rule created?
   ```bash
   curl https://dws.testnet.jejunetwork.org/ingress/rules
   ```

3. Check backend logs:
   ```bash
   # Via DWS API
   curl https://dws.testnet.jejunetwork.org/compute/workers/<worker-id>/logs
   ```

### TEE Attestation Failing

**Symptom**: Backend fails to start with TEE error

**Checks**:
1. Is Phala API key set?
   ```bash
   echo $PHALA_API_KEY
   ```

2. Is TEE platform configured?
   ```bash
   # In jeju-manifest.json
   "dws": {
     "tee": {
       "platform": "phala"
     }
   }
   ```

3. Try without TEE first:
   ```json
   "dws": {
     "tee": {
       "enabled": false
     }
   }
   ```

### DNS Not Resolving

**Symptom**: Domain doesn't resolve or points to wrong place

**Checks**:
1. Check DNS records:
   ```bash
   dig autocrat.testnet.jejunetwork.org
   dig autocrat.jns.testnet.jejunetwork.org
   ```

2. Verify ingress IP:
   ```bash
   kubectl get svc -n dws
   ```

3. Test direct IP access:
   ```bash
   curl -H "Host: autocrat.testnet.jejunetwork.org" http://<INGRESS_IP>/
   ```

## Monitoring & Observability

### DWS Metrics

```bash
# Worker health
curl https://dws.testnet.jejunetwork.org/compute/workers/<worker-id>/health

# IPFS pin status
curl https://dws.testnet.jejunetwork.org/storage/pins

# Ingress stats
curl https://dws.testnet.jejunetwork.org/ingress/stats
```

### JNS Status

```bash
# Resolve a name
curl "https://dws.testnet.jejunetwork.org/api/resolve/autocrat.jeju"

# Check contenthash
# Via contract call to JNSResolver
```

### TEE Attestation

```bash
# Get attestation report
curl https://dws.testnet.jejunetwork.org/compute/workers/<worker-id>/attestation
```

## Next Steps

1. **Deploy Autocrat** (first app)
   ```bash
   ./packages/deployment/scripts/deploy/deploy-autocrat-dws.sh
   ```

2. **Migrate Other Apps**
   - bazaar
   - crucible
   - factory
   - gateway
   - wallet
   - monitoring
   - etc.

3. **Update DNS**
   - Point `*.testnet.jejunetwork.org` to DWS Ingress
   - Add `*.jns.testnet.jejunetwork.org` → JNS Gateway

4. **Decommission AWS**
   - Scale down EKS deployments
   - Remove ALB
   - Cancel AWS resources

5. **Document**
   - Record deployment process
   - Document any issues
   - Create runbooks

## Benefits

✅ **Fully Decentralized**: No AWS, no central points of failure
✅ **Cost Effective**: Pay only for actual usage via dws marketplace
✅ **Censorship Resistant**: IPFS + on-chain names
✅ **Secure**: TEE for backend, content-addressed for frontend
✅ **Scalable**: Auto-scaling via dws compute
✅ **Transparent**: On-chain registry, open protocols

## Support

- **Documentation**: This file
- **Scripts**: `packages/deployment/scripts/deploy/`
- **Issues**: Check logs in DWS dashboard
- **Phala TEE**: https://docs.phala.network

---

**Ready to migrate?** Start with autocrat, then apply the pattern to all apps!
