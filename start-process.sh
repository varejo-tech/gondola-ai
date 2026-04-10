#!/bin/bash
# start-process.sh — sinaliza o início de uma nova execução de processo ao Mission Control.
# Emite um evento `process_start` que zera o estado visual daquele processo no dashboard:
# eventos de progress anteriores ao timestamp deste evento são ignorados pelo getState.

SERVIDOR="${MISSION_CONTROL_SERVER:-http://localhost:4000}"

if [ -z "$1" ]; then
  echo "Uso: $0 <processo> [mensagem]" >&2
  exit 1
fi

curl -s -X POST "$SERVIDOR/events" \
  -H "Content-Type: application/json" \
  -d "$(cat <<EOF
{
  "event_id": "$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "evt-$(date +%s)-$$")",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
  "session_id": "${CLAUDE_SESSION_ID:-unknown}",
  "source": "orquestrador",
  "type": "process_start",
  "process": "$1",
  "payload": {
    "message": "${2:-Iniciando processo}"
  }
}
EOF
)" > /dev/null 2>&1 &
