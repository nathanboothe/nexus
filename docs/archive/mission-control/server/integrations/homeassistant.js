// ════════════════════════════════════════════════════════════════
// integrations/homeassistant.js
//
// Talks to your Home Assistant instance on the LAN using its REST API.
// HA also gives you your Deco mesh info (since Deco is integrated
// THROUGH Home Assistant), so this one module covers both.
//
// Same pattern: env config + normalized functions.
// ════════════════════════════════════════════════════════════════

import axios from "axios";

const URL = process.env.HOMEASSISTANT_URL;
const TOKEN = process.env.HOMEASSISTANT_TOKEN;

function isConfigured() {
  return URL && TOKEN && !TOKEN.startsWith("REPLACE_ME");
}

const client = isConfigured()
  ? axios.create({
      baseURL: `${URL}/api`,
      headers: { Authorization: `Bearer ${TOKEN}` },
      timeout: 8000,
    })
  : null;

// ── getStatus ───────────────────────────────────────────────────
export async function getStatus() {
  if (!isConfigured()) {
    return { ok: false, configured: false, message: "Home Assistant not set up yet" };
  }
  try {
    // HA's /api/ root returns a small "API running" message.
    await client.get("/");
    return { ok: true, configured: true, message: "Connected" };
  } catch {
    return { ok: false, configured: true, message: "Could not reach Home Assistant" };
  }
}

// ── getStates ───────────────────────────────────────────────────
// Returns the state of every entity HA knows about (lights, sensors,
// switches, your Deco devices, etc.). Later we'll filter this down
// for specific tiles.
export async function getStates() {
  if (!isConfigured()) return [];
  try {
    const res = await client.get("/states");
    return res.data;
  } catch {
    throw new Error("Could not fetch Home Assistant states");
  }
}
