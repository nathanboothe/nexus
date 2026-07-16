import { Router } from 'express';
import fetch from 'node-fetch';
import config from '../config.js';

const router = Router();
const { ip, port } = config.denon;
const BASE = `http://${ip}:${port}`;

// GET receiver status
router.get('/status', async (_req, res) => {
  if (!config.denon.enabled) return res.status(503).json({ error: 'Denon disabled' });
  try {
    const response = await fetch(`${BASE}/goform/formMainZone_MainZoneXmlStatus.xml`);
    const text = await response.text();
    res.type('xml').send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST send command — body: { command }
// Commands: PWON, PWSTANDBY, MV50, SIBD, SIAUX, etc.
router.post('/command', async (req, res) => {
  if (!config.denon.enabled) return res.status(503).json({ error: 'Denon disabled' });
  try {
    const { command } = req.body;
    const response = await fetch(`${BASE}/goform/formiPhoneAppDirect.xml?${command}`);
    res.json({ ok: response.ok, command });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
