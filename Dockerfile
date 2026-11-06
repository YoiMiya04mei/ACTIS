# syntax=docker/dockerfile:1

# ==============================================================================
# STAGE 1: Base Alpine Image with Required System Libraries
# ==============================================================================
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl

# ==============================================================================
# STAGE 2: Dependencies Installation
# ==============================================================================
FROM base AS deps
WORKDIR /app

# Salin manifest dependencies dan schema Prisma
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Install seluruh dependencies secara deterministik
RUN npm ci

# Generate Prisma Client untuk environment Linux
RUN npx prisma generate

# ==============================================================================
# STAGE 3: Next.js Production Build
# ==============================================================================
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV BUILD_STANDALONE=true
ENV NODE_ENV=production

# Compile Next.js 15 ke format standalone
RUN npm run build

# ==============================================================================
# STAGE 4: Production Runner (Lightweight Minimal Container)
# ==============================================================================
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:/app/prisma/dev.db"

# Buat grup dan user non-root untuk keamanan server
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Salin public assets & schema
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

# Salin Next.js Standalone server dan file statis
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Salin Prisma CLI agar database auto-sync saat container start
COPY --from=deps /app/node_modules/prisma ./node_modules/prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=deps /app/node_modules/.bin ./node_modules/.bin

# Salin entrypoint script
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Pastikan folder penyimpanan data dan upload memiliki hak akses yang benar
RUN mkdir -p /app/prisma /app/public/uploads && \
    chown -R nextjs:nodejs /app/prisma /app/public/uploads

USER nextjs

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]

