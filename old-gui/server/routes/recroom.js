import { Router } from 'express';
import config from '../config.js';
import { callService } from './homeassistant.js';

const router = Router();

const BROADLINK_ENTITY = config.entities.broadlink;          // remote.base_station
const GOOGLE_TV_REMOTE_ENTITY = config.entities.googleTvRemote;       // remote.rec_room_google_tv
const GOOGLE_TV_MEDIA_ENTITY = config.entities.googleTvMediaPlayer;   // media_player.rec_room_google_tv_3

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
// Now routed through HA's androidtv.adb_command service instead of a direct
// ADB call from this server — the cloud server has no network path to the
// device, but HA (local, reachable via Nabu Casa) does.
// body: { activity: 'com.netflix.ninja/.MainActivity' }
router.post('/googletv/launch', async (req, res) => {
  try {
    const { activity } = req.body;
    await callService('androidtv', 'adb_command', {
      entity_id: GOOGLE_TV_MEDIA_ENTITY,
      command: `am start -n ${activity}`,
    });
    res.json({ ok: true, activity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
