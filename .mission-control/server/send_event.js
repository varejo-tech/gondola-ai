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
