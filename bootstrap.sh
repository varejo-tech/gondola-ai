#!/bin/bash
# bootstrap.sh — Inicializa o framework Gondola AI para o lojista
# Executar uma única vez após instalar o framework.
# Uso: bash bootstrap.sh

set -e

echo "╔══════════════════════════════════════════════╗"
echo "║  Gondola AI — Avanço Informática              ║"
echo "║  Setup v1.0                                    ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# --- Validação ---
if [ -f ".claude/settings.json" ] && [ ! -L ".claude/settings.json" ]; then
  echo "⚠️  Framework já configurado. Pulando setup."
  exit 0
fi

# --- Passo 1: Estrutura de pastas ---
echo "→ Criando estrutura local..."

mkdir -p .claude

# --- Passo 2: CLAUDE.md aponta para Orquestrador ---
echo "→ Configurando persona do Orquestrador..."

# No modo lojista, CLAUDE.md é uma cópia direta (não symlink)
cp CLAUDE.orquestrador.md CLAUDE.md

# --- Passo 3: Memória local ---
echo "→ Criando memória local..."

touch memory.op.md

# --- Passo 4: Settings para modo operação ---
echo "→ Configurando permissões..."

cat > .claude/settings.json << 'SETTINGSEOF'
{
  "permissions": {
    "allow": [
      "Bash(*)", "Read(*)", "Write(*)", "WebFetch(*)"
    ],
    "deny": []
  },
  "hooks": {
    "PreToolUse": [{
      "matcher": ".*",
      "hooks": [{
        "type": "command",
        "command": "node .mission-control/server/send_event.js --event-type PreToolUse"
      }]
    }],
    "PostToolUse": [{
      "matcher": ".*",
      "hooks": [{
        "type": "command",
        "command": "node .mission-control/server/send_event.js --event-type PostToolUse"
      }]
    }],
    "Stop": [{
      "matcher": ".*",
      "hooks": [{
        "type": "command",
        "command": "node .mission-control/server/send_event.js --event-type Stop"
      }]
    }]
  }
}
SETTINGSEOF

# --- Passo 5: .gitignore para arquivos locais ---
echo "→ Configurando .gitignore..."

cat > .gitignore << 'GIEOF'
# Arquivos locais do lojista — não versionar
CLAUDE.md
memory.op.md
.claude/settings.json
.claude/settings.local.json
.claude/memory.md

# Infraestrutura de desenvolvimento (se existir)
.dev/

# Mission Control DB e runtime
.mission-control/db/
.mission-control/pid
.mission-control/port

# OS
.DS_Store
Thumbs.db
GIEOF

# --- Resultado ---
echo ""
echo "✅ Gondola AI configurada."
echo ""
echo "Próximo passo: abra o Claude Code nesta pasta."
echo "  cd $(pwd) && claude"
echo ""
echo "Para conectar ao marketplace de plugins da Avanço:"
echo "  /plugin marketplace add varejo-tech/gondola-marketplace"
