# Nexus

Self-hosted-no-more home automation dashboard. Modules: Rec Room (Samsung TV / Denon AVR / Google TV), Smart Home (Govee).

## Architecture

Everything routes through Home Assistant's Nabu Casa remote URL — nothing needs
a direct local network connection anymore:

- **Samsung TV** — Broadlink IR via HA (`remote.base_station`)
- **Denon AVR** — via HA's `media_player.home_theater_2` entity (turn_on/off,
  volume_set, volume_mute, select_source) — no more direct port 11080 calls
- **Google TV nav** — via HA's Android TV remote integration (`remote.rec_room_google_tv`)
- **Google TV app launch** — via HA's `androidtv.adb_command` service
  (`media_player.rec_room_google_tv_3`), running the same `am start -n <activity>`
  command that used to run directly from this server
- **Govee (Smart Home)** — Govee's own cloud API, unaffected by any of this

HA itself stays on your LAN as it always has — Nabu Casa just gives it a stable
HTTPS URL, so this server can live anywhere (including fully in the cloud) and
still reach it.

## Environment variables (set these in Render, not in a committed file)

| Variable | Value |
|---|---|
| `HA_URL` | `https://nlg3ibiwfsee8gosfotjysbqqtxyh0lk.ui.nabu.casa` |
| `HA_TOKEN` | HA long-lived access token (Profile → Security → Long-Lived Access Tokens) |
| `GOVEE_API_KEY` | your existing Govee API key |

## Deploying to Render

1. Push this repo to GitHub.
2. In Render: New → Blueprint → point at the repo (it'll read `render.yaml`).
3. Set the three environment variables above in the Render dashboard (marked `sync: false` so they're not stored in git).
4. Deploy. Render runs the build (`client` build + `server` install) then starts `node index.js`.

## Local development

```powershell
cd server
Copy-Item config.example.js config.js
notepad config.js   # fill in HA_URL / HA_TOKEN / GOVEE_API_KEY directly, or export as env vars
npm install
cd ../client
npm install
npm run build       # or `npm run dev` for local hot-reload against the Vite dev server
```

`config.js` is gitignored — it never gets committed or pushed to Render; on Render the same values come from environment variables instead.

## Before this actually works, double check in Home Assistant:

- `media_player.home_theater_2` supports `select_source` with the exact source
  names you want to use — check its `source_list` attribute in
  Developer Tools → States, since the value passed to `/api/denon/input` must
  match one of those exactly.
- The Android TV integration for `media_player.rec_room_google_tv_3` has ADB
  access configured (it must, since this is the same integration nav commands
  already rely on) — `androidtv.adb_command` needs that to run shell commands.
