#!/usr/bin/env bash
set -euo pipefail

# Clean the target directory before CodeDeploy copies new files.
# This runs as root in the BeforeInstall hook.

TARGET="/opt/documenso"

echo "[Clean] Removing previous deployment from ${TARGET}..."

if [ -d "${TARGET}" ]; then
  rm -rf "${TARGET}"
fi

mkdir -p "${TARGET}"

# Ensure the documenso user exists
if ! id -u documenso &>/dev/null; then
  echo "[Clean] Creating documenso user..."
  useradd --system --shell /usr/sbin/nologin --home-dir "${TARGET}" documenso
fi

chown documenso:documenso "${TARGET}"

echo "[Clean] Done."
