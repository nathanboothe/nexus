import { Router } from 'express';
import config from '../config.js';

const router = Router();
const { url: HA_URL, token: HA_TOKEN } = config.homeAssistant;

async function haCall(path, method = 'GET', body) {
  const res = await fetch(`${HA_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${HA_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HA ${method} ${path} -> ${res.status}: ${text}`);
  }
  const contentType = res.headers.get('content-type') || '';
  return contentType.includes('application/json') ? res.json() : res.text();
}

// Used by recroom.js to call any HA service (remote.send_command, etc.)
export async function callService(domain, service, data) {
  return haCall(`/api/services/${domain}/${service}`, 'POST', data);
}

export async function getState(entityId) {
  return haCall(`/api/states/${entityId}`);
}

// Simple connectivity check
router.get('/ping', async (_req, res) => {
  try {
    await haCall('/api/');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/state/:entityId', async (req, res) => {
  try {
    const state = await getState(req.params.entityId);
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ALL STATES ── returns every entity in HA — client groups by domain
router.get('/states', async (_req, res) => {
  try {
    const states = await haCall('/api/states');
    res.json(states);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GENERIC SERVICE CALL ── body: { domain, service, data }
// Lets the client control any entity type (lights, switches, locks, climate,
// covers, etc.) without a bespoke route for each one.
router.post('/service', async (req, res) => {
  try {
    const { domain, service, data } = req.body;
    await callService(domain, service, data);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
