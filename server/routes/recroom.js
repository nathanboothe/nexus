import { Router } from 'express';
import config from '../config.js';
import { callService } from './homeassistant.js';

const router = Router();

const BROADLINK_ENTITY = config.entities.broadlink;             // remote.base_station
const GOOGLE_TV_REMOTE_ENTITY = config.entities.googleTvRemote;  // remote.rec_room_google_tv

// ── SAMSUNG TV (Broadlink IR via HA) ────────────────────────────────────────
// body: { command: 'power' | 'volume_up' | 'volume_down' | 'channel_up' | 'channel_down' | 'mute' }
router.post('/samsung/command', async (req, res) => {
  try {
    const { command } = req.body;
    await callService('remote', 'send_command', {
      entity_id: BROADLINK_ENTITY,
      device: 'TV',
      command,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GOOGLE TV NAVIGATION (HA Android TV integration) ────────────────────────
// Confirmed: ADB keyevents do NOT work on this device for D-pad/nav — only HA's
// Android TV integration works. body: { command: 'DPAD_UP' | 'DPAD_CENTER' | 'BACK' | 'HOME' | ... }
router.post('/googletv/nav', async (req, res) => {
  try {
    const { command } = req.body;
    await callService('remote', 'send_command', {
      entity_id: GOOGLE_TV_REMOTE_ENTITY,
      command,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GOOGLE TV APP LAUNCH ─────────────────────────────────────────────────────
// This device uses HA's official "Android TV Remote" integration, not the
// older ADB-based one — there's no adb_command service. Instead, remote.turn_on
// accepts an `activity` field targeting the remote entity (same one nav uses),
// and it takes the same package/activity format already used for these apps.
// body: { activity: 'com.netflix.ninja/.MainActivity' }
router.post('/googletv/launch', async (req, res) => {
  try {
    const { activity } = req.body;
    await callService('remote', 'turn_on', {
      entity_id: GOOGLE_TV_REMOTE_ENTITY,
      activity,
    });
    res.json({ ok: true, activity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;