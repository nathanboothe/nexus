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
      // Exposed so the UI can warn when bass EQ won't have any effect —
      // Pure Direct / Direct listening modes bypass tone control by design.
      soundMode: attrs.sound_mode ?? null,
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

// ── BASS (Tone Control) ──
// Denon's raw network protocol command for bass is PSBAS<nn>, a zero-padded
// 2-digit value from 44 (-6dB) to 56 (+6dB), with 50 = 0dB/flat, 1dB steps.
// Confirmed against Denon's own published AVR control protocol docs.
// Tone Control has to be explicitly turned on (PSTONE CTRL ON) or PSBAS is
// silently ignored — sent unconditionally here since it's idempotent and
// costs one extra harmless call if it's already on. It's also a no-op if the
// receiver is in Pure Direct / Direct listening mode (those modes bypass EQ
// by design) — see soundMode in GET /status to detect that case in the UI.
// There's no reliable read-back for this over denonavr.get_command, so
// — same caveat as the Broadlink IR commands — this is fire-and-forget from
// the backend's perspective; the frontend just has to trust what it last sent.
// body: { db: -6 to 6 }
router.post('/bass', async (req, res) => {
  try {
    const { db } = req.body;
    const level = Math.max(-6, Math.min(6, Math.round(Number(db))));
    const raw = String(50 + level).padStart(2, '0');

    await callService('denonavr', 'get_command', {
      entity_id: ENTITY,
      command: '/goform/formiPhoneAppDirect.xml?PSTONE CTRL ON',
    });
    await callService('denonavr', 'get_command', {
      entity_id: ENTITY,
      command: `/goform/formiPhoneAppDirect.xml?PSBAS${raw}`,
    });

    res.json({ ok: true, db: level });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
