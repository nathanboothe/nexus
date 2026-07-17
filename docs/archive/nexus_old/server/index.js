import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import config from './config.js';
import goveeRouter from './routes/govee.js';
import calendarSyncRouter from './routes/calendarSync.js';

import haRouter from './routes/homeassistant.js';
import airtableRouter from './routes/airtable.js';
import denonRouter from './routes/denon.js';
import genealogyRouter from './routes/genealogy.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

// ── WebSocket server ──────────────────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
  ws.send(JSON.stringify({ type: 'connected', message: 'Nexus WebSocket ready' }));
});

export function broadcast(payload) {
  const msg = JSON.stringify(payload);
  for (const client of clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

// ── Middleware ────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── API Routes ────────────────────────────────────────────────────────
app.use('/api/ha',         haRouter);
app.use('/api/airtable',   airtableRouter);
app.use('/api/denon',      denonRouter);
app.use('/api/genealogy',  genealogyRouter);
app.use('/api/govee', goveeRouter);
app.use('/api/calendar-sync', calendarSyncRouter);

// ── Health check ──────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    name: 'Nexus',
    version: '1.0.0',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// ── Serve React build ─────────────────────────────────────────────────
const clientBuild = join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuild));
app.get('*', (_req, res) => {
  res.sendFile(join(clientBuild, 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────────
httpServer.listen(config.port, '0.0.0.0', () => {
  console.log(`Nexus running on port ${config.port}`);
});
