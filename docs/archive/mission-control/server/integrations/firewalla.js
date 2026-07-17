// ════════════════════════════════════════════════════════════════
// integrations/firewalla.js
//
// Talks to the Firewalla MSP cloud API.
//
// THE PATTERN (important — every integration file looks like this):
//   - We read config from environment variables (never hardcode secrets).
//   - We expose a few functions with NORMALIZED names: getStatus,
//     getDevices, etc. Other integrations expose the SAME names.
//   - The rest of the app calls those names and doesn't care that
//     behind the scenes this one happens to be a cloud REST API.
// ════════════════════════════════════════════════════════════════

import axios from "axios";

// Pull the two values out of the environment (loaded from .env).
const DOMAIN = process.env.FIREWALLA_MSP_DOMAIN;
const TOKEN = process.env.FIREWALLA_MSP_TOKEN;

// Helper: are we actually configured, or still on placeholders?
// This lets the dashboard run TODAY even though you don't have a
// Firewalla account yet — it just reports "not configured" instead
// of crashing.
function isConfigured() {
  return (
    DOMAIN &&
    TOKEN &&
    !DOMAIN.startsWith("REPLACE_ME") &&
    !TOKEN.startsWith("REPLACE_ME")
  );
}

// Build a pre-configured axios client ONCE, only if configured.
// `client` is null when we're still on placeholders.
const client = isConfigured()
  ? axios.create({
      baseURL: `https://${DOMAIN}/v2`, // MSP API base path
      headers: {
        // MSP uses a bearer token in the Authorization header.
        Authorization: `Token ${TOKEN}`,
      },
      timeout: 8000, // give up after 8s instead of hanging forever
    })
  : null;

// ── getStatus ───────────────────────────────────────────────────
// Returns a small normalized object describing whether this
// integration is alive. Every module exposes getStatus().
export async function getStatus() {
  if (!isConfigured()) {
    return { ok: false, configured: false, message: "Firewalla not set up yet" };
  }
  try {
    // The MSP "boxes" endpoint lists your Firewalla devices; a
    // successful call means our token + domain work.
    await client.get("/boxes");
    return { ok: true, configured: true, message: "Connected" };
  } catch (err) {
    // Normalize the error into a plain, predictable shape.
    return { ok: false, configured: true, message: describeError(err) };
  }
}

// ── getDevices ──────────────────────────────────────────────────
// Returns the list of devices Firewalla sees on your network.
export async function getDevices() {
  if (!isConfigured()) return [];
  try {
    const res = await client.get("/devices");
    // We return res.data directly for now; later we can map it into
    // a tidier shape for the UI.
    return res.data;
  } catch (err) {
    // Re-throw a clean Error so the route can turn it into a 500.
    throw new Error(describeError(err));
  }
}

// ── getAlarms ───────────────────────────────────────────────────
// Recent security alarms (intrusions, blocked connections, etc.).
export async function getAlarms() {
  if (!isConfigured()) return [];
  try {
    const res = await client.get("/alarms");
    return res.data;
  } catch (err) {
    throw new Error(describeError(err));
  }
}

// Small helper to turn an axios error into a readable string.
function describeError(err) {
  if (err.response) {
    // Server answered with an error status (401, 404, 500...).
    return `Firewalla API error ${err.response.status}`;
  }
  if (err.code === "ECONNABORTED") return "Firewalla request timed out";
  return "Could not reach Firewalla";
}
