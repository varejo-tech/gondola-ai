# Canal Mission Control ↔ Orquestrador — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar um canal de chat MCP entre o Orquestrador (rodando no Claude Code) e o dashboard do Mission Control. Mirror de respostas via tool `reply(text)`, input bidirecional via dashboard, gating por modo.

**Architecture:** Bridge stdio MCP subprocess (`.mission-control/channel/server.mjs`) spawnado pelo Claude Code via `.mcp.json`. Tool `reply(text)` POSTa eventos `chat_orq` pro MC server; WS client do bridge escuta `chat_user` events e emite `notifications/claude/channel`. Dashboard ganha painel de chat (React), histórico em cinza vs live normal. `.mcp.json` só existe em modo `op` (gating via `.dev/modo.sh`).

**Tech Stack:** Node 20+, `@modelcontextprotocol/sdk` (stdio server), `ws` (client), Express (já no MC), React 18 via Babel standalone (já no dashboard).

**Spec de referência:** `docs/superpowers/specs/2026-04-10-channel-mc-orquestrador-design.md`

**Pré-requisitos de execução:**

- Repo na branch `main`, limpo (ou em worktree dedicado).
- Node 20+ disponível (`node --version`).
- Mission Control server tem que rodar pra testes E2E (`./.mission-control/start.sh`).
- Claude Code com suporte a `--dangerously-load-development-channels` (já validado no POC).

---

## File Structure

**Criar:**

- `.mission-control/channel/package.json` — deps do bridge
- `.mission-control/channel/server.mjs` — bridge MCP subprocess (stdio)
- `.mission-control/channel/handlers.mjs` — funções puras (reply, wsMessage) — exportáveis e testáveis
- `.mission-control/channel/test-handlers.mjs` — smoke test das funções puras
- `.mission-control/server/test-chat-route.mjs` — smoke test de `/chat/input` + `/chat/history`
- `.dev/templates/mcp.orquestrador.json` — template copiado pelo `modo.sh`
- `.dev/test-outputs/channel/manual-checklist.md` — checklist E2E
- `.dev/test-outputs/channel/mirror-discipline.md` — baseline de disciplina (vazio, pra preencher durante validação)

**Modificar:**

- `.mission-control/server/index.js` — adiciona `POST /chat/input` e `GET /chat/history`
- `.mission-control/dashboard/index.html` — adiciona `ChatPanel` (React) + integração no `App`
- `.dev/modo.sh` — estende pra criar/remover `.mcp.json`
- `CLAUDE.orquestrador.md` — adiciona seção "Canal do Mission Control"
- `.gitignore` — adiciona `/.mcp.json`

**Deletar (cleanup final):**

- `.mission-control/channel-poc/` (POC inteiro)
- `.mcp.json` atual na raiz (versão POC — será regerado pelo `modo.sh` a partir do template novo)

---

## Convenções

- **Eventos de chat no SQLite:**
  - `source: 'orquestrador'`, `type: 'chat_orq'`, `payload: { text: string }` — resposta do Orq
  - `source: 'dashboard'`, `type: 'chat_user'`, `payload: { text: string }` — input do usuário
- **Tool name:** `reply` (no servidor MCP `gondola-chat`)
- **Chave no `.mcp.json`:** `gondola-chat`
- **Flag de boot do Claude:** `claude --dangerously-load-development-channels server:gondola-chat`
- **Commits:** conventional-commits em PT-BR, um por task (salvo onde indicado).

---

## Task 1: Bootstrap do bridge — diretório, package.json, deps

**Files:**
- Create: `.mission-control/channel/package.json`
- Modify: `.gitignore` (linha nova)

- [ ] **Step 1: Criar `.mission-control/channel/package.json`**

```json
{
  "name": "gondola-channel-bridge",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "MCP stdio bridge between the Orquestrador (Claude Code) and the Mission Control server",
  "scripts": {
    "start": "node server.mjs",
    "test": "node test-handlers.mjs"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "ws": "^8.18.0"
  }
}
```

- [ ] **Step 2: Instalar dependências**

Run:
```bash
cd .mission-control/channel && npm install && cd -
```
Expected: `node_modules/` criado, `package-lock.json` gerado, sem erros. `node_modules/` já está no `.gitignore` global.

- [ ] **Step 3: Adicionar `/.mcp.json` ao `.gitignore`**

Modify `.gitignore`. Adicionar no bloco "Mission Control — artefatos de runtime local" (após `.mission-control/port`):

```
# .mcp.json é gerado pelo .dev/modo.sh conforme o modo ativo
/.mcp.json
```

- [ ] **Step 4: Commit**

```bash
git add .mission-control/channel/package.json .mission-control/channel/package-lock.json .gitignore
git commit -m "chore(channel): bootstrap do bridge MCP (package.json + gitignore)"
```

---

## Task 2: Bridge — funções puras (`handlers.mjs`) + testes

**Files:**
- Create: `.mission-control/channel/handlers.mjs`
- Create: `.mission-control/channel/test-handlers.mjs`

- [ ] **Step 1: Escrever testes primeiro em `test-handlers.mjs`**

```javascript
#!/usr/bin/env node
// Smoke tests das funções puras do bridge. Sem framework de teste.
// Exit 0 = pass, exit 1 = fail.

import { createReplyHandler, createWsMessageHandler } from './handlers.mjs'

let failures = 0
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg)
    failures++
  } else {
    console.log('  ok:', msg)
  }
}

// ─── createReplyHandler ───
console.log('createReplyHandler')

// 1. POST bem-sucedido retorna {ok: true}
{
  const calls = []
  const fakeFetch = async (url, opts) => {
    calls.push({ url, opts })
    return { ok: true, status: 201 }
  }
  const reply = createReplyHandler({
    mcUrl: 'http://test:4000',
    fetchImpl: fakeFetch,
    generateId: () => 'id-1',
    now: () => '2026-04-10T10:00:00Z',
  })
  const result = await reply({ text: 'hello' })
  assert(result.ok === true, 'reply() happy path returns {ok:true}')
  assert(calls.length === 1, 'exactly one POST issued')
  assert(calls[0].url === 'http://test:4000/events', 'POSTs to /events')
  const body = JSON.parse(calls[0].opts.body)
  assert(body.source === 'orquestrador', 'body.source = orquestrador')
  assert(body.type === 'chat_orq', 'body.type = chat_orq')
  assert(body.payload.text === 'hello', 'body.payload.text preserved')
  assert(body.event_id === 'id-1', 'event_id injected')
  assert(body.timestamp === '2026-04-10T10:00:00Z', 'timestamp injected')
}

// 2. POST com HTTP !ok retorna {ok: false, error: 'mc_error'}
{
  const reply = createReplyHandler({
    mcUrl: 'http://test:4000',
    fetchImpl: async () => ({ ok: false, status: 500 }),
    generateId: () => 'id',
    now: () => 'ts',
  })
  const result = await reply({ text: 'x' })
  assert(result.ok === false, 'HTTP 5xx → ok:false')
  assert(result.error === 'mc_error', 'HTTP 5xx → error mc_error')
  assert(result.status === 500, 'status surfaced')
}

// 3. fetch throw → {ok: false, error: 'mc_offline'}
{
  const reply = createReplyHandler({
    mcUrl: 'http://test:4000',
    fetchImpl: async () => { throw new Error('ECONNREFUSED') },
    generateId: () => 'id',
    now: () => 'ts',
  })
  const result = await reply({ text: 'x' })
  assert(result.ok === false, 'fetch throw → ok:false')
  assert(result.error === 'mc_offline', 'fetch throw → error mc_offline')
}

// ─── createWsMessageHandler ───
console.log('createWsMessageHandler')

// 4. chat_user → notification emitida
{
  const sent = []
  const handler = createWsMessageHandler({
    sendNotification: (n) => sent.push(n),
  })
  handler(JSON.stringify({
    type: 'chat_user',
    timestamp: '2026-04-10T10:00:00Z',
    payload: { text: 'olá orq' },
  }))
  assert(sent.length === 1, 'chat_user → 1 notification emitted')
  assert(sent[0].method === 'notifications/claude/channel', 'method is claude/channel')
  assert(sent[0].params.content === 'olá orq', 'content = payload.text')
  assert(sent[0].params.meta.source === 'gondola-chat', 'meta.source = gondola-chat')
}

// 5. chat_orq → ignorado (evita loop)
{
  const sent = []
  const handler = createWsMessageHandler({
    sendNotification: (n) => sent.push(n),
  })
  handler(JSON.stringify({ type: 'chat_orq', payload: { text: 'eco próprio' } }))
  assert(sent.length === 0, 'chat_orq → 0 notifications (loop prevention)')
}

// 6. JSON inválido → não quebra, não emite
{
  const sent = []
  const handler = createWsMessageHandler({
    sendNotification: (n) => sent.push(n),
  })
  handler('not valid json')
  assert(sent.length === 0, 'invalid JSON → silent no-op')
}

// 7. Outros event types → ignorados
{
  const sent = []
  const handler = createWsMessageHandler({
    sendNotification: (n) => sent.push(n),
  })
  handler(JSON.stringify({ type: 'progress', payload: {} }))
  assert(sent.length === 0, 'unrelated event type → ignored')
}

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s)`)
process.exit(failures === 0 ? 0 : 1)
```

- [ ] **Step 2: Rodar o teste e verificar que falha**

Run:
```bash
cd .mission-control/channel && node test-handlers.mjs
```
Expected: falha com erro de import (`handlers.mjs` ainda não existe).

- [ ] **Step 3: Implementar `handlers.mjs`**

```javascript
// Pure-function handlers for the MCP bridge. Kept free of stdio/WS plumbing
// so they can be unit-tested without spinning up a real MCP server.

export function createReplyHandler({ mcUrl, fetchImpl = globalThis.fetch, generateId, now }) {
  return async function reply({ text }) {
    const body = {
      event_id: generateId(),
      timestamp: now(),
      source: 'orquestrador',
      type: 'chat_orq',
      payload: { text: String(text ?? '') },
    }
    try {
      const res = await fetchImpl(`${mcUrl}/events`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        return { ok: false, error: 'mc_error', status: res.status }
      }
      return { ok: true }
    } catch (err) {
      return { ok: false, error: 'mc_offline', detail: String(err) }
    }
  }
}

export function createWsMessageHandler({ sendNotification }) {
  return function onMessage(raw) {
    let event
    try {
      event = JSON.parse(typeof raw === 'string' ? raw : raw.toString())
    } catch {
      return
    }
    if (!event || event.type !== 'chat_user') return
    const text = event.payload?.text ?? ''
    const ts = event.payload?.ts ?? event.timestamp ?? new Date().toISOString()
    sendNotification({
      method: 'notifications/claude/channel',
      params: {
        content: text,
        meta: { source: 'gondola-chat', ts },
      },
    })
  }
}
```

- [ ] **Step 4: Rodar o teste e verificar que passa**

Run:
```bash
cd .mission-control/channel && node test-handlers.mjs
```
Expected: `PASS: 0 failure(s)`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add .mission-control/channel/handlers.mjs .mission-control/channel/test-handlers.mjs
git commit -m "feat(channel): handlers puros do bridge (reply + ws message) com smoke test"
```

---

## Task 3: Bridge — `server.mjs` (montagem stdio MCP)

**Files:**
- Create: `.mission-control/channel/server.mjs`

- [ ] **Step 1: Escrever `server.mjs`**

```javascript
#!/usr/bin/env node
// gondola-chat — MCP stdio bridge between the Orquestrador (Claude Code) and
// the Mission Control server. See docs/superpowers/specs/2026-04-10-channel-mc-orquestrador-design.md

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { randomUUID } from 'node:crypto'
import WebSocket from 'ws'
import { createReplyHandler, createWsMessageHandler } from './handlers.mjs'

const MC_HTTP = process.env.GONDOLA_MC_HTTP ?? 'http://localhost:4000'
const MC_WS = process.env.GONDOLA_MC_WS ?? 'ws://localhost:4000'

const log = (...args) => process.stderr.write(`[gondola-chat] ${args.join(' ')}\n`)

log('booting')

const mcp = new Server(
  { name: 'gondola-chat', version: '0.1.0' },
  {
    capabilities: {
      tools: {},
      experimental: {
        'claude/channel': {},
      },
    },
    instructions:
      'Canal Orquestrador ↔ Mission Control. Sempre que você responder conversacionalmente ao usuário, chame também a tool `reply(text)` com o mesmo texto da sua resposta, para espelhar no dashboard. Não ecoe output de bash, Read ou diffs — só o texto conversacional que você diria ao usuário. Se `reply` retornar {ok:false}, avise ao usuário no terminal que o dashboard está offline e continue.',
  },
)

const reply = createReplyHandler({
  mcUrl: MC_HTTP,
  generateId: () => randomUUID(),
  now: () => new Date().toISOString(),
})

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'reply',
      description:
        'Espelha uma resposta conversacional do Orquestrador no dashboard do Mission Control. Chame sempre que responder ao usuário. Não usar para output de bash, leituras de arquivo ou diffs.',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'O mesmo texto que você mostrou ao usuário no terminal.' },
        },
        required: ['text'],
      },
    },
  ],
}))

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name !== 'reply') {
    return {
      isError: true,
      content: [{ type: 'text', text: `unknown tool: ${req.params.name}` }],
    }
  }
  const result = await reply(req.params.arguments ?? {})
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }],
  }
})

// ─── WS client pro MC ───
const onWsMessage = createWsMessageHandler({
  sendNotification: (n) => {
    mcp.notification(n).catch((err) => log('notification failed:', String(err)))
  },
})

let ws
let reconnectDelay = 1000
function connectWs() {
  log('connecting ws →', MC_WS)
  ws = new WebSocket(MC_WS)
  ws.on('open', () => {
    log('ws open')
    reconnectDelay = 1000
  })
  ws.on('message', (raw) => onWsMessage(raw))
  ws.on('close', () => {
    log('ws closed, retrying in', reconnectDelay, 'ms')
    setTimeout(connectWs, reconnectDelay)
    reconnectDelay = Math.min(reconnectDelay * 2, 10000)
  })
  ws.on('error', (err) => log('ws error:', String(err?.message ?? err)))
}
connectWs()

await mcp.connect(new StdioServerTransport())
log('connected over stdio')
```

- [ ] **Step 2: Syntax check do `server.mjs`**

Run:
```bash
node --check .mission-control/channel/server.mjs
```
Expected: exit 0, sem saída (ok). Qualquer erro de sintaxe sai aqui.

Opcional — se quiser um smoke run com o MCP server subindo de verdade (requer GNU `timeout` / `coreutils` no mac), execute:
```bash
( cd .mission-control/channel && node -e "import('./server.mjs').then(()=>setTimeout(()=>process.exit(0),500)).catch(e=>{console.error(e);process.exit(1)})" ) 2>&1 | head -20
```
Expected: stderr mostra `[gondola-chat] booting`, `[gondola-chat] connecting ws → ws://localhost:4000` e depois `[gondola-chat] connected over stdio`. Erros de WS connect são esperados se o MC não estiver rodando — não são fatais.

- [ ] **Step 3: Rodar os testes de handlers novamente pra garantir que nada regrediu**

Run:
```bash
cd .mission-control/channel && node test-handlers.mjs
```
Expected: `PASS: 0 failure(s)`.

- [ ] **Step 4: Commit**

```bash
git add .mission-control/channel/server.mjs
git commit -m "feat(channel): bridge stdio MCP (tool reply + WS client + reconnect)"
```

---

## Task 4: MC server — `POST /chat/input` + `GET /chat/history` + testes

**Files:**
- Modify: `.mission-control/server/index.js`
- Modify: `.mission-control/server/db.js` (função nova `getChatHistory`)
- Create: `.mission-control/server/test-chat-route.mjs`

- [ ] **Step 1: Adicionar `getChatHistory` em `db.js`**

Edit `.mission-control/server/db.js`. Logo após `getAllEvents()`, adicionar:

```javascript
function getChatHistory() {
  return db.prepare(`
    SELECT * FROM events
    WHERE type IN ('chat_orq', 'chat_user')
    ORDER BY timestamp ASC
  `).all().map(row => ({
    ...row,
    payload: JSON.parse(row.payload || '{}')
  }));
}
```

E atualizar o `module.exports` no fim:

```javascript
module.exports = { insertEvent, getAllEvents, getState, getChatHistory, getDb };
```

- [ ] **Step 2: Escrever teste `test-chat-route.mjs`**

```javascript
#!/usr/bin/env node
// Integration smoke test for POST /chat/input and GET /chat/history.
// Spawns the MC server on a temp port with a temp SQLite path.

import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import WebSocket from 'ws'

const tmp = mkdtempSync(join(tmpdir(), 'mc-chat-test-'))
const port = 4000 + Math.floor(Math.random() * 1000)

const child = spawn(process.execPath, ['index.js'], {
  cwd: new URL('.', import.meta.url).pathname,
  env: { ...process.env, PORT: String(port), MC_DB_DIR: tmp },
  stdio: ['ignore', 'inherit', 'inherit'],
})

let failures = 0
function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); failures++ }
  else console.log('  ok:', msg)
}

async function waitForUp() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://localhost:${port}/state`)
      if (res.ok) return
    } catch {}
    await new Promise(r => setTimeout(r, 100))
  }
  throw new Error('MC server did not come up')
}

try {
  await waitForUp()

  // 1. POST /chat/input inserts an event and broadcasts via WS
  const ws = new WebSocket(`ws://localhost:${port}`)
  const received = []
  await new Promise((resolve, reject) => {
    ws.on('open', resolve)
    ws.on('error', reject)
  })
  ws.on('message', (raw) => received.push(JSON.parse(raw.toString())))

  const postRes = await fetch(`http://localhost:${port}/chat/input`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'oi orq' }),
  })
  assert(postRes.status === 201, 'POST /chat/input returns 201')
  const postBody = await postRes.json()
  assert(postBody.ok === true, 'response body ok:true')
  assert(typeof postBody.event_id === 'string', 'response body has event_id')

  await new Promise(r => setTimeout(r, 100))
  assert(received.length === 1, 'WS client received exactly 1 event')
  assert(received[0].type === 'chat_user', 'broadcast type = chat_user')
  assert(received[0].source === 'dashboard', 'broadcast source = dashboard')
  assert(received[0].payload.text === 'oi orq', 'broadcast text preserved')

  // 2. GET /chat/history returns the inserted event
  const histRes = await fetch(`http://localhost:${port}/chat/history`)
  assert(histRes.ok, 'GET /chat/history 200')
  const history = await histRes.json()
  assert(Array.isArray(history), 'history is array')
  assert(history.length === 1, 'history has 1 entry')
  assert(history[0].type === 'chat_user', 'history entry type correct')
  assert(history[0].payload.text === 'oi orq', 'history entry payload preserved')

  // 3. POST /chat/input with empty text returns 400
  const badRes = await fetch(`http://localhost:${port}/chat/input`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: '' }),
  })
  assert(badRes.status === 400, 'empty text rejected with 400')

  ws.close()
} finally {
  child.kill('SIGTERM')
  rmSync(tmp, { recursive: true, force: true })
}

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s)`)
process.exit(failures === 0 ? 0 : 1)
```

- [ ] **Step 3: Suportar `MC_DB_DIR` override em `db.js`**

O teste passa um diretório temporário via env var. Edit `.mission-control/server/db.js`, substituir a definição de `DB_DIR`:

**De:**
```javascript
const DB_DIR = path.join(__dirname, '..', 'db');
```

**Para:**
```javascript
const DB_DIR = process.env.MC_DB_DIR || path.join(__dirname, '..', 'db');
```

- [ ] **Step 4: Rodar o teste e verificar que falha (rotas não existem ainda)**

Run:
```bash
cd .mission-control/server && node test-chat-route.mjs
```
Expected: FAIL — `POST /chat/input returns 201` falha (404 ou 500 porque rota não existe).

- [ ] **Step 5: Implementar as rotas em `index.js`**

Edit `.mission-control/server/index.js`. No topo, atualizar o import:

**De:**
```javascript
const { insertEvent, getState } = require('./db');
```

**Para:**
```javascript
const { insertEvent, getState, getChatHistory } = require('./db');
const { randomUUID } = require('node:crypto');
```

Depois, antes de `app.get('/state', ...)`, adicionar:

```javascript
// POST /chat/input — entrada de mensagem digitada pelo usuário no dashboard
app.post('/chat/input', (req, res) => {
  try {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) {
      return res.status(400).json({ error: 'text is required and must be a non-empty string' });
    }
    const event = {
      event_id: randomUUID(),
      timestamp: new Date().toISOString(),
      source: 'dashboard',
      type: 'chat_user',
      payload: { text },
    };
    insertEvent(event);
    const message = JSON.stringify(event);
    wss.clients.forEach(client => {
      if (client.readyState === 1) client.send(message);
    });
    res.status(201).json({ ok: true, event_id: event.event_id });
  } catch (err) {
    console.error('Error on /chat/input:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /chat/history — histórico completo de eventos de chat para replay
app.get('/chat/history', (req, res) => {
  try {
    res.json(getChatHistory());
  } catch (err) {
    console.error('Error on /chat/history:', err.message);
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 6: Rodar o teste e verificar que passa**

Run:
```bash
cd .mission-control/server && node test-chat-route.mjs
```
Expected: `PASS: 0 failure(s)`.

- [ ] **Step 7: Commit**

```bash
git add .mission-control/server/index.js .mission-control/server/db.js .mission-control/server/test-chat-route.mjs
git commit -m "feat(mission-control): rotas de chat (POST /chat/input + GET /chat/history)"
```

---

## Task 5: Gating por modo — `modo.sh` + template `.mcp.json`

**Files:**
- Create: `.dev/templates/mcp.orquestrador.json`
- Modify: `.dev/modo.sh`

- [ ] **Step 1: Criar template `.dev/templates/mcp.orquestrador.json`**

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

- [ ] **Step 2: Estender `.dev/modo.sh`**

Edit `.dev/modo.sh`. Atualizar o bloco `dev)` pra remover o `.mcp.json` e o bloco `op|operacao)` pra copiar o template.

**De:**
```bash
  dev)
    ln -sf .dev/CLAUDE.dev.md CLAUDE.md
    ln -sf ../.dev/memory.dev.md "$MEMORY_PATH"
    ln -sf ../.dev/settings.dev.json "$SETTINGS_PATH"
    echo "→ Modo DESENVOLVEDOR ativado (persona + memória + settings)"
    ;;
  op|operacao)
    ln -sf CLAUDE.orquestrador.md CLAUDE.md
    ln -sf ../memory.op.md "$MEMORY_PATH"
    ln -sf ../.dev/settings.op.json "$SETTINGS_PATH"
    echo "→ Modo ORQUESTRADOR ativado (persona + memória + settings)"
    ;;
```

**Para:**
```bash
  dev)
    ln -sf .dev/CLAUDE.dev.md CLAUDE.md
    ln -sf ../.dev/memory.dev.md "$MEMORY_PATH"
    ln -sf ../.dev/settings.dev.json "$SETTINGS_PATH"
    rm -f .mcp.json
    echo "→ Modo DESENVOLVEDOR ativado (persona + memória + settings + canal OFF)"
    ;;
  op|operacao)
    ln -sf CLAUDE.orquestrador.md CLAUDE.md
    ln -sf ../memory.op.md "$MEMORY_PATH"
    ln -sf ../.dev/settings.op.json "$SETTINGS_PATH"
    cp .dev/templates/mcp.orquestrador.json .mcp.json
    echo "→ Modo ORQUESTRADOR ativado (persona + memória + settings + canal ON)"
    ;;
```

E atualizar o bloco `status)` pra também reportar o `.mcp.json`:

**De:**
```bash
  status)
    echo "CLAUDE.md  → $(readlink CLAUDE.md)"
    echo "memory     → $(readlink $MEMORY_PATH)"
    echo "settings   → $(readlink $SETTINGS_PATH)"
    ;;
```

**Para:**
```bash
  status)
    echo "CLAUDE.md  → $(readlink CLAUDE.md)"
    echo "memory     → $(readlink $MEMORY_PATH)"
    echo "settings   → $(readlink $SETTINGS_PATH)"
    if [ -f .mcp.json ]; then
      echo "canal      → ON (.mcp.json presente)"
    else
      echo "canal      → OFF (.mcp.json ausente)"
    fi
    ;;
```

- [ ] **Step 3: Testar os dois modos manualmente**

Run:
```bash
./.dev/modo.sh dev && ls -la .mcp.json 2>&1 | head -1
```
Expected: mensagem "canal OFF" e `ls` reporta "No such file or directory".

Run:
```bash
./.dev/modo.sh op && cat .mcp.json
```
Expected: mensagem "canal ON" e `.mcp.json` mostrado com a chave `gondola-chat`.

Run:
```bash
./.dev/modo.sh status
```
Expected: lista os symlinks atuais e "canal → ON".

- [ ] **Step 4: Commit**

```bash
git add .dev/modo.sh .dev/templates/mcp.orquestrador.json
git commit -m "feat(modo): gerenciamento de .mcp.json conforme modo dev/op"
```

---

## Task 6: Dashboard — `ChatPanel` (UI + CSS) + integração no `App`

O dashboard usa React 18 via Babel standalone inline em `index.html`. Vamos criar o componente `ChatPanel`, adicionar CSS no bloco `<style>` e integrar no layout.

**Files:**
- Modify: `.mission-control/dashboard/index.html`

- [ ] **Step 1: Adicionar CSS do chat no bloco `<style>`**

Edit `.mission-control/dashboard/index.html`. Localizar a linha `</style>` (dentro do `<head>`) e inserir, **imediatamente antes dela**, o bloco:

```css
    /* ─── Chat Panel ─── */
    .chat-panel {
      display: flex;
      flex-direction: column;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: var(--card-shadow);
      min-height: 0;
    }
    .chat-panel-header {
      padding: 12px 16px;
      font-family: 'DM Sans', sans-serif;
      font-weight: 600;
      font-size: 14px;
      color: var(--navy-deep);
      border-bottom: 1px solid var(--card-border);
      background: #f8fafc;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .chat-panel-header .chat-status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--green);
    }
    .chat-panel-header .chat-status-dot.offline {
      background: var(--red);
    }
    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .chat-bubble {
      max-width: 85%;
      padding: 8px 12px;
      border-radius: 12px;
      font-size: 13px;
      line-height: 1.4;
      word-wrap: break-word;
      white-space: pre-wrap;
    }
    .chat-bubble.orq {
      align-self: flex-start;
      background: var(--lime-soft);
      color: var(--navy-deep);
      border-bottom-left-radius: 4px;
    }
    .chat-bubble.user {
      align-self: flex-end;
      background: var(--navy-light);
      color: var(--text-white);
      border-bottom-right-radius: 4px;
    }
    .chat-bubble.historical {
      opacity: 0.5;
      filter: grayscale(0.6);
    }
    .chat-bubble .chat-timestamp {
      display: block;
      font-size: 10px;
      opacity: 0.6;
      margin-top: 4px;
    }
    .chat-input-area {
      border-top: 1px solid var(--card-border);
      padding: 10px 12px;
      display: flex;
      gap: 8px;
      background: #f8fafc;
    }
    .chat-input-area textarea {
      flex: 1;
      resize: none;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 8px 10px;
      font-family: inherit;
      font-size: 13px;
      min-height: 36px;
      max-height: 100px;
    }
    .chat-input-area textarea:disabled {
      background: #f1f5f9;
      color: #94a3b8;
      cursor: not-allowed;
    }
    .chat-input-area button {
      border: none;
      background: var(--lime);
      color: var(--navy-deep);
      font-weight: 600;
      border-radius: 8px;
      padding: 0 16px;
      cursor: pointer;
      font-family: inherit;
      font-size: 13px;
    }
    .chat-input-area button:disabled {
      background: #cbd5e1;
      cursor: not-allowed;
    }
    .chat-empty {
      text-align: center;
      color: #94a3b8;
      font-size: 12px;
      padding: 24px 8px;
    }
```

- [ ] **Step 2: Adicionar o componente `ChatPanel` dentro do `<script type="text/babel">`**

Localizar em `index.html` a linha `// ─── Agent Panel ───` (início do componente `AgentPanel`). **Imediatamente antes dessa linha**, inserir:

```jsx
    // ─── Chat Panel ───
    // Script-scoped hook para o App rotear eventos chat_* pro ChatPanel sem precisar
    // de ref/context. Sessão única (decisão do spec) garante uma instância só.
    let appendChatEvent = () => {};

    function ChatPanel({ connected }) {
      const [messages, setMessages] = useState([]); // [{id, type, text, ts, historical}]
      const [draft, setDraft] = useState('');
      const [sending, setSending] = useState(false);
      const scrollRef = useRef(null);
      const autoScrollRef = useRef(true);

      // Fetch historical chat on mount
      useEffect(() => {
        fetch('/chat/history')
          .then(r => r.ok ? r.json() : [])
          .then(history => {
            setMessages(history.map(e => ({
              id: e.event_id,
              type: e.type,
              text: e.payload?.text ?? '',
              ts: e.timestamp,
              historical: true,
            })));
          })
          .catch(() => {});
      }, []);

      // Track user scroll — only autoscroll if user is at bottom
      const onScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        autoScrollRef.current = atBottom;
      }, []);

      // Autoscroll on new message (only if user was at bottom)
      useEffect(() => {
        if (autoScrollRef.current && scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, [messages]);

      const appendLiveEvent = useCallback((evt) => {
        if (evt.type !== 'chat_orq' && evt.type !== 'chat_user') return;
        setMessages(prev => {
          // De-dupe by event_id (in case of late history race)
          if (prev.some(m => m.id === evt.event_id)) return prev;
          return [...prev, {
            id: evt.event_id,
            type: evt.type,
            text: evt.payload?.text ?? '',
            ts: evt.timestamp,
            historical: false,
          }];
        });
      }, []);

      async function send() {
        const text = draft.trim();
        if (!text || sending || !connected) return;
        setSending(true);
        try {
          const res = await fetch('/chat/input', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text }),
          });
          if (res.ok) setDraft('');
        } catch {}
        finally { setSending(false); }
      }

      function onKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          send();
        }
      }

      // Expose appendLiveEvent for the App-level WS handler to call.
      // Installed as an effect so it unbinds if ChatPanel ever unmounts.
      useEffect(() => {
        appendChatEvent = appendLiveEvent;
        return () => { appendChatEvent = () => {}; };
      }, [appendLiveEvent]);

      return (
        <div className="chat-panel">
          <div className="chat-panel-header">
            <span>Chat do Orquestrador</span>
            <span className={`chat-status-dot ${connected ? '' : 'offline'}`} title={connected ? 'conectado' : 'desconectado'}></span>
          </div>
          <div className="chat-messages" ref={scrollRef} onScroll={onScroll}>
            {messages.length === 0 ? (
              <div className="chat-empty">Nenhuma mensagem ainda.</div>
            ) : messages.map(m => (
              <div
                key={m.id}
                className={`chat-bubble ${m.type === 'chat_orq' ? 'orq' : 'user'} ${m.historical ? 'historical' : ''}`}
              >
                {m.text}
                <span className="chat-timestamp">{new Date(m.ts).toLocaleTimeString('pt-BR')}</span>
              </div>
            ))}
          </div>
          <div className="chat-input-area">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={connected ? 'Digite uma mensagem (Enter envia, Shift+Enter quebra linha)' : 'Desconectado…'}
              disabled={!connected || sending}
            />
            <button onClick={send} disabled={!connected || sending || !draft.trim()}>
              Enviar
            </button>
          </div>
        </div>
      );
    }
```

**Nota sobre `appendChatEvent`:** é uma variável de escopo de script que o `ChatPanel` preenche via `useEffect` ao montar e zera ao desmontar. O `App` (próxima task) chama `appendChatEvent(evt)` dentro do handler do WS. Funciona porque há uma única instância do `ChatPanel` no dashboard (sessão única — decisão do spec). Evita precisar de `useRef` forwarded ou Context só pra um call-site.

- [ ] **Step 3: Commit parcial (componente isolado, sem integração ainda)**

```bash
git add .mission-control/dashboard/index.html
git commit -m "feat(dashboard): componente ChatPanel (UI + CSS), ainda não integrado"
```

---

## Task 7: Dashboard — integração do `ChatPanel` no `App` + roteamento de eventos WS

**Files:**
- Modify: `.mission-control/dashboard/index.html`

- [ ] **Step 1: Modificar o `applyEvent` ou o `onmessage` do WS pra rotear chat events**

Edit `.mission-control/dashboard/index.html`. Localizar o `ws.onmessage` dentro do `useEffect` do `App` (por volta da linha 913):

**De:**
```javascript
          ws.onmessage = (e) => {
            try {
              const evt = JSON.parse(e.data);
              applyEvent(evt);
              if (evt.process) {
                setSelected(prev => prev || evt.process);
              }
            } catch {}
          };
```

**Para:**
```javascript
          ws.onmessage = (e) => {
            try {
              const evt = JSON.parse(e.data);
              if (evt.type === 'chat_orq' || evt.type === 'chat_user') {
                appendChatEvent(evt);
                return;
              }
              applyEvent(evt);
              if (evt.process) {
                setSelected(prev => prev || evt.process);
              }
            } catch {}
          };
```

- [ ] **Step 2: Inserir `<ChatPanel connected={connected} />` no layout do `App`**

Localizar o `return` do `App` (por volta da linha 929):

**De:**
```jsx
      return (
        <div id="root" style={{height: '100vh', display: 'flex', flexDirection: 'column'}}>
          <TopBar state={state} connected={connected} sessionStart={sessionStart} />
          <div className="layout">
            <Sidebar processes={state.processes} selected={selected} onSelect={setSelected} />
            <div className="main">
              <AgentPanel process={selectedProcess} />
              <TaskPanel process={selectedProcess} />
            </div>
          </div>
        </div>
      );
```

**Para:**
```jsx
      return (
        <div id="root" style={{height: '100vh', display: 'flex', flexDirection: 'column'}}>
          <TopBar state={state} connected={connected} sessionStart={sessionStart} />
          <div className="layout" style={{flex: 1, minHeight: 0}}>
            <Sidebar processes={state.processes} selected={selected} onSelect={setSelected} />
            <div className="main">
              <AgentPanel process={selectedProcess} />
              <TaskPanel process={selectedProcess} />
            </div>
            <div style={{
              width: '360px',
              padding: '16px 16px 16px 0',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}>
              <ChatPanel connected={connected} />
            </div>
          </div>
        </div>
      );
```

- [ ] **Step 3: Verificação manual no browser**

Pré-requisito: MC server rodando (`./.mission-control/start.sh`).

Steps:
1. Abrir `http://localhost:4000/dashboard` no browser.
2. Conferir: painel de chat aparece na coluna direita, com cabeçalho "Chat do Orquestrador" + dot verde (conectado).
3. Abrir DevTools → Network, confirmar que `GET /chat/history` é feito e retorna `[]` (vazio no primeiro load).
4. No DevTools → Console, rodar:
   ```js
   fetch('/events', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({event_id: crypto.randomUUID(), timestamp: new Date().toISOString(), source: 'orquestrador', type: 'chat_orq', payload: {text: 'bolha de teste'}})})
   ```
   Confirmar: bolha verde-clara "bolha de teste" aparece à esquerda no painel em tempo real.
5. Digitar uma mensagem no textarea e clicar Enviar. Confirmar: bolha escura aparece à direita; verificar na tabela events do SQLite que o `chat_user` foi gravado.
6. Fechar a aba, reabrir. Confirmar: as duas bolhas aparecem **em cinza/opacidade reduzida** (historical).

Se algum passo falhar, corrigir antes de commitar.

- [ ] **Step 4: Commit**

```bash
git add .mission-control/dashboard/index.html
git commit -m "feat(dashboard): integra ChatPanel no layout e roteia eventos chat_* via WS"
```

---

## Task 8: `CLAUDE.orquestrador.md` — seção "Canal do Mission Control"

**Files:**
- Modify: `CLAUDE.orquestrador.md`

A seção nova é uma subseção `###` dentro da seção `## Mission Control` existente (linha 190), inserida **entre `### Exibir o Mission Control` e `### Encerramento`**. Ordem final: Auto-start → Exibir → **Canal do Orquestrador** (novo) → Encerramento.

- [ ] **Step 1: Inserir a subseção nova**

Edit `CLAUDE.orquestrador.md`. Localizar a linha:

```markdown
### Encerramento
```

(atualmente em torno da linha 216). Inserir **imediatamente antes dela** (com uma linha em branco antes e depois) o bloco:

```markdown
### Canal do Orquestrador

Quando este arquivo estiver ativo (modo `op`), existe um canal de chat paralelo ao terminal, visível no dashboard do Mission Control. O canal é fornecido por um MCP server local chamado `gondola-chat`, que expõe a tool `reply(text)`.

**Regra obrigatória:** toda vez que você responder **conversacionalmente** ao lojista, chame também a tool `reply(text)` do MCP `gondola-chat` com o mesmo texto da sua resposta. O dashboard é um mirror — ele só mostra o que você ecoar.

**O que ecoar:**

- Respostas conversacionais ao lojista (perguntas, confirmações, explicações, relatórios).

**O que NÃO ecoar:**

- Output bruto de comandos bash.
- Conteúdo lido de arquivos via Read.
- Diffs, tool calls internos, reasoning.
- Mensagens automáticas de progresso que já são reportadas via `report-progress.sh`.

**Quando a tool `reply` retornar `{ ok: false }`:**

- `error: "mc_offline"` → o Mission Control server não está rodando. Avise o lojista no terminal ("Dashboard offline — mensagem não foi espelhada") e continue normalmente.
- `error: "mc_error"` → o MC respondeu com 5xx. Idem.

**Input do dashboard:** se o lojista digitar uma mensagem no painel de chat do dashboard, você receberá uma notificação de canal como se ele tivesse falado no terminal. Responda normalmente — e lembre-se de chamar `reply()` pra ecoar sua resposta de volta.

**Quando o canal NÃO está disponível:**

- Se a tool `reply` não estiver registrada (ex.: sessão de desenvolvimento sem o MCP), ignore toda esta seção — converse normalmente pelo terminal.
```

- [ ] **Step 2: Verificar estrutura**

Run:
```bash
grep -n "^###" CLAUDE.orquestrador.md | tail -5
```
Expected: a lista termina com `### Encerramento` precedido por `### Canal do Orquestrador` (ambos dentro da seção `## Mission Control`).

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.orquestrador.md
git commit -m "docs(orquestrador): subsecao Canal do Orquestrador (disciplina do mirror)"
```

---

## Task 9: Checklist manual + baseline de disciplina

**Files:**
- Create: `.dev/test-outputs/channel/manual-checklist.md`
- Create: `.dev/test-outputs/channel/mirror-discipline.md`

- [ ] **Step 1: Criar `manual-checklist.md`**

```markdown
# Canal MC ↔ Orquestrador — Checklist Manual E2E

Rodar este checklist após qualquer mudança no canal. Marcar `[x]` quando o item passar, anotar ao lado se falhar.

## Setup

- [ ] `./.dev/modo.sh op` → mensagem "canal ON", `.mcp.json` existe na raiz.
- [ ] `./.mission-control/start.sh` → MC server rodando em `:4000`.
- [ ] `curl -s http://localhost:4000/chat/history` → retorna JSON array (pode estar vazio).

## Boot do Claude

- [ ] `claude --dangerously-load-development-channels server:gondola-chat` → Claude Code sobe sem erro fatal.
- [ ] Dentro do `claude`, `/mcp` → lista `gondola-chat` como `connected`.
- [ ] Stderr do MCP server mostra `[gondola-chat] connected over stdio` e `[gondola-chat] ws open`.

## Dashboard

- [ ] Abrir `http://localhost:4000/dashboard` → painel "Chat do Orquestrador" visível na direita.
- [ ] Dot de status do chat verde (conectado).

## Fluxo Orq → Dashboard

- [ ] Perguntar algo ao Orq no terminal (ex.: "oi, me cumprimente").
- [ ] Orq responde no terminal.
- [ ] Orq chama `reply()` — verificar no stderr do MCP server que a tool foi invocada.
- [ ] Bolha verde-clara (cor normal, não cinza) aparece à esquerda no dashboard com o texto da resposta.

## Fluxo Dashboard → Orq

- [ ] Digitar "teste do canal" no textarea do dashboard, Enter.
- [ ] Bolha escura aparece à direita no dashboard (cor normal).
- [ ] No terminal do `claude`, aparece uma system-reminder com o texto "teste do canal".
- [ ] Orq responde → bolha verde aparece no dashboard.

## Replay de histórico

- [ ] Fechar a aba do dashboard.
- [ ] Continuar conversando com o Orq pelo terminal (1-2 turnos).
- [ ] Reabrir `http://localhost:4000/dashboard`.
- [ ] Bolhas anteriores aparecem com opacidade reduzida (classe `historical`).
- [ ] Novas mensagens depois do reload aparecem com cor normal.

## Resiliência

- [ ] Matar o MC server (`kill $(cat .mission-control/pid)`).
- [ ] Pedir pro Orq responder algo novo no terminal.
- [ ] Orq chama `reply()` → tool retorna `{ok: false, error: "mc_offline"}`.
- [ ] Orq avisa no terminal que o dashboard está offline.
- [ ] Reiniciar MC (`./.mission-control/start.sh`).
- [ ] Próxima resposta do Orq volta a ecoar (bridge reconectou o WS).

## Gating por modo

- [ ] Sair do `claude`.
- [ ] `./.dev/modo.sh dev` → mensagem "canal OFF", `.mcp.json` removido.
- [ ] `claude` sem flag → sobe em modo dev; `/mcp` não lista `gondola-chat`.
- [ ] `./.dev/modo.sh op` → `.mcp.json` volta.

## Observações

_(anote aqui qualquer comportamento inesperado)_
```

- [ ] **Step 2: Criar `mirror-discipline.md`**

```markdown
# Baseline de disciplina do mirror

Medição comportamental: dada uma conversa real com o Orquestrador em modo `op`, quantas respostas foram corretamente ecoadas via `reply()` e quantas foram esquecidas.

## Protocolo

1. Rodar o Claude em modo `op` com a flag `--dangerously-load-development-channels server:gondola-chat`.
2. Ter o dashboard aberto em paralelo.
3. Conduzir uma conversa de ~10 turnos substantivos (não apenas "oi"/"tchau").
4. Contar, para cada turno:
   - Resposta do Orq no terminal? (sim/não — deveria ser sempre sim)
   - Eco no dashboard via `reply()`? (sim/não)
5. Registrar a taxa de esquecimento: `esquecidos / (esquecidos + ecoados)`.

## Critério de aceitação

- Taxa de esquecimento ≤ 10% → ok, seguir.
- Taxa > 10% → reforçar disciplina: exemplo concreto em `CLAUDE.orquestrador.md` e/ou nudge periódico via channel notification no boot.

## Histórico

| Data | Turnos | Ecoados | Esquecidos | Taxa | Notas |
|------|--------|---------|------------|------|-------|
|      |        |         |            |      |       |
```

- [ ] **Step 3: Abrir exceção no `.gitignore` pro scaffold do canal**

`.dev/test-outputs/` está no `.gitignore` (linha 11 do arquivo). Precisamos manter `.dev/test-outputs/channel/` versionado como scaffold permanente, mas **não** versionar outputs gerados em cada rodada de teste de outros processos.

Edit `.gitignore`. Substituir:

```
# Outputs de teste
.dev/test-outputs/
```

Por:

```
# Outputs de teste (exceto scaffold permanente do canal)
.dev/test-outputs/
!.dev/test-outputs/channel/
```

Verificar:
```bash
git check-ignore -v .dev/test-outputs/channel/manual-checklist.md
```
Expected: nenhum output (arquivo **não** está ignorado).

```bash
git check-ignore -v .dev/test-outputs/promocao/alguma-coisa.md
```
Expected: regra `.dev/test-outputs/` ainda ignora outros subdiretórios.

- [ ] **Step 4: Commit**

```bash
git add .gitignore .dev/test-outputs/channel/manual-checklist.md .dev/test-outputs/channel/mirror-discipline.md
git commit -m "docs(channel): checklist manual E2E + baseline de disciplina do mirror"
```

---

## Task 10: Cleanup do POC

**Files:**
- Delete: `.mission-control/channel-poc/` (diretório inteiro — atualmente **untracked**)
- Delete: `.mcp.json` na raiz (versão POC — também **untracked**; será regerado pelo `modo.sh`)
- Update: `/Users/leonardocmoreira/.claude/projects/-Users-leonardocmoreira-Documents-projetos-gondola-ai/memory/project_mc_channel_poc.md` (marcar encerramento — fora do repo, não entra em git)

- [ ] **Step 1: Confirmar que o canal novo funciona antes de deletar o POC**

Executar todos os itens do `.dev/test-outputs/channel/manual-checklist.md` (Task 9). Só prosseguir se tudo passar.

- [ ] **Step 2: Verificar que POC e `.mcp.json` seguem untracked**

Run:
```bash
git status --short .mission-control/channel-poc .mcp.json
```
Expected: ambos aparecem com `??` (untracked) — `.mcp.json` agora deve estar untracked por causa do `/.mcp.json` no `.gitignore` (Task 1), e `channel-poc` nunca foi committado.

- [ ] **Step 3: Remover POC do filesystem e regenerar `.mcp.json` novo**

Run:
```bash
rm -rf .mission-control/channel-poc
rm -f .mcp.json
./.dev/modo.sh op
grep gondola-chat .mcp.json && grep channel/server.mjs .mcp.json
```
Expected: os dois greps casam — confirma que o `.mcp.json` novo aponta pra `.mission-control/channel/server.mjs`, não pro POC.

Run:
```bash
git status --short .mission-control/channel-poc .mcp.json
```
Expected: `channel-poc` sumiu (não aparece); `.mcp.json` segue untracked (gerado pelo modo.sh, ignorado pelo git).

**Nenhum commit necessário nesta task** — os arquivos envolvidos nunca estiveram sob versionamento.

- [ ] **Step 4: Atualizar a memória do POC (fora do repo)**

Edit `/Users/leonardocmoreira/.claude/projects/-Users-leonardocmoreira-Documents-projetos-gondola-ai/memory/project_mc_channel_poc.md`. Atualizar o `description` no frontmatter para:

```yaml
description: POC encerrado em 2026-04-10; canal real entregue — ver docs/superpowers/specs/2026-04-10-channel-mc-orquestrador-design.md
```

Adicionar, logo após o frontmatter (antes do primeiro parágrafo de conteúdo), um bloco:

```markdown
## Encerramento (2026-04-10)

POC concluído. Canal real implementado em `.mission-control/channel/` e integrado ao MC server + dashboard. POC removido do repo. Artefatos:
- Spec: `docs/superpowers/specs/2026-04-10-channel-mc-orquestrador-design.md`
- Plano: `docs/superpowers/plans/2026-04-10-channel-mc-orquestrador.md`
```

Esse arquivo vive na pasta de memória do Claude Code (fora do repo), então **não há commit**. A edição só precisa ser salva.

---

## Self-Review

Antes de entregar, releia o spec (`docs/superpowers/specs/2026-04-10-channel-mc-orquestrador-design.md`) e confirme:

1. **Cobertura:** cada decisão da tabela da Seção 2 do spec tem uma task que a implementa?
   - Modelo híbrido ✓ Task 3 (bridge) + Task 6/7 (dashboard)
   - Sessão única ✓ implícito — sem código de multi-sessão
   - Histórico persistente no SQLite ✓ Task 4 (`/chat/history` + reuso de `events`)
   - Histórico em cinza ✓ Task 6 (CSS `historical` + flag no estado)
   - `.mcp.json` só em modo op ✓ Task 5
   - Orq ecoa todas as respostas ✓ Task 8 (regra no markdown)
   - Subprocess bridge + WS client ✓ Task 3
2. **Fluxos 5.1–5.5 do spec:** todos cobertos pelos testes ou pelo checklist manual? Sim.
3. **Escopo negativo (Seção 7 do spec):** nada da lista foi acidentalmente implementado? Confirmar.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-10-channel-mc-orquestrador.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
