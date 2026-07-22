import { Router } from 'express';
import config from '../config.js';

const router = Router();
const GOVEE_API = 'https://developer-api.govee.com/v1';
const API_KEY = config.govee.apiKey;

async function goveeRequest(path, method = 'GET', body) {
  const res = await fetch(`${GOVEE_API}${path}`, {
    method,
    headers: {
      'Govee-API-Key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Govee ${method} ${path} -> ${res.status}: ${text}`);
  }
  return res.json();
}

// ── LIST DEVICES ──
router.get('/devices', async (_req, res) => {
  try {
    const data = await goveeRequest('/devices');
    res.json(data.data?.devices ?? []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET DEVICE STATE ──
router.get('/state', async (req, res) => {
  try {
    const { device, model } = req.query;
    const data = await goveeRequest(
      `/devices/state?device=${encodeURIComponent(device)}&model=${encodeURIComponent(model)}`
    );
    res.json(data.data ?? {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CONTROL ── body: { device, model, cmd: { name: 'turn'|'brightness'|'color', value } }
router.post('/control', async (req, res) => {
  try {
    const { device, model, cmd } = req.body;
    await goveeRequest('/devices/control', 'PUT', { device, model, cmd });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
