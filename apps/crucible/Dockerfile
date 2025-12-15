# Crucible - MEV Trading Bot & Agent Orchestration Platform
# Multi-stage build for production deployment

# Build stage
FROM oven/bun:1.1-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package.json bun.lock ./
COPY packages/db/package.json ./packages/db/
COPY apps/crucible/package.json ./apps/crucible/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY packages/db ./packages/db
COPY apps/crucible ./apps/crucible
COPY tsconfig.json ./

# Build
WORKDIR /app/apps/crucible
RUN bun run build

# Production stage
FROM oven/bun:1.1-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S crucible -u 1001 -G nodejs

# Copy built artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/apps/crucible/dist ./apps/crucible/dist
COPY --from=builder /app/apps/crucible/package.json ./apps/crucible/

# Set ownership
RUN chown -R crucible:nodejs /app

USER crucible

WORKDIR /app/apps/crucible

# Expose ports
EXPOSE 4020

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:4020/health || exit 1

# Default command (can be overridden for executor)
CMD ["bun", "run", "dist/server.js"]
