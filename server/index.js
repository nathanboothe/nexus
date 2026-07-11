import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import config from './config.js';
import haRouter from './routes/homeassistant.js';
import denonRouter from './routes/denon.js';
import goveeRouter from './routes/govee.js';
import recroomRouter from './routes/recroom.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());

// ── API Routes (Rec Room + Smart Home only) ─────────────────────────────────
app.use('/api/ha', haRouter);
app.use('/api/denon', denonRouter);
app.use('/api/govee', goveeRouter);
app.use('/api/recroom', recroomRouter);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// ── Serve React build ────────────────────────────────────────────────────────
const distPath = join(__dirname, '..', 'client', 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(join(distPath, 'index.html'));
});

const PORT = config.port || 8080;
app.listen(PORT, () => {
  console.log(`Nexus server listening on port ${PORT}`);
});
