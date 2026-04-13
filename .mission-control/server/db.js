const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { discoverProcesses } = require('./discovery');

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
  const state = {
    processes: discoverProcesses(),
    hooks: [],
    session_id: null,
    event_count: events.length,
    activityLog: {},
  };

  // Primeira passada: encontrar o timestamp do process_start mais recente por processo.
  // Eventos de progress anteriores a esse marco são descartados — garante que uma nova
  // execução zere o estado visual do processo no Mission Control.
  const latestStartByProcess = {};
  for (const evt of events) {
    if (evt.type === 'process_start' && evt.process) {
      if (!latestStartByProcess[evt.process] || evt.timestamp > latestStartByProcess[evt.process]) {
        latestStartByProcess[evt.process] = evt.timestamp;
      }
    }
  }

  for (const evt of events) {
    if (evt.session_id) state.session_id = evt.session_id;

    if (evt.type === 'process_start' && evt.process) {
      if (!state.processes[evt.process]) {
        state.processes[evt.process] = { status: 'active', agents: {} };
      }
      state.processes[evt.process].status = 'active';
      state.processes[evt.process].started_at = evt.timestamp;
      state.processes[evt.process].ended_at = null;
      // Reset activity log on new process run
      state.activityLog[evt.process] = [];
    } else if (evt.type === 'process_end' && evt.process) {
      if (state.processes[evt.process]) {
        state.processes[evt.process].status = 'completed';
        state.processes[evt.process].ended_at = evt.timestamp;
      }
    } else if (evt.type === 'progress' && evt.process) {
      // Descarta eventos de progress anteriores ao último process_start deste processo.
      const latestStart = latestStartByProcess[evt.process];
      if (latestStart && evt.timestamp < latestStart) continue;

      if (!state.processes[evt.process]) {
        state.processes[evt.process] = { status: 'active', agents: {} };
      }
      const proc = state.processes[evt.process];
      if (proc.status === 'idle') proc.status = 'active';
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

        // Accumulate in activity log
        if (evt.payload.message && evt.agent) {
          if (!state.activityLog[evt.process]) state.activityLog[evt.process] = [];
          state.activityLog[evt.process].push({
            agent: evt.agent,
            task: evt.task || '',
            status: evt.payload.status || 'running',
            message: evt.payload.message,
            timestamp: evt.timestamp,
          });
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
