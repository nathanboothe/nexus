# Nexus Dashboard — Action Flow Reference

This traces every interactive control across all four tabs, from the JSX
element you'd click, through the handler function, through the network
call, to the file that (as far as I know) owns it on the backend.

**Important honesty note before you use this:** I wrote all four frontend
files (`EntertainmentSystem.jsx`, `WholeHomeAudio.jsx`, `SmartHomeView.jsx`,
and their wrappers) myself in this conversation, so the frontend columns
below are exact. I have **not** read `recroom.js`, `homeassistant.js`,
`denon.js`, `entityConfig.js`, or `api.js` — the "Backend file" and
"External system" columns are inferred from your project's naming
convention (route prefix → file) and from things you've told me in past
sessions (Denon port 11080, Broadlink `remote.base_station`, etc.), not from
reading the actual server code. Treat those columns as a strong guess to
verify against the real files, not ground truth.

---

## 1. How the pieces connect (read this first)

```
Button in a .jsx file
  → onClick calls a handler function (defined in the same file)
  → handler calls api('/some/route', METHOD, bodyData)
  → api.js prepends /api → real request is POST/GET /api/some/route
  → Express backend routes by first path segment:
      /recroom/...  → server/recroom.js
      /ha/...       → server/homeassistant.js
      /denon/...    → server/denon.js
  → that file talks to the actual device/service
      (Broadlink IR, Home Assistant via Nabu Casa, Denon port 11080, Music Assistant)
```

Every row below follows that same shape. Rows marked **(client-only)** never
leave the browser — no network call, just a state update and a re-render.

---

## 2. Entertainment System tab — `EntertainmentSystem.jsx`

| Control | Handler | Calls | Endpoint | Backend file (inferred) | External system (inferred) |
|---|---|---|---|---|---|
| **Power** button | `toggleEverything()` | `denonPower()`, `samsungCommand()`, `denonInput()` in sequence | `POST /denon/power`, `POST /recroom/samsung/command`, `POST /denon/input` | `denon.js` + `recroom.js` | Denon AVR (port 11080) + Broadlink IR |
| **Watch TV / Stop Watch TV** | `toggleEverything()` | *same as Power* — this button is a relabeled duplicate of Power | *same as above* | *same as above* | *same as above* |
| D-pad ▲ ▼ ◀ ▶ | `googleTvNav(command)` | `api('/recroom/googletv/nav', 'POST', {command})` | `POST /recroom/googletv/nav` | `recroom.js` | Google TV Streamer (Android TV Remote integration via HA) |
| D-pad **OK** | `googleTvNav('DPAD_CENTER')` | same as above | same | `recroom.js` | same |
| **Back** / **Home** | `googleTvNav('BACK')` / `googleTvNav('HOME')` | same pattern | same | `recroom.js` | same |
| Streaming app tiles (9x, see §2a) | `launchApp(app)` | `api('/recroom/googletv/launch', 'POST', {activity})` | `POST /recroom/googletv/launch` | `recroom.js` | Google TV Streamer |
| Console shortcuts: **Xbox / PS5 / Switch 2** | `denonInput(source, label)` | `api('/denon/input', 'POST', {input})` | `POST /denon/input` | `denon.js` | Denon AVR (port 11080) |
| Volume slider (`id="ent-vol"`) | `<VolumeSlider>` → `onChange={denonVolume}` | `api('/denon/volume', 'POST', {level})` on release | `POST /denon/volume` | `denon.js` | Denon AVR (port 11080) |
| **Samsung TV → Power** | `samsungPowerButton()` | `samsungCommand('power')`, then flips local `tvOn` **(client-only state)** | `POST /recroom/samsung/command` | `recroom.js` | Broadlink IR → Samsung TV |
| **Samsung TV → Vol +/-, Mute, Ch +/-** | `samsungCommand(command)` | `api('/recroom/samsung/command', 'POST', {command})` | `POST /recroom/samsung/command` | `recroom.js` | Broadlink IR → Samsung TV (fire-and-forget, no state readback) |
| **Denon AVR → Power On / Standby** | `denonPower(on)` | `api('/denon/power', 'POST', {on})` | `POST /denon/power` | `denon.js` | Denon AVR (port 11080) |
| **Denon AVR → Mute / Unmute** | `denonMute(muted)` | `api('/denon/mute', 'POST', {muted})` | `POST /denon/mute` | `denon.js` | Denon AVR (port 11080) |
| Volume slider (`id="denon-vol"`) | same `<VolumeSlider>` component, same `denonVolume` | `POST /denon/volume` | `denon.js` | Denon AVR (port 11080) |
| Denon status line at top of Denon card | `refreshDenon()` on mount | `api('/denon/status')` (GET) | `GET /denon/status` | `denon.js` | Denon AVR |

### 2a. Streaming app tiles — the `activity` string each one sends

All nine call the same `launchApp(app)` function; only the `activity` value
in the `STREAMING_APPS` array differs.

| App | `activity` value sent |
|---|---|
| Netflix | `com.netflix.ninja/.MainActivity` |
| YouTube | `com.google.android.youtube.tv/.MainActivity` |
| Disney+ | `com.disney.disneyplus/.MainActivity` |
| Max | `com.wbd.stream/com.wbd.beam.BeamActivity` |
| Hulu | `com.hulu.livingroomplus/.MainActivity` |
| Prime | `com.amazon.amazonvideo.livingroom/com.amazon.ignition.IgnitionActivity` |
| Apple TV | `com.apple.atve.androidtv.appletv/.MainActivity` |
| Peacock | `com.peacocktv.peacockandroid/.MainActivity` |
| Paramount+ | `com.cbs.ott/.MainActivity` |

If a tile stops launching the right app, this is the table to check first —
Google occasionally changes an app's launch activity on update.

---

## 3. Whole-Home Audio tab — `WholeHomeAudio.jsx`

| Control | Handler | Calls | Endpoint | Backend file (inferred) | External system (inferred) |
|---|---|---|---|---|---|
| Speaker checkboxes (Kitchen / Living Room / Loft) | `toggleSpeaker(key)` | **(client-only)** — flips `speakerSelection` state | — | — | none directly; read by `selectedMembers()` when you next play something |
| **■ Stop** | `stopAudio()` | `api('/recroom/speakers/stop', 'POST')` | `POST /recroom/speakers/stop` | `recroom.js` | Music Assistant |
| Search field + **Search & Play** | `playSearch()` | `api('/recroom/speakers/group-search', 'POST', {query, members})` | `POST /recroom/speakers/group-search` | `recroom.js` | Music Assistant (YouTube Music) |
| **▶ Play Liked Music** | `playLikedMusic()` | `api('/recroom/speakers/group-favorites', 'POST', {members})` | `POST /recroom/speakers/group-favorites` | `recroom.js` | Music Assistant, YT Music `Liked Music` playlist |
| Playlist dropdown + **Play** | `playSelectedPlaylist()` | `api('/recroom/speakers/group-play-playlist', 'POST', {uri, members})` | `POST /recroom/speakers/group-play-playlist` | `recroom.js` | Music Assistant |
| **⟳** (reload playlists) | `loadPlaylists()` | `api('/recroom/speakers/playlists')` (GET) | `GET /recroom/speakers/playlists` | `recroom.js` | Music Assistant |
| Album art + now-playing title/artist | `refreshNowPlaying()` — runs on mount, then every 5s | `api('/ha/state/media_player.home_theater_3')` (GET) | `GET /ha/state/:entityId` | `homeassistant.js` | Home Assistant (Nabu Casa) |

**Background polling:** `refreshNowPlaying` runs on a `setInterval` every
5000ms while this tab is mounted (it stops the moment you switch tabs, since
React unmounts the component and clears the interval). This is what keeps
the album art and "Nothing playing" / song title current without you doing
anything.

**Every play action includes `members`:** `selectedMembers()` always
prepends `massHomeTheater` (the group leader, never optional) to whichever
of `massKitchen` / `massLivingRoom` / `massLoft` are currently checked. So
the checkboxes don't call the API themselves — they just decide what gets
sent the *next* time you press Play/Search/Liked Music.

---

## 4. Climate & Lighting and Cameras & Devices tabs — `SmartHomeView.jsx`

Both tabs render the exact same component (`SmartHomeView`), just scoped to
different sections via the `sections` prop (see `ClimateLighting.jsx` /
`CamerasDevices.jsx`). Everything below applies to both.

| Control | Handler | Calls | Endpoint | Backend file (inferred) | External system (inferred) |
|---|---|---|---|---|---|
| **By Section / By Location** toggle | `selectViewMode(mode)` | **(client-only)** — changes `viewMode` state, resets `page` to 0 | — | — | none |
| Section/location pill buttons | `selectSection(s)` / `selectLocation(l)` | **(client-only)** | — | — | none |
| **⟳ Refresh** | `loadHaStates()` | `api('/ha/states')` (GET) | `GET /ha/states` | `homeassistant.js` | Home Assistant (Nabu Casa) |
| **Prev / Next** pager | inline `setPage()` calls | **(client-only)** — just changes which pre-computed page is shown | — | — | none |
| Light card: **On/Off** | `onAction('light', 'turn_on'/'turn_off', id)` in `LightControls` | `api('/ha/service', 'POST', {domain:'light', service, data:{entity_id,...}})` | `POST /ha/service` | `homeassistant.js` | Home Assistant → the light's own integration |
| Light card: brightness slider | same `onAction`, service `'turn_on'`, `data:{brightness_pct}` | `POST /ha/service` | `homeassistant.js` | HA |
| Light card: color swatch + **Set** | same `onAction`, service `'turn_on'`, `data:{rgb_color}` | `POST /ha/service` | `homeassistant.js` | HA |
| Switch card: **Turn On/Off** | `onAction('switch', ...)` in `SwitchControls` | `POST /ha/service` | `homeassistant.js` | HA |
| Climate card: **−** / **+** | `onAction('climate', 'set_temperature', id, {temperature})` | `POST /ha/service` | `homeassistant.js` | HA thermostat integration |
| Media player card: **Play/Pause**, **Turn On/Off** | `onAction('media_player', ...)` in `MediaControls` (the Smart Home one, distinct from the Whole-Home Audio tab) | `POST /ha/service` | `homeassistant.js` | HA |
| Select card dropdown | `onAction('select', 'select_option', id, {option})` | `POST /ha/service` | `homeassistant.js` | HA |
| Camera card: **Go Live / Stop Live** | local `setLive` toggle in `CameraCard` | **(client-only toggle)** — while live, refreshes `<img src>` every 2s | `GET /api/ha/camera/:id?t=...` (image request, not via `api()`) | `homeassistant.js` | HA camera proxy |
| Sensor / binary_sensor / event cards | none — display only | — | — | — | (data arrives via the 15s poll below) |

**Background polling:** `loadHaStates` runs every `HA_POLL_INTERVAL_MS`
(15000ms) the whole time either Smart Home tab is open. Every entity card's
displayed state — on/off, temperature, sensor reading — comes from this one
poll, not from individual per-card requests.

**Pagination is entirely client-side.** `paginateGroups()` runs once per
render against the already-loaded entity list and slices it into pages of
up to `ENTITIES_PER_PAGE` (24) cards. Prev/Next never hits the network —
it's just picking a different slice of data you already have.

---

## 5. Shared plumbing

### `api.js`
Per your own project notes: a shared helper that prepends `/api` to every
path automatically, and exports both a default function (used everywhere
above as `api(path, method, body)`) and named exports (`ha`, `denon`,
`recroom`, `airtable`, `genealogy`, `connectWebSocket`). I have not read
this file directly in this conversation.

### Route file → what it owns (by convention, not confirmed by reading the files)

| Prefix | File | Talks to |
|---|---|---|
| `/recroom/...` | `server/recroom.js` | Broadlink IR (Samsung TV), Android TV Remote (Google TV), Music Assistant (Whole-Home Audio) |
| `/ha/...` | `server/homeassistant.js` | Home Assistant, via your Nabu Casa remote URL |
| `/denon/...` | `server/denon.js` | Denon AVR directly, port 11080, `/ajax/globals/set_config` |

### The flash message pattern
Every tab has its own local `flash(msg)` helper — sets a string into state,
shows it as a toast, clears it after 2000ms via `setTimeout`. Purely a UI
convenience; it never talks to the network. If you ever see a flash message
that seems wrong, the bug is in whatever called `flash(...)`, not in the
flash mechanism itself.

---

## 6. Quick lookup — every handler function, alphabetically, by file

Useful for "I know the function name, where do I edit it" lookups.

**`EntertainmentSystem.jsx`**
`denonInput`, `denonMute`, `denonPower`, `denonVolume`, `googleTvNav`,
`launchApp`, `refreshDenon`, `samsungCommand`, `samsungPowerButton`,
`toggleEverything`, `VolumeSlider` (shared sub-component)

**`WholeHomeAudio.jsx`**
`loadPlaylists`, `playLikedMusic`, `playSearch`, `playSelectedPlaylist`,
`refreshNowPlaying`, `selectedMembers`, `stopAudio`, `toggleSpeaker`

**`SmartHomeView.jsx`**
`handleAction` (the one function every entity-domain control ultimately
calls), `loadHaStates`, `selectLocation`, `selectSection`, `selectViewMode`,
plus the per-domain renderers: `LightControls`, `SwitchControls`,
`ClimateControls`, `MediaControls`, `SelectControls`, `ReadingDisplay`,
`BinaryReading`, `EventReading`, `CameraCard`

---

## 7. Answer to the standing exercise (Steam Deck shortcut)

For reference — adding a new console shortcut like "Play Steam Deck" would
mean:

1. **Frontend** (`EntertainmentSystem.jsx`): add a new button next to
   Xbox/PS5/Switch 2 calling
   `denonInput(DENON_SOURCE_STEAMDECK, 'Steam Deck')`, plus a new constant
   `const DENON_SOURCE_STEAMDECK = '...'` matching the exact Denon
   `source_list` value from HA Developer Tools > States.
2. **Backend**: nothing new needed *if* the Denon input already exists as a
   named source — `denon.js` already handles arbitrary `input` values via
   `POST /denon/input`. You'd only need a backend change if Steam Deck
   needed different handling than "just switch Denon input," e.g. also
   powering something else on first.
