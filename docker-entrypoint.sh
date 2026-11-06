#!/bin/sh
set -e

echo "==> [ACTIS] Initializing Application Environment..."

# Pastikan folder uploads dan prisma tersedia
mkdir -p /app/public/uploads
mkdir -p /app/prisma

# Jalankan sinkronisasi database SQLite via Prisma
echo "==> [ACTIS] Synchronizing SQLite Database Schema..."
npx prisma db push --skip-generate

# Jika database baru dan variabel INITIAL_SEED=true diaktifkan, jalankan seed
if [ "$INITIAL_SEED" = "true" ] && [ ! -f "/app/prisma/dev.db" ]; then
  echo "==> [ACTIS] Running Initial Database Seed..."
  node prisma/seed.js || true
fi

echo "==> [ACTIS] Server is ready! Starting Next.js..."
exec "$@"

