// routes/calendarSync.js
import { Router } from 'express';
import config from '../config.js';
import {
  getOutlookEvents, createOutlookEvent,
  startDeviceCodeFlow, pollDeviceCodeFlow,
  isAuthenticated as outlookAuthed,
} from '../adapters/outlookCalendar.js';
import {
  getGoogleEvents, createGoogleEvent,
  getAuthUrl, exchangeCode,
  isAuthenticated as googleAuthed,
  initGoogle,
} from '../adapters/googleCalendar.js';

const router = Router();

// Init Google with credentials from config
initGoogle(
  config.google.clientId,
  config.google.clientSecret,
  config.google.redirectUri,
);

// ── AUTH STATUS ──────────────────────────────────────────────────────
router.get('/auth/status', (_req, res) => {
  res.json({
    outlook: outlookAuthed(),
    google:  googleAuthed(),
  });
});

// ── OUTLOOK AUTH (device code flow) ──────────────────────────────────
router.post('/auth/outlook/start', async (_req, res) => {
  try {
    const data = await startDeviceCodeFlow();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/auth/outlook/poll', async (req, res) => {
  try {
    const { deviceCode } = req.body;
    const result = await pollDeviceCodeFlow(deviceCode);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GOOGLE AUTH (OAuth redirect) ──────────────────────────────────────
router.get('/auth/google/url', (_req, res) => {
  const url = getAuthUrl('nexus-calendar');
  res.json({ url });
});

router.get('/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const result = await exchangeCode(code);
    if (result.ok) {
      res.send(`<html><body><p>Google Calendar connected! You can close this tab.</p><script>window.close();</script></body></html>`);
    } else {
      res.status(400).send(`<html><body><p>Error: ${result.error}</p></body></html>`);
    }
  } catch (err) {
    res.status(500).send(`<html><body><p>Error: ${err.message}</p></body></html>`);
  }
});

// ── GET MERGED EVENTS ─────────────────────────────────────────────────
// GET /api/calendar-sync/events?start=ISO&end=ISO
router.get('/events', async (req, res) => {
  const { start, end } = req.query;
  const results = { outlook: [], google: [], errors: {} };

  if (outlookAuthed()) {
    try {
      results.outlook = await getOutlookEvents(start, end);
    } catch (err) {
      results.errors.outlook = err.message;
    }
  }

  if (googleAuthed()) {
    try {
      results.google = await getGoogleEvents(start, end);
    } catch (err) {
      results.errors.google = err.message;
    }
  }

  const merged = [...results.outlook, ...results.google]
    .sort((a, b) => new Date(a.start) - new Date(b.start));

  res.json({ events: merged, errors: results.errors });
});

// ── CREATE EVENT ──────────────────────────────────────────────────────
// POST /api/calendar-sync/events
// body: { title, start, end, allDay, notes, location, target: 'outlook'|'google' }
router.post('/events', async (req, res) => {
  try {
    const { target, ...event } = req.body;
    if (target === 'google') {
      const result = await createGoogleEvent(event);
      res.json(result);
    } else {
      const result = await createOutlookEvent(event);
      res.json(result);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
