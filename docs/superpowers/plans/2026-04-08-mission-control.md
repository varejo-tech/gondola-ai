# Mission Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time observability dashboard that shows the state of framework processes, agents, and tasks via a local web server.

**Architecture:** Express server receives events via HTTP POST, persists to SQLite (append-only), broadcasts via WebSocket. Dashboard is a single-page React app served as static files, connecting via WebSocket for real-time updates and GET `/state` for initial load. `send_event.js` is the fire-and-forget bridge from Claude Code hooks to the server.

**Tech Stack:** Node.js, Express, better-sqlite3, ws (WebSocket), React (via CDN, no build step), uuid.

---

## File Structure

```
.mission-control/
├── server/
│   ├── package.json          ← Dependencies and scripts
│   ├── db.js                 ← SQLite layer (init, insert, query, state aggregation)
│   ├── index.js              ← Express server (REST + WebSocket + static serving)
│   └── send_event.js         ← CLI script for hooks (fire-and-forget POST)
├── dashboard/
│   └── index.html            ← Full SPA (React via CDN, single file)
├── db/                       ← Auto-created by db.js
│   └── events.db
└── start.sh                  ← Bootstrap script (npm install, start server, open browser)
```

---

### Task 1: package.json and Dependencies

**Files:**
- Create: `.mission-control/server/package.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "mission-control-server",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "express": "^4.21.0",
    "uuid": "^10.0.0",
    "ws": "^8.18.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `cd .mission-control/server && npm install`
Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Commit**

```bash
git add .mission-control/server/package.json .mission-control/server/package-lock.json
git commit -m "feat(mission-control): add server dependencies"
```

---

### Task 2: SQLite Database Layer (db.js)

**Files:**
- Create: `.mission-control/server/db.js`

- [ ] **Step 1: Write db.js**

This module:
1. Creates `../db/` directory if not exists.
2. Opens (or creates) `../db/events.db`.
3. Creates the `events` table if not exists with columns: `event_id TEXT PRIMARY KEY, timestamp TEXT, session_id TEXT, source TEXT, type TEXT, process TEXT, agent TEXT, task TEXT, payload TEXT`.
4. Exports functions:
   - `insertEvent(event)` — inserts a validated event row. `payload` stored as JSON string.
   - `getAllEvents()` — returns all events ordered by timestamp ASC.
   - `getState()` — aggregates all events into current state object: `{ processes: { [name]: { status, agents: { [name]: { status, tasks: { [name]: { status, step, total_steps, message, timestamp } } } } } }, session_id, event_count }`. Logic: iterate all events, build nested map. For `progress` events, update agent/task state. For `process_start`/`process_end`, update process status. For `tool_start`/`tool_end`, track in a separate `hooks` array.
   - `getDb()` — returns raw db instance for testing.

```javascript
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '..', 'db');
const DB_PATH = path.join(DB_DIR, 'events.db');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    event_id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    session_id TEXT,
    source TEXT NOT NULL,
    type TEXT NOT NULL,
    process TEXT,
    agent TEXT,
    task TEXT,
    payload TEXT
  )
`);

const insertStmt = db.prepare(`
  INSERT INTO events (event_id, timestamp, session_id, source, type, process, agent, task, payload)
  VALUES (@event_id, @timestamp, @session_id, @source, @type, @process, @agent, @task, @payload)
`);

function insertEvent(event) {
  insertStmt.run({
    event_id: event.event_id,
    timestamp: event.timestamp,
    session_id: event.session_id || null,
    source: event.source,
    type: event.type,
    process: event.process || null,
    agent: event.agent || null,
    task: event.task || null,
    payload: JSON.stringify(event.payload || {})
  });
}

function getAllEvents() {
  return db.prepare('SELECT * FROM events ORDER BY timestamp ASC').all().map(row => ({
    ...row,
    payload: JSON.parse(row.payload || '{}')
  }));
}

function getState() {
  const events = getAllEvents();
  const state = { processes: {}, hooks: [], session_id: null, event_count: events.length };

  for (const evt of events) {
    if (evt.session_id) state.session_id = evt.session_id;

    if (evt.type === 'process_start' && evt.process) {
      if (!state.processes[evt.process]) {
        state.processes[evt.process] = { status: 'active', agents: {} };
      }
      state.processes[evt.process].status = 'active';
    } else if (evt.type === 'process_end' && evt.process) {
      if (state.processes[evt.process]) {
        state.processes[evt.process].status = 'completed';
      }
    } else if (evt.type === 'progress' && evt.process) {
      if (!state.processes[evt.process]) {
        state.processes[evt.process] = { status: 'active', agents: {} };
      }
      const proc = state.processes[evt.process];
      if (evt.agent) {
        if (!proc.agents[evt.agent]) {
          proc.agents[evt.agent] = { status: 'running', tasks: {} };
        }
        const agent = proc.agents[evt.agent];
        agent.status = evt.payload.status || agent.status;

        if (evt.task) {
          agent.tasks[evt.task] = {
            status: evt.payload.status || 'running',
            step: evt.payload.step || 0,
            total_steps: evt.payload.total_steps || 0,
            message: evt.payload.message || '',
            timestamp: evt.timestamp
          };
        }
      }
    } else if (evt.type === 'tool_start' || evt.type === 'tool_end' || evt.type === 'tool_error') {
      state.hooks.push({
        type: evt.type,
        tool: evt.payload.tool,
        input_preview: evt.payload.input_preview,
        timestamp: evt.timestamp
      });
    }
  }

  return state;
}

function getDb() {
  return db;
}

module.exports = { insertEvent, getAllEvents, getState, getDb };
```

- [ ] **Step 2: Verify module loads without error**

Run: `cd .mission-control/server && node -e "const db = require('./db'); console.log('OK', typeof db.insertEvent)"`
Expected: `OK function`

- [ ] **Step 3: Commit**

```bash
git add .mission-control/server/db.js
git commit -m "feat(mission-control): add SQLite database layer"
```

---

### Task 3: Express Server (index.js)

**Files:**
- Create: `.mission-control/server/index.js`

- [ ] **Step 1: Write index.js**

Server responsibilities:
1. `POST /events` — validate required fields (event_id, timestamp, source, type), insert into DB, broadcast via WebSocket.
2. `GET /state` — return aggregated state from `getState()`.
3. WebSocket on same HTTP server — clients connect, receive all new events as they arrive.
4. `GET /dashboard` and static files — serve `../dashboard/` directory.
5. Listen on port 4000 (configurable via `PORT` env var).

```javascript
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { insertEvent, getState } = require('./db');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 4000;

app.use(express.json());

// Serve dashboard
app.use('/dashboard', express.static(path.join(__dirname, '..', 'dashboard')));

// POST /events
app.post('/events', (req, res) => {
  try {
    const event = req.body;

    // Validate required fields
    if (!event.event_id || !event.timestamp || !event.source || !event.type) {
      return res.status(400).json({ error: 'Missing required fields: event_id, timestamp, source, type' });
    }

    // Insert into DB
    insertEvent(event);

    // Broadcast to all WebSocket clients
    const message = JSON.stringify(event);
    wss.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });

    res.status(201).json({ ok: true, event_id: event.event_id });
  } catch (err) {
    console.error('Error processing event:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /state
app.get('/state', (req, res) => {
  try {
    const state = getState();
    res.json(state);
  } catch (err) {
    console.error('Error getting state:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// WebSocket connection
wss.on('connection', (ws) => {
  console.log('Dashboard client connected');
  ws.on('close', () => console.log('Dashboard client disconnected'));
});

server.listen(PORT, () => {
  console.log(`Mission Control server running on http://localhost:${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/dashboard`);
});
```

- [ ] **Step 2: Test server starts**

Run: `cd .mission-control/server && timeout 3 node index.js || true`
Expected: output includes "Mission Control server running on http://localhost:4000"

- [ ] **Step 3: Commit**

```bash
git add .mission-control/server/index.js
git commit -m "feat(mission-control): add Express server with REST and WebSocket"
```

---

### Task 4: send_event.js (Hook Bridge)

**Files:**
- Create: `.mission-control/server/send_event.js`

- [ ] **Step 1: Write send_event.js**

CLI script called by Claude Code hooks. Fire-and-forget — must not block Claude Code.

Usage: `node send_event.js --event-type tool_start`

Reads env vars: `CLAUDE_SESSION_ID`. Reads `--event-type` from args. Sends POST to localhost:4000/events and exits immediately (no await on response in error cases).

```javascript
#!/usr/bin/env node

const http = require('http');
const { v4: uuidv4 } = require('uuid');

const args = process.argv.slice(2);
const eventTypeIdx = args.indexOf('--event-type');
const eventType = eventTypeIdx !== -1 ? args[eventTypeIdx + 1] : 'unknown';

// Read from Claude Code hook environment
const toolName = process.env.CLAUDE_TOOL_NAME || 'unknown';
const toolInput = process.env.CLAUDE_TOOL_INPUT || '';
const sessionId = process.env.CLAUDE_SESSION_ID || 'unknown';

const event = {
  event_id: uuidv4(),
  timestamp: new Date().toISOString(),
  session_id: sessionId,
  source: 'hook',
  type: eventType,
  process: null,
  agent: null,
  task: null,
  payload: {
    tool: toolName,
    input_preview: toolInput.substring(0, 200)
  }
};

const data = JSON.stringify(event);

const req = http.request({
  hostname: 'localhost',
  port: process.env.MISSION_CONTROL_PORT || 4000,
  path: '/events',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
  timeout: 2000
}, () => {});

req.on('error', () => {}); // Fire-and-forget: ignore errors silently
req.write(data);
req.end();
```

- [ ] **Step 2: Make executable**

Run: `chmod +x .mission-control/server/send_event.js`

- [ ] **Step 3: Commit**

```bash
git add .mission-control/server/send_event.js
git commit -m "feat(mission-control): add hook bridge script (send_event.js)"
```

---

### Task 5: Dashboard (index.html)

**Files:**
- Create: `.mission-control/dashboard/index.html`

- [ ] **Step 1: Write the dashboard SPA**

Single HTML file with React via CDN. Dark theme. Three-panel layout:
1. **Sidebar (left):** Process list with status badges and agent/task counters.
2. **Agent panel (top-right):** Cards for selected process's agents with progress bars.
3. **Task panel (bottom-right):** Table of tasks for selected process.
4. **Top bar:** Session ID, active agent count, session duration.

Color tokens: bg `#0f1117`, cards `#1a1d27`, text `#e2e8f0`, green `#22c55e`, yellow `#eab308`, red `#ef4444`.

Status visual effects:
- `started`/`running`: green pulsing badge
- `completed`: solid green badge, 100% bar
- `error`: red badge, red border
- `waiting`: yellow pulsing badge

On load: fetch `/state`, build UI. Connect WebSocket, update incrementally.

*(Full HTML content will be written during implementation — it's ~300 lines of self-contained React+CSS.)*

- [ ] **Step 2: Verify dashboard is served**

Run server, open `http://localhost:4000/dashboard` — should render the dashboard.

- [ ] **Step 3: Commit**

```bash
git add .mission-control/dashboard/index.html
git commit -m "feat(mission-control): add React dashboard SPA"
```

---

### Task 6: start.sh

**Files:**
- Create: `.mission-control/start.sh`

- [ ] **Step 1: Write start.sh**

```bash
#!/bin/bash
# Mission Control — Start Script
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Installing dependencies..."
cd "$DIR/server" && npm install --silent

echo "Starting Mission Control server..."
node index.js &
SERVER_PID=$!

sleep 1

echo "Opening dashboard in browser..."
open "http://localhost:4000/dashboard" 2>/dev/null || xdg-open "http://localhost:4000/dashboard" 2>/dev/null || echo "Open http://localhost:4000/dashboard in your browser"

echo "Mission Control running (PID: $SERVER_PID). Press Ctrl+C to stop."
wait $SERVER_PID
```

- [ ] **Step 2: Make executable**

Run: `chmod +x .mission-control/start.sh`

- [ ] **Step 3: Commit**

```bash
git add .mission-control/start.sh
git commit -m "feat(mission-control): add start script"
```

---

### Task 7: Integration Test (Validation)

- [ ] **Step 1: Start server**

Run: `.mission-control/start.sh`

- [ ] **Step 2: Send test events via curl**

Send process_start, 3 progress events (started/running/completed), and tool_start/tool_end.

- [ ] **Step 3: Verify SQLite persistence**

Run: `cd .mission-control/server && node -e "const db = require('./db'); console.log(JSON.stringify(db.getState(), null, 2))"`

- [ ] **Step 4: Verify dashboard reflects events**

Open browser, confirm visual state matches.

- [ ] **Step 5: Test report-progress.sh integration (Tarefa 5)**

Run the 3 report-progress.sh commands from the instructions. Verify they appear in dashboard and SQLite.
