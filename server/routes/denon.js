import { Router } from 'express';
import config from '../config.js';
import { callService, getState } from './homeassistant.js';

const router = Router();
const ENTITY = config.entities.denon; // media_player.home_theater_2

// ── STATUS ── read straight from HA's state for this entity
router.get('/status', async (_req, res) => {
  try {
    const state = await getState(ENTITY);
    const attrs = state.attributes || {};
    res.json({
      power: state.state, // 'on' | 'off' | 'standby' | 'unavailable'
      input: attrs.source ?? null,
      volume: attrs.volume_level != null ? Math.round(attrs.volume_level * 98) : null,
      mute: attrs.is_volume_muted ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POWER ── body: { on: boolean }
router.post('/power', async (req, res) => {
  try {
    const { on } = req.body;
    await callService('media_player', on ? 'turn_on' : 'turn_off', { entity_id: ENTITY });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── VOLUME ── body: { level: 0-98 } — HA wants a 0.0-1.0 float
router.post('/volume', async (req, res) => {
  try {
    const { level } = req.body;
    const volumeLevel = Math.max(0, Math.min(1, Number(level) / 98));
    await callService('media_player', 'volume_set', { entity_id: ENTITY, volume_level: volumeLevel });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── MUTE ── body: { muted: boolean }
router.post('/mute', async (req, res) => {
  try {
    const { muted } = req.body;
    await callService('media_player', 'volume_mute', { entity_id: ENTITY, is_volume_muted: !!muted });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── INPUT ── body: { input: 'CBL/SAT' | 'GAME' | 'MPLAY' | ... } (must match HA's source names)
router.post('/input', async (req, res) => {
  try {
    const { input } = req.body;
    await callService('media_player', 'select_source', { entity_id: ENTITY, source: input });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
