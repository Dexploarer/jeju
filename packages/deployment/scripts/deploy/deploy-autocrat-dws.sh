#!/bin/bash
set -e

#
# Deploy Autocrat to Pure DWS Infrastructure
#
# This script deploys the autocrat app entirely on decentralized infrastructure:
# - Frontend → IPFS (pinned via DWS)
# - Backend → DWS Compute with Phala TEE
# - Routing → DWS Ingress Controller
# - DNS → *.testnet.jejunetwork.org + *.jns.testnet.jejunetwork.org
#

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║         DEPLOY AUTOCRAT TO PURE DWS INFRASTRUCTURE                   ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if [ -z "$DEPLOYER_PRIVATE_KEY" ]; then
  echo "❌ DEPLOYER_PRIVATE_KEY not set"
  echo "   export DEPLOYER_PRIVATE_KEY=0x..."
  exit 1
fi

echo "✅ Prerequisites OK"
echo ""

# Load DWS testnet config
if [ -f ".env.dws-testnet" ]; then
  source .env.dws-testnet
  echo "📝 Loaded DWS testnet configuration"
else
  echo "⚠️  .env.dws-testnet not found, using defaults"
fi

echo ""
echo "🎯 Target Configuration:"
echo "   Network: testnet"
echo "   DWS: ${DWS_URL:-https://dws.testnet.jejunetwork.org}"
echo "   TEE: Phala (${PHALA_API_KEY:0:20}...)"
echo "   DNS: *.testnet.jejunetwork.org, *.jns.testnet.jejunetwork.org"
echo ""

# Step 1: Build frontend
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Step 1: Building Autocrat Frontend"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd apps/autocrat

if [ ! -d "dist" ]; then
  echo "Building frontend..."
  bun run build:frontend
else
  echo "✅ Build directory exists, skipping build"
fi

cd ../..
echo ""

# Step 2: Upload to IPFS via DWS
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "☁️  Step 2: Uploading Frontend to IPFS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Use the existing upload-frontends script
bun run packages/deployment/scripts/deploy/upload-frontends.ts testnet autocrat

echo ""

# Step 3: Register JNS name
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏷️  Step 3: Registering JNS Name"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Register autocrat.jeju → IPFS CID
bun run packages/deployment/scripts/deploy/register-jns.ts testnet

echo ""

# Step 4: Deploy backend to DWS
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Step 4: Deploying Backend to DWS Compute"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

bun run packages/deployment/scripts/deploy/deploy-app-to-dws-full.ts autocrat testnet

echo ""

# Step 5: Verify deployment
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Step 5: Verifying Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Testing endpoints..."

# Test frontend
echo -n "  Frontend (*.testnet.jejunetwork.org): "
if curl -sS -o /dev/null -w "%{http_code}" https://autocrat.testnet.jejunetwork.org/ | grep -q "200"; then
  echo "✅"
else
  echo "⚠️  Not ready yet (may take a few minutes)"
fi

# Test backend
echo -n "  Backend API (/health): "
if curl -sS -o /dev/null -w "%{http_code}" https://autocrat.testnet.jejunetwork.org/health | grep -q "200"; then
  echo "✅"
else
  echo "⚠️  Not ready yet"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 DEPLOYMENT COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📍 Access your app at:"
echo "   https://autocrat.testnet.jejunetwork.org/"
echo "   https://autocrat.jns.testnet.jejunetwork.org/"
echo ""
echo "🏗️  Infrastructure:"
echo "   Frontend: IPFS (decentralized)"
echo "   Backend: DWS Compute with Phala TEE"
echo "   Routing: DWS Ingress Controller"
echo "   DNS: Both patterns supported"
echo ""
echo "✅ Running entirely on decentralized infrastructure!"
echo ""
