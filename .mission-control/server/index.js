const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
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

    if (!event.event_id || !event.timestamp || !event.source || !event.type) {
      return res.status(400).json({ error: 'Missing required fields: event_id, timestamp, source, type' });
    }

    insertEvent(event);

    // Broadcast to all WebSocket clients
    const message = JSON.stringify(event);
    wss.clients.forEach(client => {
      if (client.readyState === 1) {
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
