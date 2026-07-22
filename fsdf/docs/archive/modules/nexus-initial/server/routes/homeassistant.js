import { Router } from 'express';
import fetch from 'node-fetch';
import config from '../config.js';

const router = Router();
const { baseUrl, token } = config.homeAssistant;
const HEADERS = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
};

// GET all configured entity states
router.get('/states', async (_req, res) => {
  if (!config.homeAssistant.enabled) return res.json([]);
  try {
    const results = await Promise.allSettled(
      config.homeAssistant.entities.map(id =>
        fetch(`${baseUrl}/api/states/${id}`, { headers: HEADERS }).then(r => r.json())
      )
    );
    const states = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);
    res.json(states);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single entity state
router.get('/states/:entityId', async (req, res) => {
  if (!config.homeAssistant.enabled) return res.status(503).json({ error: 'HA disabled' });
  try {
    const response = await fetch(`${baseUrl}/api/states/${req.params.entityId}`, { headers: HEADERS });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST call a service — body: { domain, service, data }
router.post('/service', async (req, res) => {
  if (!config.homeAssistant.enabled) return res.status(503).json({ error: 'HA disabled' });
  try {
    const { domain, service, data = {} } = req.body;
    const response = await fetch(`${baseUrl}/api/services/${domain}/${service}`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(data),
    });
    const result = await response.json();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST fire a script — body: { scriptId }
router.post('/script', async (req, res) => {
  if (!config.homeAssistant.enabled) return res.status(503).json({ error: 'HA disabled' });
  try {
    const { scriptId } = req.body;
    const response = await fetch(`${baseUrl}/api/services/script/turn_on`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ entity_id: scriptId }),
    });
    const result = await response.json();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
