// routes/recroom.js
import { Router } from 'express';
import { xboxPowerOn, xboxPowerOff, xboxStatus } from '../adapters/xbox.js';
import { ps5WakeUp, ps5Status } from '../adapters/ps5.js';
import fetch from 'node-fetch';
import config from '../config.js';

const router = Router();

const HA_BASE    = config.homeAssistant.baseUrl;
const HA_HEADERS = {
  'Authorization': `Bearer ${config.homeAssistant.token}`,
  'Content-Type': 'application/json',
};

async function haService(domain, service, data) {
  const res = await fetch(`${HA_BASE}/api/services/${domain}/${service}`, {
    method: 'POST',
    headers: HA_HEADERS,
    body: JSON.stringify(data),
  });
  return res.ok;
}

async function haState(entityId) {
  const res = await fetch(`${HA_BASE}/api/states/${entityId}`, { headers: HA_HEADERS });
  return res.json();
}

// ── SAMSUNG TV (Broadlink IR) ─────────────────────────────────────────
router.post('/samsung/ir', async (req, res) => {
  try {
    const { command } = req.body;
    await haService('remote', 'send_command', {
      entity_id: 'remote.base_station',
      command,
    });
    res.json({ ok: true, command });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DENON AVR (direct HTTP) ───────────────────────────────────────────
router.post('/denon/command', async (req, res) => {
  try {
    const { command } = req.body;
    const denonRes = await fetch(
      `http://${config.denon.ip}:${config.denon.port}/goform/formiPhoneAppDirect.xml?${command}`,
      { signal: AbortSignal.timeout(3000) }
    );
    res.json({ ok: denonRes.ok, command });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/denon/status', async (_req, res) => {
  try {
    const denonRes = await fetch(
      `http://${config.denon.ip}:${config.denon.port}/goform/formMainZone_MainZoneXmlStatus.xml`,
      { signal: AbortSignal.timeout(3000) }
    );
    const text = await denonRes.text();
    res.type('xml').send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GOOGLE TV (Android TV Remote via HA) ─────────────────────────────
router.post('/googletv/remote', async (req, res) => {
  try {
    const { command } = req.body;
    await haService('remote', 'send_command', {
      entity_id: 'remote.rec_room_google_tv',
      command,
    });
    res.json({ ok: true, command });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/googletv/media', async (req, res) => {
  try {
    const { service, data } = req.body;
    await haService('media_player', service, {
      entity_id: 'media_player.rec_room_google_tv_3',
      ...data,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/googletv/nowplaying', async (_req, res) => {
  try {
    const state = await haState('media_player.rec_room_google_tv_3');
    res.json({
      state:     state.state,
      app:       state.attributes?.app_name || state.attributes?.app_id || null,
      title:     state.attributes?.media_title || null,
      artist:    state.attributes?.media_artist || null,
      thumbnail: state.attributes?.entity_picture || null,
      volume:    state.attributes?.volume_level || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── XBOX ──────────────────────────────────────────────────────────────
router.get('/xbox/status', async (_req, res) => {
  const status = await xboxStatus();
  res.json(status);
});

router.post('/xbox/power', async (req, res) => {
  const { on } = req.body;
  const result = on ? await xboxPowerOn() : await xboxPowerOff();
  res.json(result);
});

// ── PS5 ───────────────────────────────────────────────────────────────
router.get('/ps5/status', async (_req, res) => {
  const status = await ps5Status();
  res.json(status);
});

router.post('/ps5/wakeup', async (_req, res) => {
  const result = await ps5WakeUp();
  res.json(result);
});

// PS5 power off via HA (if PS5 integration exists in HA)
router.post('/ps5/poweroff', async (_req, res) => {
  try {
    await haService('media_player', 'turn_off', { entity_id: 'media_player.ps5' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── SWITCH (Broadlink IR) ─────────────────────────────────────────────
router.post('/switch/ir', async (req, res) => {
  try {
    const { command } = req.body;
    await haService('remote', 'send_command', {
      entity_id: 'remote.base_station',
      command,
    });
    res.json({ ok: true, command });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
