# Jeju EQLite Multi-Stage Build
#
# Builds EQLite from the internal packages/eqlite source code.
# Produces: eqlited, eqlite-minerd, eqlite (CLI), eqlite-proxy
#
# Build:
#   docker compose -f eqlite-internal.compose.yaml build
#
# Run:
#   docker run -e EQLITE_ROLE=miner jeju-eqlite:latest

# ============================================================================
# Stage 1: Builder - Uses same setup as packages/eqlite/docker/builder.Dockerfile
# ============================================================================
FROM golang:1.23-alpine AS builder

# Install build dependencies (including ICU for sqlite_icu)
RUN apk add --no-cache \
    git \
    make \
    gcc \
    g++ \
    musl-dev \
    sqlite-dev \
    linux-headers \
    ca-certificates \
    icu-dev

# Set Go environment
ENV CGO_ENABLED=1
ENV GOOS=linux
ENV GO111MODULE=on

# Use same working directory as original eqlite Makefile expects
WORKDIR /go/src/eqlite

# Copy go.mod and go.sum first for better caching
COPY go.mod go.sum ./
RUN go mod download

# Copy all source code
COPY . .

# Build using the Makefile (same as `make build-release`)
RUN make clean 2>/dev/null || true && make -j$(nproc) build-release

# Create entrypoint script in builder stage
RUN cat > bin/docker-entry.sh << 'ENTRYEOF'
#!/bin/sh
set -e

# Determine which binary to run based on EQLITE_ROLE
case "${EQLITE_ROLE}" in
  blockproducer|bp)
    BINARY="eqlited"
    ;;
  miner)
    BINARY="eqlite-minerd"
    ;;
  adapter|proxy)
    if [ -f "/app/eqlite-proxy" ]; then
      BINARY="eqlite-proxy"
    else
      BINARY="eqlite"
      EXTRA_ARGS="adapter"
    fi
    ;;
  explorer)
    BINARY="eqlite"
    EXTRA_ARGS="explorer"
    ;;
  mysql-adapter)
    BINARY="eqlite-mysql-adapter"
    ;;
  *)
    echo "Unknown EQLITE_ROLE: ${EQLITE_ROLE}"
    echo "Valid roles: blockproducer, miner, adapter, explorer, mysql-adapter"
    exit 1
    ;;
esac

# Build config path
CONFIG_FILE="${EQLITE_CONF:-/config/config.yaml}"

echo "Starting EQLite ${EQLITE_ROLE} with config: ${CONFIG_FILE}"
exec /app/${BINARY} -config "${CONFIG_FILE}" ${EXTRA_ARGS} "$@"
ENTRYEOF
RUN chmod +x bin/docker-entry.sh

# ============================================================================
# Stage 2: Runtime - Minimal Alpine image
# ============================================================================
FROM alpine:3.22

# Include ICU libs for dynamic linking and other runtime dependencies
RUN apk --no-cache add ca-certificates icu-libs musl libgcc libstdc++ sqlite-libs wget netcat-openbsd

WORKDIR /app

# Copy core binaries from builder (these are always built)
COPY --from=builder /go/src/eqlite/bin/eqlited /app/
COPY --from=builder /go/src/eqlite/bin/eqlite-minerd /app/
COPY --from=builder /go/src/eqlite/bin/eqlite /app/
COPY --from=builder /go/src/eqlite/bin/eqlite-proxy /app/
COPY --from=builder /go/src/eqlite/bin/docker-entry.sh /app/

# Create directories
RUN mkdir -p /config /data /logs && chmod 755 /app/docker-entry.sh

# Default environment
ENV EQLITE_ROLE=miner
ENV EQLITE_CONF=/config/config.yaml

# Ports:
# 4661: Client connections / Adapter HTTP
# 4662: Node-to-node RPC
# 4663: Kayak consensus
# 8546: HTTP API / WebSocket
EXPOSE 4661 4662 4663 8546

VOLUME ["/config", "/data", "/logs"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -q --spider http://localhost:8546/v1/status || exit 1

ENTRYPOINT ["/app/docker-entry.sh"]
