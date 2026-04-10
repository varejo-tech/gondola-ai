#!/usr/bin/env bash
# Smoke test do pdf-renderer.
# Renderiza sample-input.md e valida que o PDF foi gerado e tem tamanho razoável.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RENDERER_DIR="$(dirname "$SCRIPT_DIR")"
OUT_DIR="$SCRIPT_DIR/output"

mkdir -p "$OUT_DIR"

# Bootstrap (idempotente)
"$RENDERER_DIR/bootstrap.sh"

# Roda render.mjs
node "$RENDERER_DIR/render.mjs" \
  --in "$SCRIPT_DIR/sample-input.md" \
  --out "$OUT_DIR/sample-output.pdf" \
  --variables '{"titulo":"Relatório de Teste","titulo_curto":"Teste","loja":"Loja Acme","processo":"smoke-test","data":"2026-04-10"}'

# Verifica que o PDF foi gerado
PDF="$OUT_DIR/sample-output.pdf"
if [ ! -f "$PDF" ]; then
  echo "[smoke] FALHA: PDF não foi gerado em $PDF"
  exit 1
fi

SIZE=$(wc -c < "$PDF" | tr -d ' ')
if [ "$SIZE" -lt 10000 ]; then
  echo "[smoke] FALHA: PDF muito pequeno ($SIZE bytes) — provavelmente vazio ou corrompido"
  exit 1
fi

echo "[smoke] OK: PDF gerado em $PDF ($SIZE bytes)"
