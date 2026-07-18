# Nexus — Home Automation & Life Management Dashboard

## Purpose
Self-hosted, custom-built dashboard replacing Home Assistant's native UI. A unified control surface for smart home devices, tasks, projects, calendars, and health metrics — designed to look better and behave more reliably than HA's default frontend.

## Stack & Infrastructure
- **Frontend:** React + Vite (`client/`)
- **Backend:** Express (`server/`)
- **Host:** Windows Server 2025 VM at `192.168.230.4`, running as NSSM Windows service `NexusDashboard`
- **Access:** `http://192.168.230.4:8080` and `http://dashboard.techfoundry360.com:8080`
- **Code location:** `C:\apps\nexus\`
- **Home Assistant:** kept only as a *headless device-abstraction layer* at `192.168.230.81:8123` — used for devices without good direct APIs (not the primary UI)
- **Network:** Firewalla Gold (router mode), flat `192.168.230.x` subnet, TP-Link Deco mesh in AP mode, domain `TechFoundry360`

## Architecture Philosophy
- Devices with solid direct/local APIs (Denon, Broadlink, Govee) are controlled **directly from the Node.js backend**, bypassing HA.
- Devices without viable direct APIs (Google TV nav, Samsung TV, smart locks, etc.) go through HA as an integration layer.
- One React SPA ties it all together with room-based and module-based pages.

## Active Modules

### 1. Rec Room
Single-page remote combining:
- Denon AVR volume control (direct HTTP to port 11080, `/ajax/globals/set_config`)
- Google TV D-pad navigation (via HA's Android TV integration — ADB keyevents don't work for nav)
- Streaming app launches (ADB `am start`)
- Samsung TV via IR (`remote.base_station` in HA)
- PWA-installable

### 2. Projects & Tasks
Migrated from Microsoft To Do to **Remember the Milk (RTM)**; syncs with an Airtable Projects table.

### 3. Smart Home
Govee cloud devices + HA MQTT devices, grouped by room.

### 4. Calendar
Outlook (device code OAuth, connected) + Google Calendar (infra ready, pending sign-in).

### 5. Health
Metrics and Workouts tabs (Appointments/Medications removed).

### 6. Skylight Display
`/skylight` route, standalone always-on landscape display (clock, temps, STEM projects, app launch buttons).

### Removed Modules
Finance (PIN-gate was built but scoped out), Habits, Genealogy (lives in a separate system).

## Key Technical Gotchas
- **Never write JS files via PowerShell here-strings** — causes corruption. Deliver as downloadable file; copy with `Copy-Item -Force`.
- **`filterByFormula` must never go through `URLSearchParams`** (double-encoding breaks it) — filter client-side instead.
- **Airtable single-select fields must be plain text, no emojis** — silent failures otherwise. Use field IDs + `typecast: true`.
- **`moduleRegistry.js` icons must be ASCII only** — emojis break the Vite build.
- **`$home` is a reserved PowerShell variable** — use `$homejsx`.
- **PowerShell here has no `&&`** — run commands on separate lines.
- **ADB keyevents don't work for Google TV nav** — only HA's Android TV integration does.
- **Denon:** port 80 redirects to HTTPS; use port 11080 for HTTP control.
- **NSSM recovery:** `nssm continue NexusDashboard` if it enters `SERVICE_PAUSED`; crash logs are in `error.log` (AppStderr), not `service.log`.
- **OAuth tokens under SYSTEM account** save to `C:\Windows\System32\config\systemprofile\`, not the interactive user profile.
- **HA entity naming trap:** `media_player.home_theater_2` = Denon AVR; `home_theater` = HEOS; `home_theater_3` = Music Assistant.

## Deployment Routine
```
cd client/  → npm install && npm run build
cd server/  → npm install (only if backend changed)
nssm restart NexusDashboard
Ctrl+Shift+R (hard refresh)
```

## Open Items
- RTM integration: add `RTM List ID` field to Airtable Projects table, clarify existing `Tasks` field, run end-to-end CRUD test
- Rotate a Govee API key that was exposed in a past chat
- Complete Google Calendar sign-in
- IoT network isolation via Firewalla (deferred until dashboard build is more complete)
- Investigate two room air monitors + hallway sensor that went offline simultaneously

## Key Resources
- Airtable base: `appjBazhQ7EqRseCc` (16 tables)
- HA: `192.168.230.81:8123`
- Device IPs: Google TV `192.168.230.174`, Broadlink RM4 Pro `192.168.230.73`, Denon `192.168.230.29`
- Make.com Scenario 3 (Airtable→task sync) — on-demand trigger to save credits
