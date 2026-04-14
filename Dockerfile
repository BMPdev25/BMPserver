# ============================================================
# Stage 1: Builder — Install ALL dependencies
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests first (leverages Docker layer cache)
COPY package.json package-lock.json ./

# Clean install all dependencies (including devDependencies)
# This stage exists so that if a build step is ever added (e.g., TypeScript),
# it can run here without polluting the production image.
RUN npm ci

# Copy the application source code
COPY . .

# ============================================================
# Stage 2: Production Runner — Minimal, secure runtime image
# ============================================================
FROM node:20-alpine AS production

# Harden: don't run as root, set production mode
ENV NODE_ENV=production

WORKDIR /app

# Copy dependency manifests and install ONLY production deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy application source from builder
# (In a TypeScript project, you'd COPY --from=builder /app/dist ./dist instead)
COPY --from=builder /app/server.js ./
COPY --from=builder /app/config ./config
COPY --from=builder /app/controllers ./controllers
COPY --from=builder /app/middleware ./middleware
COPY --from=builder /app/models ./models
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/services ./services
COPY --from=builder /app/utils ./utils
COPY --from=builder /app/jobs ./jobs
COPY --from=builder /app/public ./public

# Security: run as the built-in non-root 'node' user
USER node

# Expose the application port
EXPOSE 5000

# Health check (optional but recommended for production)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/metadata', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })" || exit 1

# Start the server
CMD ["node", "server.js"]
