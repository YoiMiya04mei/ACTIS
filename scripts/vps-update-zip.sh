#!/usr/bin/env bash
set -euo pipefail

# ACTIS VPS Update Helper (Method 2 Fallback: Source Code .zip Staging + Docker Rebuild)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$APP_DIR"

ZIP_PATH="${1:-}"
PENDING_DIR="$APP_DIR/updates/source-pending"
APPLIED_DIR="$APP_DIR/updates/applied"

if [ -z "$ZIP_PATH" ]; then
  if [ -d "$PENDING_DIR" ]; then
    ZIP_PATH="$(ls -1t "$PENDING_DIR"/*.zip 2>/dev/null | head -n 1 || true)"
  fi
fi

if [ -z "$ZIP_PATH" ] || [ ! -f "$ZIP_PATH" ]; then
  echo "[ERROR] File ZIP update tidak ditemukan."
  echo "Usage: ./scripts/vps-update-zip.sh [/path/to/actis-update.zip]"
  echo "Atau upload source .zip terlebih dahulu melalui menu Update & Changelog di Web UI."
  exit 1
fi

echo "==> [ACTIS] Memproses paket update ZIP: $ZIP_PATH"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

if command -v unzip >/dev/null 2>&1; then
  unzip -q "$ZIP_PATH" -d "$TMP_DIR"
elif command -v python3 >/dev/null 2>&1; then
  python3 -m zipfile -e "$ZIP_PATH" "$TMP_DIR"
else
  echo "[ERROR] Diperlukan 'unzip' atau 'python3' untuk mengekstrak ZIP."
  exit 1
fi

# Unwrap single top-level directory (misalnya ACTIS-main/...)
SRC_ROOT="$TMP_DIR"
TOP_COUNT="$(find "$TMP_DIR" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')"
if [ "$TOP_COUNT" = "1" ]; then
  SINGLE_DIR="$(find "$TMP_DIR" -mindepth 1 -maxdepth 1 -type d | head -n 1 || true)"
  if [ -n "$SINGLE_DIR" ] && [ -f "$SINGLE_DIR/package.json" ]; then
    SRC_ROOT="$SINGLE_DIR"
  fi
fi

if [ ! -f "$SRC_ROOT/package.json" ]; then
  echo "[ERROR] Struktur ZIP tidak valid: package.json tidak ditemukan."
  exit 1
fi

echo "==> [ACTIS] Menyalin file update dengan tetap melindungi .env, uploads, data, updates, dan .git..."
if command -v rsync >/dev/null 2>&1; then
  rsync -a \
    --exclude='.env' \
    --exclude='.env.*' \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='uploads' \
    --exclude='public/uploads' \
    --exclude='data' \
    --exclude='updates' \
    --exclude='releases' \
    "$SRC_ROOT/" "$APP_DIR/"
else
  for item in "$SRC_ROOT"/*; do
    base="$(basename "$item")"
    case "$base" in
      .env|.env.*|.git|node_modules|.next|uploads|data|updates|releases) continue ;;
    esac
    if [ "$base" = "public" ] && [ -d "$item" ]; then
      mkdir -p "$APP_DIR/public"
      for pub in "$item"/*; do
        pbase="$(basename "$pub")"
        [ "$pbase" = "uploads" ] && continue
        cp -rf "$pub" "$APP_DIR/public/"
      done
    else
      cp -rf "$item" "$APP_DIR/"
    fi
  done
fi

mkdir -p "$APPLIED_DIR"
mv -f "$ZIP_PATH" "$APPLIED_DIR/$(basename "$ZIP_PATH")" || true
rm -f "$PENDING_DIR/latest.json" 2>/dev/null || true

echo "==> [ACTIS] Membangun ulang & merestart container actis-app..."
docker compose up -d --build actis-app

echo "==> [ACTIS] Selesai! Container actis-app sedang berjalan dengan versi terbaru."
