#!/usr/bin/env bash
set -euo pipefail

echo "[Deploy] Restarting documenso-remix service..."

systemctl daemon-reload
systemctl restart documenso-remix
systemctl enable documenso-remix

# Wait briefly for the service to start
sleep 3

if systemctl is-active --quiet documenso-remix; then
  echo "[Deploy] Service started successfully."
else
  echo "[Deploy] ERROR: Service failed to start."
  journalctl -u documenso-remix --no-pager -n 30
  exit 1
fi
