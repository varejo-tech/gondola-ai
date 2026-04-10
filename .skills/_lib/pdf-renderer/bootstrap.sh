#!/usr/bin/env bash
# Bootstrap idempotente do pdf-renderer.
# Roda npm install se node_modules ausente. Seguro chamar em toda execução.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -d "$SCRIPT_DIR/node_modules/md-to-pdf" ]; then
  echo "[pdf-renderer] node_modules ausente — instalando dependências (pode levar alguns minutos na primeira vez)..."
  (cd "$SCRIPT_DIR" && npm install --silent)
  echo "[pdf-renderer] dependências instaladas."
fi
