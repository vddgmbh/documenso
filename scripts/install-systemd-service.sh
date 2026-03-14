#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/documenso"
SERVICE_SRC="${APP_DIR}/systemd/documenso-remix.service"
SERVICE_DST="/etc/systemd/system/documenso-remix.service"

echo "[Deploy] Installing systemd service..."

if [ ! -f "$SERVICE_SRC" ]; then
  echo "[Deploy] ERROR: Service file not found at ${SERVICE_SRC}"
  exit 1
fi

cp "$SERVICE_SRC" "$SERVICE_DST"
systemctl daemon-reload
systemctl enable documenso-remix

echo "[Deploy] Systemd service installed."
