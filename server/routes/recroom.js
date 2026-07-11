import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import config from '../config.js';
import { callService } from './homeassistant.js';

const execAsync = promisify(exec);
const router = Router();

const ADB = config.googleTv.adbPath;
const GOOGLE_TV_HOST = config.googleTv.adbHost;
const BROADLINK_ENTITY = config.broadlink.haEntity; // remote.base_station
const GOOGLE_TV_HA_ENTITY = config.googleTv.haEntity; // remote.rec_room_google_tv

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
      entity_id: GOOGLE_TV_HA_ENTITY,
      command,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GOOGLE TV APP LAUNCH (direct ADB) ───────────────────────────────────────
// body: { activity: 'com.netflix.ninja/.MainActivity' }
router.post('/googletv/launch', async (req, res) => {
  try {
    const { activity } = req.body;
    await execAsync(`"${ADB}" -s ${GOOGLE_TV_HOST} shell am start -n ${activity}`);
    res.json({ ok: true, activity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
