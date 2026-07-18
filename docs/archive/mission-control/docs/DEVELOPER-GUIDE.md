# Home IoT Dashboard — Developer & Operations Guide

This document describes the complete system: what it is, how it's built, how it's
deployed, and how to operate and troubleshoot it. It assumes a technical reader
who may have never seen the project before. Read it top to bottom once; after
that, the Troubleshooting and Operations sections are the day-to-day reference.

---

## 1. What this is

A self-hosted web dashboard for controlling a Home Assistant–based smart home.
It presents a multi-screen interface (a landing page that navigates to per-room
and global panels) showing live sensor data and interactive controls for lights,
media/home-theater, and an air purifier. It is reachable from anywhere via a
private Tailscale network, with nothing exposed to the public internet.

It is **not** a replacement for Home Assistant. Home Assistant (HA) remains the
source of truth and the integration layer for all devices. This dashboard is a
custom front-end that talks to HA's REST API — reading state and calling
services. The orchestration logic (e.g. "turn on the TV, then the receiver, then
launch Netflix") lives in HA scripts; the dashboard just triggers them.

---

## 2. Architecture overview

```
┌──────────────────────── Windows Server 2025 VM ────────────────────────┐
│                                                                          │
│   ┌──────────────── Node.js service (via NSSM) ──────────────────┐      │
│   │                                                               │      │
│   │   Express server (server/server.js)                           │      │
│   │     • GET  /api/devices   → merged device snapshot (polled)   │      │
│   │     • POST /api/service   → calls HA services (allowlisted)   │      │
│   │     • serves client/dist  → the built React app               │      │
│   │                                                               │      │
│   │   Adapters (server/adapters/)                                 │      │
│   │     • homeAssistant.js  → polls /api/states, calls services   │      │
│   │     • httpDevices.js    → polls direct HTTP devices (unused)  │      │
│   │     • mqttDevices.js    → subscribes to MQTT (unused)         │      │
│   │                                                               │      │
│   │   Background loop: every pollIntervalMs, refresh snapshot     │      │
│   └───────────────────────────────────────────────────────────────┘    │
│                                                                          │
│   Tailscale (joins private tailnet; provides 100.x.y.z address)          │
└──────────────────────────────┬───────────────────────────────────────────┘
                                │ encrypted WireGuard mesh (no public ports)
              ┌─────────────────┼──────────────────┐
         family phones      laptops          (all enrolled in the tailnet)
                                │
                                │ HA REST API (LAN)
                                ▼
                       ┌──────────────────┐
                       │  Home Assistant  │  ← source of truth for all devices
                       │  + Broadlink,    │
                       │    Govee, Nest,  │
                       │    scripts, etc. │
                       └──────────────────┘
```

**Data flow, read path:** Browser polls `GET /api/devices` every 2s → server
returns a cached snapshot → the snapshot is refreshed every `pollIntervalMs` by
the background loop, which calls HA's `GET /api/states` and maps the results into
a normalized device shape.

**Data flow, control path:** User taps a control → browser `POST /api/service`
with `{domain, service, data}` → server checks an allowlist → server calls HA's
`POST /api/services/<domain>/<service>` → on success, triggers an immediate
snapshot refresh so the UI updates without waiting for the next poll.

---

## 3. Technology choices and why

- **Windows Server 2025** — chosen over Linux because the admin is a Microsoft
  SME; the original Ubuntu attempt turned every step into a research task.
- **Node.js 24 LTS** — the runtime. Active LTS, stable for an always-on service.
- **Express** — minimal HTTP server for the API and static file serving.
- **React + Vite** — the front-end. Vite builds to static files the Node server
  serves directly, so there's a single service to run (no separate front-end
  server, unlike Next.js).
- **NSSM** (Non-Sucking Service Manager) — wraps the Node process as a Windows
  service so it auto-starts on boot and stays running. Chosen over node-windows
  for being the least fragile and keeping service concerns out of app code.
- **Tailscale** — remote access via a private WireGuard mesh. Chosen over
  port-forwarding (which would expose the dashboard to the internet) and over a
  reverse tunnel. Side benefit: its overlay network sidesteps the local
  Firewalla wireless-bridge issues that plagued earlier networking attempts.
- **Polling, not websockets** — the dashboard polls HA on an interval rather
  than subscribing to HA's websocket. Simpler, and "every few seconds" latency
  is acceptable for this use case.

---

## 4. File and directory layout

```
iot-dashboard/
├── README.md                  Original setup notes
├── ENTITIES.txt               Generated list of HA entities for config.js
├── .gitignore
├── docs/
│   ├── FAMILY-SETUP.md         Family phone-setup guide
│   └── DEVELOPER-GUIDE.md      This document
├── server/
│   ├── package.json            Backend deps (express, mqtt)
│   ├── server.js               Express app: endpoints, allowlist, poll loop
│   ├── config.example.js       Template config (copy to config.js)
│   ├── config.js               REAL config — HA URL, token, entities. GITIGNORED.
│   └── adapters/
│       ├── homeAssistant.js    Polls HA states; calls HA services
│       ├── httpDevices.js      Direct HTTP device polling (not currently used)
│       └── mqttDevices.js      MQTT subscription (not currently used)
└── client/
    ├── package.json            Frontend deps (react, vite)
    ├── vite.config.js          Dev proxy config
    ├── index.html              HTML entry point
    ├── dist/                   BUILT output (generated by `npm run build`)
    └── src/
        ├── main.jsx            React entry point
        ├── App.jsx             Routing, polling hook, panel rendering
        ├── layout.js           ★ THE config that defines all panels/entities
        ├── Controls.jsx        Light/Media/Purifier/Activity control widgets
        ├── Icon.jsx            Inline SVG icons
        └── styles.css          All styling
```

**The single most important file to understand is `client/src/layout.js`.** It
defines every panel, what entities each shows, and how the home-theater
activities are wired. Adding a room or a light is almost always an edit to this
one file (plus adding the entity to `config.js` so the backend fetches it).

---

## 5. How `layout.js` works

`layout.js` exports a `PANELS` array. Each panel is an object:

```js
{
  id: "rec_room",          // URL hash route (#/rec_room) and React key
  title: "Rec Room",       // display name
  icon: "sofa",            // key into Icon.jsx
  group: "global" | "room",// which section on the landing screen
  status: "live" | "planned", // planned = shell with "soon" placeholder
  kind: "sensor" | "control" | "camera",
  // ...type-specific fields below
}
```

**Sensor panels** (`kind: "sensor"`) have a flat `entities: [...]` array of
entity_ids; each renders as a read-only value card.

**Control panels** (`kind: "control"`, the rooms) can have:
- `lights: { groups: [...], bulbs: [...] }` — `groups` always shown; `bulbs`
  hidden behind a "show individual bulbs" disclosure.
- `media: [...]` — media_player entity_ids rendered as media controls.
- `purifier: { power, mode }` — a switch entity + a select entity.
- `activities: {...}` — home-theater control (see below).

**The `activities` block** (currently only Rec Room) defines home-theater
buttons. It does NOT fetch entity state; it only fires actions:
- `streamingScript` + `streaming: [{label, activity}]` — each button calls
  `script.turn_on` on the one streaming script, passing the app package name as
  the `activity` variable.
- `inputs`, `volume`, `power: [{label, device, command}]` — each calls
  `remote.send_command` on `remoteEntity` (the Broadlink remote) with the given
  device/command. These replay learned IR/RF codes.

`entitiesForPanel()` and `ALL_ENTITIES` at the bottom of the file derive the
complete set of entity_ids the dashboard needs. **`config.js` must list the same
entities** so the backend actually fetches them — `ENTITIES.txt` is the
generated, ready-to-paste version of this list.

### Adding a new room's lights

1. In `layout.js`, find the room's panel object, change `status` to `"live"`,
   and add a `lights: { groups: [...], bulbs: [...] }` block with the entity_ids.
2. Regenerate the entities list (see §8) and update `config.js`.
3. Rebuild the client and restart the service (see §7).

---

## 6. The backend in detail

### server.js

- Creates the three adapters from `config.js`.
- Holds an in-memory `snapshot` of all device states, refreshed every
  `pollIntervalMs` by `refresh()` and on-demand after a successful control call.
- `GET /api/devices` returns the snapshot (fast — always served from cache).
- `GET /api/health` returns `{ok:true}`.
- `POST /api/service` is the control endpoint. It validates against
  `ALLOWED_SERVICES` (a hardcoded Set) and rejects anything not on it with a 403.
  **This allowlist is a deliberate security boundary** — even though only tailnet
  devices can reach the server, it ensures the dashboard can only call known-safe
  services, never arbitrary ones like `homeassistant.restart`.
- Serves `client/dist` as static files; unmatched routes return `index.html`
  (so client-side hash routing works).
- Binds to `0.0.0.0` so it's reachable on the Tailscale interface.

### adapters/homeAssistant.js

- `poll()` — GETs `/api/states` with a Bearer token, filters to the configured
  `entities`, maps each into the normalized shape:
  `{ id, name, source, ok, value, unit, updatedAt, attrs }`. `attrs` carries
  `brightness`, `rgb_color`, `supported_color_modes`, `volume_level`, `options`
  for the control widgets.
- `callService(domain, service, data)` — POSTs to
  `/api/services/<domain>/<service>` with the data as the JSON body. For scripts,
  variables (like `activity`) are passed as top-level keys in `data`.

### config.js (NOT in version control)

```js
export default {
  port: 8080,
  pollIntervalMs: 5000,           // backend HA poll interval
  homeAssistant: {
    enabled: true,
    baseUrl: "http://<ha-host>:8123",   // no trailing slash
    token: "<long-lived access token>", // from HA profile, 10yr validity
    entities: [ /* see ENTITIES.txt */ ],
  },
  httpDevices: [],                // unused
  mqtt: { enabled: false, ... },  // unused
};
```

The HA token is a long-lived access token created in the HA user profile
(Security tab → Long-Lived Access Tokens). It grants broad access to HA — treat
`config.js` as a secret. It is gitignored.

---

## 7. Deployment & the rebuild routine

The project lives at `C:\apps\iot-dashboard` on the server.

### After changing client code (the common case)

```powershell
cd C:\apps\iot-dashboard\client
npm install        # pulls any new deps; near-instant if nothing changed
npm run build      # compiles React into client\dist — REQUIRED for UI changes

$nssm = "C:\apps\iot-dashboard\nssm.exe"
& $nssm restart IoTDashboard
```

Then **hard-refresh** the browser (Ctrl+Shift+R) — browsers cache the old JS
bundle aggressively.

**Order matters:** build first, then restart. Restarting before building serves
the old `dist`.

### After changing only config.js

No build needed — just restart the service:
```powershell
& "C:\apps\iot-dashboard\nssm.exe" restart IoTDashboard
```

### Replacing the whole project with a new build

Extract the new files over `C:\apps\iot-dashboard`, **but never overwrite
`server\config.js`** (it holds the token and entity list). Safest method:
extract to a temp folder, copy everything except `server\config.js`, then run
the rebuild routine.

### Important notes

- `nssm` is not on the system PATH. Call it by full path
  (`C:\apps\iot-dashboard\nssm.exe`) or set `$nssm` first each session.
- `node_modules` and `client/dist` are not shipped in the zip; `npm install` and
  `npm run build` regenerate them.

---

## 8. Regenerating the entities list

When you add entities to `layout.js`, the backend's `config.js` must include
them. Generate the current full list:

```powershell
cd C:\apps\iot-dashboard\client\src
node --input-type=module -e "import {ALL_ENTITIES} from './layout.js'; console.log(JSON.stringify(ALL_ENTITIES, null, 2))"
```

Paste the result into `config.js` → `homeAssistant.entities`. (Activities —
scripts and remote commands — are actions, not fetched entities, so they don't
go in this list.)

---

## 9. The NSSM service

Registered as `IoTDashboard`. Managed with:

```powershell
$nssm = "C:\apps\iot-dashboard\nssm.exe"
& $nssm start   IoTDashboard
& $nssm stop    IoTDashboard
& $nssm restart IoTDashboard
& $nssm status  IoTDashboard
# or use Windows-native:
Get-Service IoTDashboard
Restart-Service IoTDashboard   # needs elevation
```

Service configuration that was set:
- Runs `C:\Program Files\nodejs\node.exe C:\apps\iot-dashboard\server\server.js`
- `AppDirectory` = `C:\apps\iot-dashboard\server` (so it finds server.js/config.js)
- `Start` = `SERVICE_AUTO_START` (starts on boot)
- Logs to `C:\apps\iot-dashboard\logs\out.log` and `err.log`

The `AppDirectory` setting is important — without it, Node would look for
`server.js` in the wrong place.

---

## 10. Networking & access

- The VM has a **DHCP reservation on the Firewalla** keyed to its MAC
  (`00:15:5D:E6:FA:05`, the Hyper-V virtual adapter). This gives it a stable LAN
  IP.
- **Tailscale** provides the access path. The server's tailnet IP is
  `100.95.164.64`. Family devices reach the dashboard at
  `http://100.95.164.64:8080` from anywhere, as long as they're signed into the
  same tailnet and connected.
- **Windows Firewall** has an inbound allow rule named "IoT Dashboard
  (Tailscale)" for TCP 8080 (Profile: Any).
- Admin access to the server is via **RDP** (`mstsc /v:<ip>`) and **PowerShell
  Remoting** (workgroup machine, so the client needs a TrustedHosts entry).
- No ports are forwarded on the Firewalla. The dashboard is not on the public
  internet.

---

## 11. Security model

- **Network is the primary auth.** Only devices enrolled in the tailnet can
  reach the dashboard at all. There is intentionally **no app-level login**.
- **Accepted risk:** anything on the tailnet can control the house with no
  further check. This is acceptable for a tailnet of only the family's own
  devices. **If the tailnet is ever shared more widely, add an app-level login**
  — the code is structured to allow this, and it would be the right time to
  introduce a password gate in front of control actions.
- **Service allowlist.** `POST /api/service` only permits services in
  `ALLOWED_SERVICES`. Arbitrary HA service calls are rejected.
- **The HA token in `config.js` is a broad-access secret.** Keep the file off
  version control (it's gitignored) and don't paste its contents anywhere.
- **Camera tokens:** if HA camera `access_token` values are ever exposed (e.g.
  pasted into a chat or log), regenerate them by restarting the camera
  integration in HA.

---

## 12. Operations runbook

### Routine

- The service is always-on and self-starts on reboot. Normal operation requires
  nothing.
- After any reboot of the VM, the dashboard should come back automatically. Worth
  confirming once after any major change.

### Updating

Follow the rebuild routine (§7). Always verify after: load the dashboard, hard
refresh, tap a control.

### Backups worth keeping

- `server/config.js` (the token + entity list — the only non-reproducible file).
- `client/src/layout.js` (the panel definitions — your customization).
Everything else can be rebuilt from the repo.

---

## 13. Troubleshooting

Work from the symptom. Most issues fall into: service down, network path, or HA
side.

### Dashboard won't load at all (from any device)

1. Is the service running?
   `Get-Service IoTDashboard` → expect `Running`.
   If not: `& $nssm start IoTDashboard`, then check `logs\err.log`.
2. Is something listening on 8080?
   `Get-NetTCPConnection -LocalPort 8080 -State Listen`
   → expect a listener on `0.0.0.0`. If nothing, the Node process isn't up —
   check `logs\err.log` for a crash (often a `config.js` syntax error).
3. Does it load on the server itself? Browse `http://localhost:8080` on the
   server via RDP. If yes, the problem is the network path, not the app.

### Loads on the server but not from a phone

1. Tailscale on the phone: open the app, confirm connected, confirm the server
   appears in the machine list.
2. Confirm the address: `http://100.95.164.64:8080` (http, not https; port 8080).
3. From the server, browse its own Tailscale IP (`http://100.95.164.64:8080`).
   If that fails too, the listener or firewall is the issue (see below).
4. Windows Firewall: confirm the "IoT Dashboard (Tailscale)" rule exists and is
   enabled. As a diagnostic only, briefly disable the Private-profile firewall
   and retest; re-enable immediately.

### A specific control does nothing

1. Does it work in Home Assistant directly? If it fails in HA too, it's a device
   or HA problem, not the dashboard.
2. Check the entity_id in `layout.js` matches HA exactly. A wrong/typo'd
   entity_id produces a silent no-op (or a card that never appears).
3. For activities (streaming/inputs/volume): confirm the script entity_id and
   the Broadlink device/command strings match HA. These map to learned IR/RF
   codes; a wrong command silently does nothing.
4. Check `logs\err.log` for 403s (service not on the allowlist — add it to
   `ALLOWED_SERVICES` in server.js) or HA HTTP errors.

### Toggle flips then snaps back

That's the optimistic-UI revert working as designed: the command genuinely
failed (device offline, etc.). The UI shows the real state after the command
didn't take. Investigate the device/HA, not the dashboard.

### "HA returned HTTP 401"

The long-lived access token in `config.js` is wrong or expired. Create a new one
in HA (profile → Security → Long-Lived Access Tokens), update `config.js`,
restart the service.

### Panel shows "Waiting for data from Home Assistant"

The entities for that panel aren't in `config.js` → the backend isn't fetching
them. Regenerate the entities list (§8) and update `config.js`.

### Where the logs are

`C:\apps\iot-dashboard\logs\out.log` (stdout) and `err.log` (stderr). The server
also prints the listening message on startup. For deeper inspection, stop the
service and run `node server.js` by hand from `server\` to watch output live.

---

## 14. Current state & roadmap

**Live panels:** Climate & Air, Network, Rec Room (full: lights, media, air
purifier, home-theater activities), Lucas's Room, Tyler's Room, Porch & Exterior,
Deck.

**Shells (defined, not yet populated):** Kitchen, Living Room, Loft, Master
Bedroom, Sam's Room, Cottage, Cameras.

**Known follow-ups:**
- Populate the remaining rooms' lights (add entity_ids to `layout.js` + config).
- Media controls in Rec Room use the primary media_player entities; the `_2`
  "Music Assistant" variants carry volume — may need swapping if volume/transport
  misbehaves.
- Climate panel currently shows sensors only; `climate.downstairs` is a real
  thermostat that could become full heat/cool control.
- Cameras (Stage D) not yet built — would require proxying HA camera streams
  (HLS/MJPEG) through the Node backend. Heaviest remaining feature.
- Air monitors expose more than temperature (humidity, air quality); the Climate
  panel could surface those additional sensors.

---

## 15. Quick reference

| Thing | Value / Command |
|---|---|
| Project path | `C:\apps\iot-dashboard` |
| Service name | `IoTDashboard` |
| Dashboard URL | `http://100.95.164.64:8080` |
| Server LAN MAC | `00:15:5D:E6:FA:05` |
| Dashboard port | `8080` |
| NSSM path | `C:\apps\iot-dashboard\nssm.exe` |
| Logs | `C:\apps\iot-dashboard\logs\` |
| Rebuild | `cd client; npm install; npm run build; nssm restart IoTDashboard` |
| Restart only | `nssm restart IoTDashboard` |
| Check listener | `Get-NetTCPConnection -LocalPort 8080 -State Listen` |
| Regenerate entities | `node --input-type=module -e "import {ALL_ENTITIES} from './layout.js'; console.log(JSON.stringify(ALL_ENTITIES,null,2))"` (from client/src) |
