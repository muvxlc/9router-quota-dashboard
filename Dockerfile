# Pinned Node.js 22 LTS Alpine base for Next.js 16 standalone build
FROM node:22.14.0-alpine3.21 AS base
WORKDIR /app

# Dependency installation stage
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Application build stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Ensure public directory exists for copy even if absent in source
RUN mkdir -p /app/public && npm run build

# Production standalone runtime
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=127.0.0.1
ENV PORT=20130

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy Next.js standalone server bundle and static assets
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 20130

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:20130/api/health || exit 1

# ponytail: Next standalone server reads HOSTNAME and PORT env directly.
CMD ["node", "server.js"]
