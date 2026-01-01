FROM oven/bun:1.1.27

WORKDIR /app

# Copy package files
COPY package.json ./
COPY bun.lock* ./

# Install dependencies
RUN bun install --production

# Copy source
COPY server.ts ./

# Create data directory
RUN mkdir -p /data/sqlit/databases

ENV PORT=8546
ENV DATA_DIR=/data/sqlit/databases

EXPOSE 8546

CMD ["bun", "run", "server.ts"]
