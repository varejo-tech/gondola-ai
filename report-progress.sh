#!/bin/bash
# report-progress.sh — reporta progresso ao servidor de observabilidade

SERVIDOR="${MISSION_CONTROL_SERVER:-http://localhost:4000}"

curl -s -X POST "$SERVIDOR/events" \
  -H "Content-Type: application/json" \
  -d "$(cat <<EOF
{
  "event_id": "$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "evt-$(date +%s)-$$")",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
  "session_id": "${CLAUDE_SESSION_ID:-unknown}",
  "source": "agent",
  "type": "progress",
  "process": "$1",
  "agent": "$2",
  "task": "$3",
  "payload": {
    "status": "$4",
    "step": $5,
    "total_steps": $6,
    "message": "${7:-}"
  }
}
EOF
)" > /dev/null 2>&1 &
