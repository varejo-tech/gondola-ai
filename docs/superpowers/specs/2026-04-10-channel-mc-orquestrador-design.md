# Design: Canal Mission Control ↔ Orquestrador

**Data:** 2026-04-10
**Status:** Aprovado para implementação
**Autor:** Leonardo Chaves Moreira (arquiteto) + assistente
**Precedente:** POC `.mission-control/channel-poc/` validado em 2026-04-10 — confirmou que notifications `claude/channel` são entregues ao assistant quando o MCP server é carregado com `claude --dangerously-load-development-channels server:<name>`.

---

## 1. Motivação

O Orquestrador do framework Gondola AI conversa com o usuário dentro do terminal do Claude Code. Como o mesmo terminal também mostra output de comandos bash, leituras de arquivo e tool calls internos, as mensagens conversacionais do Orquestrador se misturam com ruído técnico. O objetivo é dar ao Orquestrador um canal de chat paralelo e limpo, visível no dashboard do Mission Control, sem sacrificar a TUI nativa do Claude Code que continua sendo útil em modo dev.

Alternativas consideradas e descartadas:

- **Telegram / plugin oficial.** Exige setup manual por cliente (BotFather, token, pairing). Fere o objetivo de UX "git clone + subir o MC = canal pronto".
- **Rodar o Orquestrador headless via Claude Agent SDK** ("two-way puro"). Abandonaria a TUI do Claude Code e exigiria reimplementar host, permissões, compactação de contexto, slash commands. Fora de escopo.
- **Dashboard só como display (one-way).** Perde a oportunidade de usar o navegador como interface de input quando a tela do terminal está ocupada.

Escolhido: **modelo híbrido.** Terminal continua sendo a UI canônica (sempre mostra tudo); dashboard é um mirror limpo do canal conversacional, com input opcional nos dois lados.

## 2. Decisões arquiteturais tomadas no brainstorming

| # | Decisão | Racional |
|---|---|---|
| 1 | Modelo híbrido | Terminal é a TUI nativa do Claude Code e é grátis; dashboard é mirror + input opcional |
| 2 | Sessão única | Leonardo só roda um Orquestrador por vez; simplifica drasticamente |
| 3 | Histórico persistente no SQLite do MC (display only) | Reusa infra existente; Orq não lê o histórico — é só log visual |
| 4 | Histórico antigo renderizado em cinza | Marca visual entre "antes desta sessão" e "nesta sessão" |
| 5 | `.mcp.json` só existe em modo orquestrador | `.dev/modo.sh` gerencia; modo dev continua sendo terminal puro |
| 6 | Orq ecoa **todas** as respostas conversacionais | Simples de raciocinar; não ecoa bash/tool output |
| 7 | Subprocess bridge + WS client ao MC | Reusa caminho validado no POC (stdio + `claude/channel`); MC continua burro |

## 3. Arquitetura

```
┌───────────────────────────────────────────────────────────────┐
│                     Processo: claude (TUI)                    │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                      Orquestrador                       │  │
│  │  - lê channel notification → sabe o que usuário disse   │  │
│  │  - responde no terminal (nativo)                        │  │
│  │  - chama reply(text) → ecoa pro dashboard               │  │
│  └──────────────────────┬──────────────────────────────────┘  │
│                         │ stdio (MCP)                         │
│  ┌──────────────────────▼──────────────────────────────────┐  │
│  │      bridge: .mission-control/channel/server.mjs        │  │
│  │  - MCP server (stdio, experimental.claude/channel)      │  │
│  │  - tool reply(text)  → POST /events no MC               │  │
│  │  - WS client ↔ MC, filtra type=chat_user                │  │
│  │    → emite notifications/claude/channel pro Orq         │  │
│  └──────────────────────┬──────────────────────────────────┘  │
└─────────────────────────┼─────────────────────────────────────┘
                          │ HTTP POST + WS
                          ▼
         ┌────────────────────────────────┐
         │  Mission Control server :4000  │
         │  - POST /events  (já existe)   │
         │  - POST /chat/input (novo)     │
         │  - WS broadcast  (já existe)   │
         │  - SQLite events table         │
         └────────────────┬───────────────┘
                          │ WS
                          ▼
         ┌────────────────────────────────┐
         │       Dashboard (browser)      │
         │  - painel de chat (novo)       │
         │  - bolhas orq / usuário        │
         │  - históricas em cinza         │
         └────────────────────────────────┘
```

### 3.1 Componentes novos

- `.mission-control/channel/` — bridge MCP subprocess (stdio). Spawnado pelo Claude Code via `.mcp.json`.
- `POST /chat/input` no MC server — única rota nova. Recebe mensagem digitada pelo usuário no dashboard.
- Dois novos `event.type` no SQLite existente: `chat_orq` e `chat_user`. Sem schema novo — reusa a tabela `events`.
- Painel de chat no `.mission-control/dashboard/index.html`.
- Extensão do `.dev/modo.sh` para gerenciar o `.mcp.json`.
- Seção "Canal do Mission Control" no `CLAUDE.orquestrador.md`.
- Template `.dev/templates/mcp.orquestrador.json` — config canônica do bridge que `modo.sh` copia.

### 3.2 Componentes que NÃO mudam

- MC server continua sendo event bus burro. Só ganha uma rota a mais e aceita dois tipos novos de evento.
- SQLite não muda de schema.
- Nada do framework de processos (promoção, compras, agents/skills) é tocado.
- `report-progress.sh` continua igual, canal de eventos de processo continua igual.

## 4. Componentes em detalhe

### 4.1 Bridge MCP — `.mission-control/channel/server.mjs`

Evolução direta do POC. Mesma base `@modelcontextprotocol/sdk`, mesmas capabilities (`tools` + `experimental['claude/channel']`). Diferenças:

**Tool `reply(text: string) → { ok: boolean, error?: string }`**

Handler faz `fetch('http://localhost:4000/events', {method: 'POST', body: JSON.stringify({event_id, timestamp, source: 'orquestrador', type: 'chat_orq', payload: { text }})})`.

- Sucesso: retorna `{ ok: true }`.
- MC offline / POST falha: retorna `{ ok: false, error: 'mc_offline' | 'mc_error', detail }`. **Não silencia.** O Orq precisa saber que o eco falhou para poder avisar o usuário no terminal.

**WS client pro MC**

Após o handshake stdio, abre `new WebSocket('ws://localhost:4000')`. No `message`:

1. Parse JSON.
2. Filtra `event.type === 'chat_user'`. Ignora todos os outros tipos (inclusive `chat_orq`, que é o próprio eco — evita loop).
3. Para cada `chat_user`, emite:

```js
mcp.notification({
  method: 'notifications/claude/channel',
  params: {
    content: event.payload.text,
    meta: { source: 'gondola-chat', ts: event.payload.ts }
  }
})
```

**Reconexão WS:** se a conexão cair, tenta reconectar em backoff (1s, 2s, 5s, 10s, depois desiste até próxima `reply()` tool call que reabre a tentativa).

**Campo `instructions` do MCP server**

Carrega a disciplina do mirror, reforçada no boot de toda sessão:

> "Canal Orquestrador ↔ Mission Control. Sempre que você responder conversacionalmente ao usuário, chame também a tool `reply(text)` com o mesmo texto da sua resposta, para espelhar no dashboard. Não ecoe output de bash, Read ou diffs — só o texto conversacional que você diria ao usuário."

### 4.2 Extensão do MC server — `.mission-control/server/index.js`

Uma única rota nova:

```
POST /chat/input
Body: { text: string }
```

Handler:

1. Valida `text` (string não vazia, tamanho razoável).
2. Gera event `{ event_id: uuid, timestamp: ISO, source: 'dashboard', type: 'chat_user', payload: { text } }`.
3. Chama `insertEvent()` (reusa).
4. Broadcasta via WS (reusa).
5. Retorna `201 { ok: true, event_id }` ou `4xx/5xx` com detalhe.

Events `chat_orq` chegam via `POST /events` que já existe — o bridge só manda no formato que `insertEvent()` aceita. Zero mudança no código existente de `/events`.

### 4.3 Dashboard — `.mission-control/dashboard/index.html`

Painel de chat novo. Layout (sidebar ou aba) é decisão de implementação, não design-critical.

**Render:**

- Bolhas estilo chat. Classe CSS diferente para `chat_orq` vs `chat_user`.
- Markdown simples renderizado nas mensagens do Orq (links, `code`, **bold**, listas). Mensagens do usuário em texto puro.
- Timestamp discreto por bolha.

**Histórico cinza:**

- No load, `GET /state` (já existe) retorna todos os events.
- Filtra `chat_*` events, renderiza com classe `chat-historical` (opacity reduzida, cor dessaturada).
- Abre WS. **Tudo que chega via WS daqui pra frente** renderiza com classe `chat-live` (cor normal).
- Critério simples e inequívoco: `/state` inicial = passado = cinza; WS = presente = normal.

**Input:**

- `<textarea>` + botão Enviar. Enter envia, Shift+Enter quebra linha.
- POST para `/chat/input`. Mostra toast em erro.
- Desabilitado enquanto WS estiver desconectado.

**Autoscroll:**

- Scroll para o fim ao chegar nova mensagem.
- Se o usuário scrollou para cima (lendo histórico), **não** força scroll.

### 4.4 Gating por modo — `.dev/modo.sh`

Estende o script existente:

```bash
modo_orquestrador() {
  # ... troca de symlinks existentes ...
  cp .dev/templates/mcp.orquestrador.json .mcp.json
}

modo_dev() {
  # ... troca de symlinks existentes ...
  rm -f .mcp.json
}
```

Em modo dev, a ausência do `.mcp.json` faz o `claude` subir sem nenhum MCP server — comportamento idêntico ao atual.

O template `mcp.orquestrador.json` registra o bridge sob a chave `gondola-chat`:

```json
{
  "mcpServers": {
    "gondola-chat": {
      "command": "node",
      "args": [".mission-control/channel/server.mjs"]
    }
  }
}
```

Essa chave é o que o flag `claude --dangerously-load-development-channels server:gondola-chat` referencia — o `server:` prefixa o nome registrado no `.mcp.json`.

### 4.5 Disciplina do mirror — `CLAUDE.orquestrador.md`

Nova seção. Texto base:

> **Canal do Mission Control.** Quando este arquivo estiver ativo, existe um canal de chat paralelo ao terminal, visível no dashboard do Mission Control. Toda vez que você responder conversacionalmente ao usuário, chame também a tool `reply(text)` do MCP server `gondola-chat` com o mesmo texto. Não chame para: output de bash, leituras de arquivo, internal tool reasoning, diffs. Apenas o texto conversacional que você diria ao usuário.
>
> Se a tool `reply()` retornar `{ok: false}`, informe ao usuário no terminal que o dashboard está offline e continue normalmente.

Reforço em três lugares:

1. `CLAUDE.orquestrador.md` — carregado no boot, sempre.
2. `instructions` do MCP server — carregado automaticamente pelo Claude Code no handshake (comportamento confirmado no POC).
3. (Opcional) "Nudge" de boot: bridge envia uma primeira notification `claude/channel` logo após conectar, relembrando a regra. Decisão final na implementação — só adicionar se a taxa de esquecimento medida na validação for alta.

## 5. Fluxos de dados

### 5.1 Orquestrador → Dashboard (eco de resposta)

```
Orq escreve resposta no terminal (nativo Claude Code)
        │
        ▼
Orq chama tool reply(text="...")
        │
        ▼
Bridge handler: POST http://localhost:4000/events
  Body: {
    event_id, timestamp,
    source: "orquestrador",
    type: "chat_orq",
    payload: { text }
  }
        │
        ▼
MC: insertEvent() → SQLite + wss.broadcast(event)
        │
        ├─→ Dashboard (WS): renderiza bolha "orq" cor normal
        └─→ Bridge (WS): recebe próprio eco, filtra type=chat_orq, ignora
```

### 5.2 Dashboard → Orquestrador (usuário digitando no navegador)

```
Usuário digita no input do dashboard, envia
        │
        ▼
POST /chat/input { text }
        │
        ▼
MC: gera event {source:"dashboard", type:"chat_user", payload:{text}}
    insertEvent() → SQLite + wss.broadcast(event)
        │
        ├─→ Dashboard (WS): renderiza bolha "usuário" cor normal (echo local)
        └─→ Bridge (WS): filtra type=chat_user, emite:
                notifications/claude/channel {
                  content: text,
                  meta: { source: "gondola-chat", ts }
                }
                        │
                        ▼
                Claude Code entrega ao Orq como system-reminder
                        │
                        ▼
                Orq lê, responde no terminal + chama reply()
                → volta pro fluxo 5.1
```

### 5.3 Boot do dashboard (replay de histórico)

```
Browser abre http://localhost:4000/dashboard
        │
        ▼
JS faz GET /state (já existe)
        │
        ▼
MC retorna todos os events da tabela
        │
        ▼
Dashboard filtra events tipo chat_*
Renderiza cada um com classe chat-historical (cinza)
        │
        ▼
Abre WS
        │
        ▼
Events novos → classe chat-live (cor normal)
```

Critério: veio de `GET /state` inicial = cinza; veio do WS = normal.

### 5.4 Boot do bridge (subprocess spawn)

```
Leonardo roda: claude --dangerously-load-development-channels server:gondola-chat
        │
        ▼
Claude Code lê .mcp.json, spawna subprocess node server.mjs
        │
        ▼
Bridge: stdio MCP handshake com Claude Code
  - declara tools: [reply]
  - declara capabilities.experimental['claude/channel']: {}
  - declara instructions: "...disciplina do mirror..."
        │
        ▼
Bridge tenta conectar ws://localhost:4000
        │
        ├─→ sucesso: escuta events, pronto pra bidirecional
        └─→ falha: log em stderr, agenda retry, reply() retorna erro
```

### 5.5 Edge cases de fluxo

- **Dashboard fechado enquanto Orq conversa.** `reply()` continua funcionando (POST `/events` sempre sucede se MC estiver no ar). Events vão pro SQLite. Quando o dashboard reabre, mostra a conversa em cinza (veio do replay). Zero perda.
- **MC server offline quando `claude` sobe.** Bridge ainda sobe, registra a tool, mas `reply()` retorna erro e nenhuma channel notification pode chegar. Orq percebe pelo retorno da tool. Quando MC volta, próximo `reply()` reconecta.
- **Bridge morre no meio da sessão.** Claude Code considera o MCP server morto. Próxima chamada de `reply()` falha. Leonardo reinicia a sessão do `claude`. Sem recovery automático.
- **Loop de eco.** Evitado pelo filtro `type === 'chat_user'` no bridge.
- **Mensagem longa.** Sem limite artificial. WS e SQLite aguentam.

## 6. Tratamento de erros e observabilidade

### 6.1 Erros do bridge

| Situação | Comportamento | Visibilidade |
|---|---|---|
| MC offline no boot | Bridge sobe, registra tool, WS client agenda retry (1s, 2s, 5s, 10s) | `stderr` do subprocess; `reply()` retorna `{ok:false, error:"mc_offline"}` |
| MC cai durante sessão | WS client detecta close, reconnect em backoff; `reply()` durante o gap retorna erro | Idem |
| POST `/events` falha (HTTP 5xx) | `reply()` retorna `{ok:false, error:"mc_error", detail}` | Orq vê no retorno da tool |
| Payload da notification malformado | Exception capturada, log em stderr, tool retorna erro genérico | stderr |

**Princípio:** bridge nunca silencia falhas. Qualquer problema volta pro Orq via retorno da tool.

### 6.2 Erros do MC server

Herdados do que já existe. A rota nova `/chat/input` segue o padrão das outras: valida body, `insertEvent`, broadcast, retorna 201 ou 4xx/5xx. Dashboard mostra toast em erro.

### 6.3 Erros do dashboard

- WS desconecta: banner "reconectando…", loop de reconnect. Input fica desabilitado.
- `GET /state` falha no boot: mensagem de erro no painel de chat, resto do dashboard segue funcionando.

### 6.4 Observabilidade

- **Bridge:** logs em stderr (boot, ws connect/disconnect, reply calls, notifications enviadas, erros). Claude Code captura o stderr e mostra no `/mcp` status.
- **MC server:** já loga eventos recebidos; `chat_*` entram no log normal.
- **Dashboard:** console do browser com WS state e eventos recebidos. Timestamps visíveis nas bolhas.
- Sem telemetria estruturada nova.

## 7. Escopo negativo (o que NÃO faz parte do MVP)

- Autenticação no MC server (continua localhost-only, igual hoje).
- Rate limiting no `/chat/input`.
- Paginação do histórico no dashboard.
- Edit / delete de mensagens enviadas, threads, reações.
- Notificações do browser quando a aba está em background. Candidato a v2.
- Export / import de histórico.
- Suporte a múltiplas sessões do Orquestrador simultâneas.
- Rodar o Orquestrador headless / via Agent SDK.
- Mover report-progress / eventos de processo para o canal (continuam no fluxo atual de `/events`).

## 8. Testes e validação

### 8.1 Smoke test do bridge (isolado, automatizado)

Arquivo: `.mission-control/channel/test-bridge.mjs`. Roda sem Claude Code.

- Simula stdio do Claude Code com pipes em memória.
- Sobe um MC fake (HTTP server simples + WS) em porta aleatória.
- Casos:
  1. Handshake MCP completa, tool `reply` é anunciada.
  2. CallTool `reply("hello")` → POST chega no MC fake, retorna ok.
  3. MC fake broadcasta `chat_user` via WS → bridge emite `notifications/claude/channel` no stdio com o texto correto.
  4. MC fake broadcasta `chat_orq` via WS → bridge **não** emite notification (filtro correto).
  5. MC fake derruba WS → bridge reconecta.
- Sem framework de teste (evita dependência nova). Exit 0 / 1.

### 8.2 Smoke test da rota nova do MC (isolado, automatizado)

Arquivo: `.mission-control/server/test-chat-route.mjs`.

- Sobe o MC server real em porta de teste com SQLite tempfile.
- POSTa `/chat/input`, verifica que o event foi inserido e broadcastado.
- Abre um WS client, verifica recebimento.

### 8.3 Teste manual end-to-end (checklist)

Documentado em `.dev/test-outputs/channel/manual-checklist.md`. Leonardo roda e marca:

- [ ] `./.dev/modo.sh orquestrador` — `.mcp.json` aparece na raiz.
- [ ] `./.mission-control/start.sh` — MC rodando em `:4000`.
- [ ] `claude --dangerously-load-development-channels server:gondola-chat` — sobe sem erro.
- [ ] `/mcp` lista `gondola-chat` como connected.
- [ ] Abrir `http://localhost:4000/dashboard` — painel de chat visível.
- [ ] Orq escreve algo espontaneamente no terminal → bolha aparece no dashboard em cor normal.
- [ ] Digitar no dashboard → Orq recebe como system-reminder, responde → eco aparece no dashboard.
- [ ] Fechar dashboard, Orq conversa no terminal, reabrir dashboard → mensagens novas aparecem em cinza (replay).
- [ ] Matar o MC server → próximo `reply()` retorna erro → Orq avisa no terminal.
- [ ] Reiniciar MC → próximo `reply()` reconecta e funciona.
- [ ] `./.dev/modo.sh dev` — `.mcp.json` sai; `claude` novo sobe sem MCP; terminal puro.

### 8.4 Teste de disciplina do mirror

Comportamental, sem automação possível.

- Rodar conversa real de ~10 turnos em modo orquestrador, contar quantas respostas foram ecoadas vs esquecidas.
- Baseline em `.dev/test-outputs/channel/mirror-discipline.md`.
- Se esquecimento > ~10%: reforçar regra no `CLAUDE.orquestrador.md` (mais explícito, exemplo concreto) ou ativar nudge periódico via channel notification.

### 8.5 O que não testamos no MVP

- Carga / stress (localhost, single user).
- Múltiplos dashboards abertos em abas diferentes (deve funcionar por acaso via WS broadcast, não garantimos).
- Recovery automático após crash do bridge.

## 9. Estrutura de arquivos resultante

```
gondola-ai/
├── .mcp.json                                    ← só existe em modo orquestrador
├── .dev/
│   ├── modo.sh                                  ← estendido (gerencia .mcp.json)
│   └── templates/
│       └── mcp.orquestrador.json                ← novo (template do .mcp.json)
├── .mission-control/
│   ├── channel/                                 ← novo diretório
│   │   ├── server.mjs                           ← bridge MCP stdio
│   │   ├── test-bridge.mjs                      ← smoke test isolado
│   │   ├── package.json
│   │   └── node_modules/                        ← gitignored
│   ├── server/
│   │   ├── index.js                             ← +POST /chat/input
│   │   └── test-chat-route.mjs                  ← smoke test isolado
│   └── dashboard/
│       └── index.html                           ← +painel de chat
├── CLAUDE.orquestrador.md                       ← +seção "Canal do Mission Control"
└── docs/superpowers/specs/
    └── 2026-04-10-channel-mc-orquestrador-design.md
```

## 10. Referências

- POC validado: `.mission-control/channel-poc/server.mjs`
- Plugin Telegram oficial (mesmo padrão MCP + `claude/channel`): `~/.claude/plugins/cache/claude-plugins-official/telegram/0.0.5/`
- MC server atual: `.mission-control/server/index.js`
- Memória do POC: `memory/project_mc_channel_poc.md`
