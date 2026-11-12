# syntax=docker/dockerfile:1

# ==============================================================================
# STAGE 1: Base Alpine Image with Required System Libraries
# ==============================================================================
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl libcap

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

# Bundel Prisma CLI beserta seluruh dependensi transitifnya (seperti effect, c12, dll.) ke /opt/prisma
RUN node -e ' \
  const fs = require("fs"); \
  const path = require("path"); \
  const visited = new Set(); \
  function visit(pkgDir) { \
    const pkgPath = path.join(pkgDir, "package.json"); \
    if (!fs.existsSync(pkgPath) || visited.has(pkgDir)) return; \
    visited.add(pkgDir); \
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")); \
    const deps = { ...(pkg.dependencies || {}), ...(pkg.optionalDependencies || {}) }; \
    for (const dep of Object.keys(deps)) { \
      let cur = pkgDir; \
      while (true) { \
        const candidate = path.join(cur, "node_modules", dep); \
        if (fs.existsSync(candidate)) { visit(candidate); break; } \
        const parent = path.dirname(cur); \
        if (parent === cur) break; \
        cur = parent; \
      } \
    } \
  } \
  visit(path.resolve("node_modules/prisma")); \
  const rootNm = path.resolve("node_modules"); \
  const sorted = [...visited].sort((a, b) => a.length - b.length); \
  const topDirs = sorted.filter((d) => !sorted.some((p) => p !== d && d.startsWith(p + path.sep))); \
  fs.mkdirSync("/opt/prisma/node_modules/.bin", { recursive: true }); \
  for (const dir of topDirs) { \
    const rel = path.relative(rootNm, dir); \
    const dst = path.join("/opt/prisma/node_modules", rel); \
    fs.mkdirSync(path.dirname(dst), { recursive: true }); \
    fs.cpSync(dir, dst, { recursive: true, dereference: true }); \
  } \
' && ln -sf ../prisma/build/index.js /opt/prisma/node_modules/.bin/prisma && \
    chmod +x /opt/prisma/node_modules/prisma/build/index.js

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

# Salin generated Prisma Client & isolated Prisma CLI lengkap beserta dependensinya
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=deps --chown=nextjs:nodejs /opt/prisma /opt/prisma
RUN mkdir -p ./node_modules/.bin && \
    ln -sf /opt/prisma/node_modules/prisma/build/index.js ./node_modules/.bin/prisma
ENV PATH="/opt/prisma/node_modules/.bin:${PATH}"

# Salin entrypoint script
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Pastikan folder penyimpanan data dan upload memiliki hak akses yang benar
RUN mkdir -p /app/prisma /app/public/uploads /app/data && \
    chown -R nextjs:nodejs /app/prisma /app/public/uploads /app/data /app/node_modules/.bin && \
    setcap 'cap_net_bind_service=+ep' /usr/local/bin/node || true

USER nextjs

# Verifikasi saat build bahwa Prisma CLI & @prisma/client dapat dijalankan tanpa missing module
RUN DATABASE_URL="postgresql://postgres:postgres@localhost:5432/actis_db?schema=public" \
    node /opt/prisma/node_modules/prisma/build/index.js validate --schema=./prisma/schema.prisma && \
    node -e "require('@prisma/client')"

EXPOSE 3000 49

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]

