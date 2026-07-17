import { Router } from 'express';
import config from '../config.js';
import {
  getDevices, getDeviceState, setPower,
  setBrightness, setColor, setColorTemp
} from '../adapters/govee.js';

const router = Router();

// Room + type grouping config
// Add new devices here as you add them to Govee
export const DEVICE_META = {
  // Rec Room
  'Spotlights Right':  { room: 'Rec Room',    type: 'Spotlight',  icon: '💡' },
  'Spotlights Left':   { room: 'Rec Room',    type: 'Spotlight',  icon: '💡' },
  'Fridge 1':          { room: 'Rec Room',    type: 'Bulb',       icon: '💡' },
  'Fridge 2':          { room: 'Rec Room',    type: 'Bulb',       icon: '💡' },
  'Fridge 3':          { room: 'Rec Room',    type: 'Bulb',       icon: '💡' },
  'Fireplace Light':   { room: 'Rec Room',    type: 'Light',      icon: '🔥' },
  'Left Floor Lamp':   { room: 'Rec Room',    type: 'Floor Lamp', icon: '🪔' },
  'Right Floor Lamp':  { room: 'Rec Room',    type: 'Floor Lamp', icon: '🪔' },
  'Back Fan Bulb 1':   { room: 'Rec Room',    type: 'Fan Bulb',   icon: '💡' },
  'Back Fan Bulb 2':   { room: 'Rec Room',    type: 'Fan Bulb',   icon: '💡' },
  'Back Fan Bulb 3':   { room: 'Rec Room',    type: 'Fan Bulb',   icon: '💡' },
  'Back Fan Bulb 4':   { room: 'Rec Room',    type: 'Fan Bulb',   icon: '💡' },
  'Front Fan Bulb 1':  { room: 'Rec Room',    type: 'Fan Bulb',   icon: '💡' },
  'Front Fan Bulb 2':  { room: 'Rec Room',    type: 'Fan Bulb',   icon: '💡' },
  'Front Fan Bulb 3':  { room: 'Rec Room',    type: 'Fan Bulb',   icon: '💡' },
  'Front Fan Bulb 4':  { room: 'Rec Room',    type: 'Fan Bulb',   icon: '💡' },
  // Lucas's Room
  'Lucas Light':       { room: "Lucas's Room", type: 'Light',     icon: '💡' },
  // Utility
  'Dog Closet':        { room: 'Utility',     type: 'Light',      icon: '💡' },
  // Desk
  'PC Smart Plug':     { room: 'Desk',        type: 'Smart Plug', icon: '🔌' },
  // Outdoor (default — spotlights may be indoor/outdoor)
};

function getMeta(deviceName) {
  return DEVICE_META[deviceName] || { room: 'Other', type: 'Device', icon: '💡' };
}

// GET /api/govee/devices — list all with metadata
router.get('/devices', async (_req, res) => {
  if (!config.govee.enabled) return res.status(503).json({ error: 'Govee disabled' });
  try {
    const devices = await getDevices();
    const enriched = devices.map(d => ({
      ...d,
      meta: getMeta(d.deviceName),
    }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/govee/state?device=XX&model=YY
router.get('/state', async (req, res) => {
  if (!config.govee.enabled) return res.status(503).json({ error: 'Govee disabled' });
  try {
    const { device, model } = req.query;
    const state = await getDeviceState(device, model);
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/govee/power — { device, model, on: true/false }
router.post('/power', async (req, res) => {
  if (!config.govee.enabled) return res.status(503).json({ error: 'Govee disabled' });
  try {
    const { device, model, on } = req.body;
    const result = await setPower(device, model, on);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/govee/brightness — { device, model, brightness: 1-100 }
router.post('/brightness', async (req, res) => {
  if (!config.govee.enabled) return res.status(503).json({ error: 'Govee disabled' });
  try {
    const { device, model, brightness } = req.body;
    const result = await setBrightness(device, model, brightness);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/govee/color — { device, model, r, g, b }
router.post('/color', async (req, res) => {
  if (!config.govee.enabled) return res.status(503).json({ error: 'Govee disabled' });
  try {
    const { device, model, r, g, b } = req.body;
    const result = await setColor(device, model, r, g, b);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/govee/colortemp — { device, model, kelvin }
router.post('/colortemp', async (req, res) => {
  if (!config.govee.enabled) return res.status(503).json({ error: 'Govee disabled' });
  try {
    const { device, model, kelvin } = req.body;
    const result = await setColorTemp(device, model, kelvin);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/govee/room — turn all devices in a room on/off
// { room, on: true/false }
router.post('/room', async (req, res) => {
  if (!config.govee.enabled) return res.status(503).json({ error: 'Govee disabled' });
  try {
    const { room, on } = req.body;
    const devices = await getDevices();
    const roomDevices = devices.filter(d => getMeta(d.deviceName).room === room);
    const results = await Promise.allSettled(
      roomDevices.map(d => setPower(d.device, d.model, on))
    );
    res.json({ room, on, count: roomDevices.length, results: results.map(r => r.status) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
