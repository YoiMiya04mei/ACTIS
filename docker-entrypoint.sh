#!/bin/sh
set -e

echo "==> [ACTIS] Initializing Application Environment with PostgreSQL..."

# Pastikan folder runtime tersedia
mkdir -p /app/public/uploads /app/data/updates

# Terapkan Offline Release Bundle yang tertunda sebelum server Next.js menyala
for PENDING_FILE in /app/data/updates/.pending-release /app/updates/.pending-release; do
  if [ -f "$PENDING_FILE" ]; then
    STAGING_DIR="$(tr -d '\r\n' < "$PENDING_FILE")"
    if [ -n "$STAGING_DIR" ] && [ -d "$STAGING_DIR" ]; then
      echo "==> [ACTIS] Applying staged Offline Update Bundle from $STAGING_DIR..."
      for ROOT_FILE in server.js package.json CHANGELOG.json build-info.json release-manifest.json docker-entrypoint.sh; do
        if [ -f "$STAGING_DIR/$ROOT_FILE" ]; then
          cp -f "$STAGING_DIR/$ROOT_FILE" "/app/$ROOT_FILE"
        fi
      done

      if [ -f "/app/docker-entrypoint.sh" ]; then
        chmod +x /app/docker-entrypoint.sh 2>/dev/null || true
      fi

      if [ -d "$STAGING_DIR/.next" ]; then
        rm -rf /app/.next
        cp -rf "$STAGING_DIR/.next" /app/.next
      fi

      for APP_DIR in prisma scripts; do
        if [ -d "$STAGING_DIR/$APP_DIR" ]; then
          mkdir -p "/app/$APP_DIR"
          cp -rf "$STAGING_DIR/$APP_DIR/." "/app/$APP_DIR/"
        fi
      done

      if [ -d "$STAGING_DIR/public" ]; then
        mkdir -p /app/public
        for PUB_ENTRY in "$STAGING_DIR/public"/*; do
          [ -e "$PUB_ENTRY" ] || continue
          BASENAME="$(basename "$PUB_ENTRY")"
          if [ "$BASENAME" = "uploads" ]; then
            continue
          fi
          rm -rf "/app/public/$BASENAME"
          cp -rf "$PUB_ENTRY" "/app/public/$BASENAME"
        done
      fi

      rm -rf "$STAGING_DIR" "$PENDING_FILE"
      echo "==> [ACTIS] Offline Update Bundle applied cleanly!"
    else
      rm -f "$PENDING_FILE"
    fi
  fi
done

# Sinkronisasi skema database PostgreSQL via Prisma (non-destruktif; tanpa --accept-data-loss)
if [ "$SKIP_DB_SYNC" = "true" ]; then
  echo "==> [ACTIS] SKIP_DB_SYNC=true -> Melewati sinkronisasi skema Prisma (database existing tidak disentuh)."
else
  echo "==> [ACTIS] Synchronizing PostgreSQL Database Schema via Prisma..."
  if [ -f "/opt/prisma/node_modules/prisma/build/index.js" ]; then
    node /opt/prisma/node_modules/prisma/build/index.js db push --skip-generate --schema=./prisma/schema.prisma
  else
    npx prisma db push --skip-generate
  fi
fi

# Jika variabel INITIAL_SEED=true diaktifkan, jalankan initial seed
if [ "$INITIAL_SEED" = "true" ]; then
  echo "==> [ACTIS] Running Initial Database Seed for PostgreSQL..."
  node prisma/seed.js || true
fi

echo "==> [ACTIS] Database synchronized! Starting Next.js Production Server..."
exec "$@"
