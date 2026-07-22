// ════════════════════════════════════════════════════════════════
// routes/api.js
//
// This maps URLs to integration functions. When the React frontend
// asks for  GET /api/firewalla/devices , this file decides what runs.
//
// We import each integration with a namespace (e.g. `firewalla`) so
// we can call firewalla.getDevices(), bitwarden.getHealth(), etc.
// ════════════════════════════════════════════════════════════════

import express from "express";
import * as firewalla from "../integrations/firewalla.js";
import * as bitwarden from "../integrations/bitwarden.js";
import * as homeassistant from "../integrations/homeassistant.js";
import * as raindrop from "../integrations/raindrop.js";

const router = express.Router();

// Tiny helper so we don't repeat try/catch in every single route.
// You hand it an async function; it runs it and turns any thrown
// error into a clean 500 JSON response.
function handle(fn) {
  return async (req, res) => {
    try {
      const data = await fn();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
}

// ── A single "everything's status" endpoint ─────────────────────
// Super handy for the dashboard: one call tells the UI which
// integrations are healthy. We run all four getStatus() calls at
// once with Promise.all (parallel, so it's fast).
router.get(
  "/status",
  handle(async () => {
    const [fw, bw, ha, rd] = await Promise.all([
      firewalla.getStatus(),
      bitwarden.getStatus(),
      homeassistant.getStatus(),
      raindrop.getStatus(),
    ]);
    return { firewalla: fw, bitwarden: bw, homeassistant: ha, raindrop: rd };
  })
);

// ── Firewalla ────────────────────────────────────────────────────
router.get("/firewalla/devices", handle(firewalla.getDevices));
router.get("/firewalla/alarms", handle(firewalla.getAlarms));

// ── Bitwarden ────────────────────────────────────────────────────
router.get("/bitwarden/health", handle(bitwarden.getHealth));

// ── Home Assistant ───────────────────────────────────────────────
router.get("/homeassistant/states", handle(homeassistant.getStates));

// ── Raindrop ─────────────────────────────────────────────────────
router.get("/raindrop/bookmarks", handle(raindrop.getBookmarks));

export default router;
