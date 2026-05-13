# ============================================================
# SHU-HAUL — Dockerfile
# Optimised for Dokploy / any Docker-compatible host.
# ============================================================

FROM node:20-alpine AS base

# Install only production dependencies first (layer caching)
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production --no-audit --no-fund

# Copy application source
COPY . .

# Expose the port (must match PORT env var or default 3000)
EXPOSE 3000

# Healthcheck so the orchestrator knows when the app is ready
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3000}/ || exit 1

# Non-root user for security
RUN addgroup -S shuhaul && adduser -S shuhaul -G shuhaul
USER shuhaul

CMD ["node", "server.js"]
