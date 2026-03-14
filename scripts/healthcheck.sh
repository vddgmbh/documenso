#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/documenso"
PORT=$(grep "^PORT=" "${APP_DIR}/.env" | cut -d'=' -f2 | tr -d '"' || echo "3000")
MAX_RETRIES=10
RETRY_INTERVAL=3

echo "[Deploy] Running healthcheck on port ${PORT}..."

for i in $(seq 1 $MAX_RETRIES); do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}" 2>/dev/null || echo "000")

  if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 400 ]; then
    echo "[Deploy] Healthcheck passed (HTTP ${HTTP_CODE})."
    exit 0
  fi

  echo "[Deploy] Attempt ${i}/${MAX_RETRIES}: HTTP ${HTTP_CODE}, retrying in ${RETRY_INTERVAL}s..."
  sleep $RETRY_INTERVAL
done

echo "[Deploy] ERROR: Healthcheck failed after ${MAX_RETRIES} attempts."
journalctl -u documenso-remix --no-pager -n 20
exit 1
