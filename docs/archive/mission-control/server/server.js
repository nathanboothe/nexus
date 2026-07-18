// server.js
// Entry point. Wires up the three adapters, exposes a single merged
// /api/devices endpoint, and serves the built React client as static files.

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "./config.js";
import { createHomeAssistantAdapter } from "./adapters/homeAssistant.js";
import { createHttpDevicesAdapter } from "./adapters/httpDevices.js";
import { createMqttAdapter } from "./adapters/mqttDevices.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ha = createHomeAssistantAdapter(config.homeAssistant);
const http = createHttpDevicesAdapter(config.httpDevices);
const mqttAdapter = createMqttAdapter(config.mqtt);

// In-memory snapshot of the latest merged device list. A background loop
// refreshes it so HTTP requests are always answered instantly from cache.
let snapshot = { devices: [], updatedAt: null };

async function refresh() {
  const [haDevices, httpDevicesData, mqttDevices] = await Promise.all([
    ha.poll(),
    http.poll(),
    mqttAdapter.poll(),
  ]);
  snapshot = {
    devices: [...haDevices, ...httpDevicesData, ...mqttDevices],
    updatedAt: new Date().toISOString(),
  };
}

refresh();
setInterval(refresh, config.pollIntervalMs);

const app = express();
app.use(express.json());

app.get("/api/devices", (_req, res) => res.json(snapshot));
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Camera snapshot proxy. The browser requests /api/camera/<entity>; the server
// fetches the JPEG from HA using the long-lived token and streams it back, so
// no token is ever exposed to the client.
app.get("/api/camera/:entity", async (req, res) => {
  const result = await ha.getCameraSnapshot(req.params.entity);
  if (!result.ok) {
    return res.status(502).json({ ok: false, error: result.error });
  }
  res.set("Content-Type", result.contentType);
  res.set("Cache-Control", "no-store"); // always fresh
  res.send(result.buffer);
});

// Allowlist of services the dashboard is permitted to call. This is a
// safety boundary: even though only tailnet devices can reach us, we
// don't expose arbitrary HA service calls — only these known-safe ones.
const ALLOWED_SERVICES = new Set([
  "light.turn_on",
  "light.turn_off",
  "light.toggle",
  "media_player.media_play",
  "media_player.media_pause",
  "media_player.media_play_pause",
  "media_player.volume_set",
  "media_player.turn_on",
  "media_player.turn_off",
  "switch.turn_on",
  "switch.turn_off",
  "switch.toggle",
  "select.select_option",
  // Activity macros: trigger HA scripts and send Broadlink remote commands.
  "script.turn_on",
  "remote.send_command",
  // Climate / thermostat control.
  "climate.set_temperature",
  "climate.set_hvac_mode",
  "climate.turn_on",
  "climate.turn_off",
]);

app.post("/api/service", async (req, res) => {
  const { domain, service, data } = req.body ?? {};
  if (!domain || !service) {
    return res.status(400).json({ ok: false, error: "Missing domain/service" });
  }
  if (!ALLOWED_SERVICES.has(`${domain}.${service}`)) {
    return res
      .status(403)
      .json({ ok: false, error: `Service ${domain}.${service} not allowed` });
  }
  const result = await ha.callService(domain, service, data);
  // Refresh immediately so the UI reflects the change without waiting
  // for the next poll cycle.
  if (result.ok) refresh();
  res.status(result.ok ? 200 : 502).json(result);
});

// Serve the built client (client/dist) in production.
const clientDist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDist));
app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));

app.listen(config.port, "0.0.0.0", () => {
  console.log(`IoT dashboard listening on http://0.0.0.0:${config.port}`);
});
