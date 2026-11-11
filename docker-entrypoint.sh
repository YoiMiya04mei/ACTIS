#!/bin/sh
set -e

echo "==> [ACTIS] Initializing Application Environment with PostgreSQL..."

# Pastikan folder uploads tersedia
mkdir -p /app/public/uploads

# Sinkronisasi skema database PostgreSQL via Prisma
echo "==> [ACTIS] Synchronizing PostgreSQL Database Schema via Prisma..."
if [ -f "/opt/prisma/node_modules/prisma/build/index.js" ]; then
  node /opt/prisma/node_modules/prisma/build/index.js db push --skip-generate --schema=./prisma/schema.prisma
else
  npx prisma db push --skip-generate
fi

# Jika variabel INITIAL_SEED=true diaktifkan, jalankan initial seed
if [ "$INITIAL_SEED" = "true" ]; then
  echo "==> [ACTIS] Running Initial Database Seed for PostgreSQL..."
  node prisma/seed.js || true
fi

echo "==> [ACTIS] Database synchronized! Starting Next.js Production Server..."
exec "$@"
