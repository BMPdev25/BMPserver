# ============================================================
# Stage 1: Dependencies — install prod deps with clean cache
# ============================================================
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./

# npm ci is deterministic (respects lock file) and faster than npm install.
# node:20-alpine ships npm v10 which supports lockfileVersion 3.
RUN npm ci --omit=dev && npm cache clean --force

# ============================================================
# Stage 2: Production Runner — minimal, secure runtime image
# ============================================================
FROM node:20-alpine AS production

ENV NODE_ENV=production

WORKDIR /app

# Reuse the already-pruned node_modules from the deps stage —
# no second npm install, no second network round-trip.
COPY --from=deps /app/node_modules ./node_modules

# Copy application source in one layer.
# What lands here is controlled by .dockerignore (dev files, tests, seeds, etc. are excluded).
COPY . .

# Security: run as the built-in non-root 'node' user
USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/metadata', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })" || exit 1

CMD ["node", "server.js"]
