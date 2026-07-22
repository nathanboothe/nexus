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

export default router;
