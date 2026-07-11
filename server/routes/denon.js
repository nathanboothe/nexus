import { Router } from 'express';
import http from 'http';
import config from '../config.js';

const router = Router();
const DENON_IP = config.denon.ip;
const DENON_PORT = config.denon.port || 11080;

function denonRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      host: DENON_IP,
      port: DENON_PORT,
      path,
      method: 'GET',
      headers: { Accept: '*/*', Connection: 'keep-alive' },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ ok: res.statusCode < 400, status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.setTimeout(2000, () => { req.destroy(); reject(new Error('Denon request timed out')); });
    req.end();
  });
}

function setConfig(type, xml) {
  const encoded = encodeURIComponent(xml);
  const ts = Date.now();
  return denonRequest(`/ajax/globals/set_config?type=${type}&data=${encoded}&_=${ts}`);
}

function getConfig(types) {
  return denonRequest(`/ajax/globals/get_config?type=${types}&_=${Date.now()}`);
}

function parseTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return m ? m[1] : null;
}

// ── STATUS ── power(1), input(4), sound mode(6), mute(11), volume(12)
router.get('/status', async (_req, res) => {
  if (!config.denon.enabled) return res.status(503).json({ error: 'Denon disabled in config' });
  try {
    const result = await getConfig('1,4,6,11,12');
    const data = result.data;
    const volumeRaw = parseTag(data, 'Volume');
    res.json({
      power: parseTag(data, 'Power'),
      input: parseTag(data, 'InputFuncSelect'),
      soundMode: parseTag(data, 'SurrMode'),
      mute: parseTag(data, 'Mute'),
      // Denon reports volume on a 0-980 scale; UI uses 0-98
      volume: volumeRaw !== null ? Math.round(Number(volumeRaw) / 10) : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POWER ── body: { on: boolean }
router.post('/power', async (req, res) => {
  try {
    const { on } = req.body;
    await setConfig(1, `<Power>${on ? 'on' : 'standby'}</Power>`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── VOLUME ── body: { level: 0-98 }
router.post('/volume', async (req, res) => {
  try {
    const { level } = req.body;
    const raw = Math.max(0, Math.min(980, Math.round(Number(level) * 10)));
    await setConfig(12, `<Volume>${raw}</Volume>`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── MUTE ── body: { muted: boolean }
router.post('/mute', async (req, res) => {
  try {
    const { muted } = req.body;
    await setConfig(11, `<Mute>${muted ? 'on' : 'off'}</Mute>`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── INPUT ── body: { input: 'CBL/SAT' | 'GAME' | 'MPLAY' | ... }
router.post('/input', async (req, res) => {
  try {
    const { input } = req.body;
    await setConfig(4, `<InputFuncSelect>${input}</InputFuncSelect>`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
