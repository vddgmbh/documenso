#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/documenso"

echo "[Deploy] Installing dependencies..."
cd "$APP_DIR"

# Full install — prisma CLI and dotenv-cli are in devDependencies
# and are needed for prisma generate + migrations.
# TODO: Once stable, consider moving prisma to production deps
# and switching to npm ci --omit=dev
npm ci

# Generate Prisma client (needed at runtime)
npx prisma generate --schema=packages/prisma/schema.prisma

echo "[Deploy] Dependencies installed."
