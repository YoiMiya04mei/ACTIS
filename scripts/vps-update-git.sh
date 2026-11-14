#!/usr/bin/env bash
set -euo pipefail

# ACTIS VPS Update Helper (Method 1: Git Pull + Docker Compose Rebuild)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$APP_DIR"

BRANCH="${1:-main}"

echo "==> [ACTIS] Pulling latest changes from Git (branch: $BRANCH)..."
git pull origin "$BRANCH"

GIT_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || true)"
GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "$BRANCH")"
echo "==> [ACTIS] Current commit: ${GIT_COMMIT:-unknown} ($GIT_BRANCH)"

echo "==> [ACTIS] Rebuilding and restarting actis-app container..."
ACTIS_GIT_COMMIT="$GIT_COMMIT" ACTIS_GIT_BRANCH="$GIT_BRANCH" docker compose up -d --build actis-app

echo "==> [ACTIS] Update complete! New version & changelog will be synced automatically into History on startup."
