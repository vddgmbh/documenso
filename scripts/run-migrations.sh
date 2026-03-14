#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/documenso"

echo "[Deploy] Running database migrations..."
cd "$APP_DIR"

# Use the repo's own migrate-deploy script which handles env loading
# via dotenv-cli and delegates to the prisma workspace
npm run prisma:migrate-deploy

echo "[Deploy] Migrations complete."
