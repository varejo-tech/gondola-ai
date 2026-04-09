#!/bin/bash
# Mission Control — Start Script
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${MISSION_CONTROL_PORT:-4000}"
SILENT=false

# Parse flags
for arg in "$@"; do
  case "$arg" in
    --silent) SILENT=true ;;
    --port=*) PORT="${arg#--port=}" ;;
  esac
done

# Matar servidor anterior se existir
PID_FILE="$DIR/pid"
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    kill "$OLD_PID" 2>/dev/null
    sleep 1
  fi
  rm -f "$PID_FILE"
fi

# Persistir porta para referência
echo "$PORT" > "$DIR/port"

export PORT

if [ "$SILENT" = true ]; then
  cd "$DIR/server" && npm install --silent 2>/dev/null
  node index.js &
  SERVER_PID=$!
  echo "$SERVER_PID" > "$PID_FILE"
  sleep 1
  echo "✓ Mission Control rodando em background (PID: $SERVER_PID, porta: $PORT)"
else
  echo "═══════════════════════════════════════════"
  echo "  MISSION CONTROL — Avanço Informática"
  echo "═══════════════════════════════════════════"
  echo ""

  echo "→ Instalando dependências..."
  cd "$DIR/server" && npm install --silent 2>/dev/null

  echo "→ Iniciando servidor na porta $PORT..."
  node index.js &
  SERVER_PID=$!
  echo "$SERVER_PID" > "$PID_FILE"

  sleep 1

  echo "→ Abrindo dashboard no browser..."
  open "http://localhost:$PORT/dashboard" 2>/dev/null || xdg-open "http://localhost:$PORT/dashboard" 2>/dev/null || echo "  Abra http://localhost:$PORT/dashboard no browser"

  echo ""
  echo "✓ Mission Control rodando (PID: $SERVER_PID)"
  echo "  Dashboard: http://localhost:$PORT/dashboard"
  echo "  API:       http://localhost:$PORT/events"
  echo ""
  echo "  Pressione Ctrl+C para encerrar."

  wait $SERVER_PID
fi
