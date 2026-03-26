#!/bin/sh
set -e

N8N_DIR="/home/node/.n8n"

if [ -f "${N8N_DIR}/package.json" ]; then
  echo "Installing n8n community packages from ${N8N_DIR}/package.json..."
  cd "${N8N_DIR}" && npm install --no-fund --no-audit --loglevel=warn
  echo "Community packages installed."
else
  echo "No package.json in ${N8N_DIR}, skipping npm install."
fi

exec tini -- n8n
