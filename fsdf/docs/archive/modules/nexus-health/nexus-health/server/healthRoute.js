// routes/health.js
import { Router } from 'express';
import config from '../config.js';
import {
  initStrava, getAuthUrl, exchangeCode,
  getActivities, getAthlete, mapActivity, isAuthenticated,
} from '../adapters/strava.js';

const router = Router();

initStrava(config.strava.clientId, config.strava.clientSecret);

const REDIRECT_URI = `http://localhost:8080/api/health/strava/callback`;

// ── AUTH STATUS ──────────────────────────────────────────────────────
router.get('/strava/status', (_req, res) => {
  res.json({ connected: isAuthenticated() });
});

// ── STRAVA AUTH ───────────────────────────────────────────────────────
router.get('/strava/connect', (_req, res) => {
  const url = getAuthUrl(REDIRECT_URI);
  res.redirect(url);
});

router.get('/strava/callback', async (req, res) => {
  try {
    const { code, error } = req.query;
    if (error) return res.send(`<html><body><p>Strava error: ${error}</p></body></html>`);
    const result = await exchangeCode(code);
    if (result.ok) {
      res.send(`<html><body><p>Strava connected! Welcome ${result.athlete?.firstname}. You can close this tab.</p><script>window.close();</script></body></html>`);
    } else {
      res.status(400).send(`<html><body><p>Error: ${result.error}</p></body></html>`);
    }
  } catch (err) {
    res.status(500).send(`<html><body><p>Error: ${err.message}</p></body></html>`);
  }
});

// ── GET ACTIVITIES ────────────────────────────────────────────────────
router.get('/strava/activities', async (req, res) => {
  if (!isAuthenticated()) return res.status(401).json({ error: 'NOT_AUTHENTICATED' });
  try {
    const { page = 1, per_page = 30 } = req.query;
    const activities = await getActivities(parseInt(per_page), parseInt(page));
    res.json(activities.map(mapActivity));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET ATHLETE ───────────────────────────────────────────────────────
router.get('/strava/athlete', async (_req, res) => {
  if (!isAuthenticated()) return res.status(401).json({ error: 'NOT_AUTHENTICATED' });
  try {
    const athlete = await getAthlete();
    res.json({
      name:     `${athlete.firstname} ${athlete.lastname}`,
      username: athlete.username,
      city:     athlete.city,
      country:  athlete.country,
      profile:  athlete.profile_medium,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
