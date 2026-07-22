// Nexus server configuration
// Fill in real values below. This file is gitignored — never commit it.
// On Render, set these as environment variables instead (see README) and
// this file just reads from process.env with these as local-dev fallbacks.

export default {
  port: process.env.PORT || 8080,

  homeAssistant: {
    // Nabu Casa remote URL — works identically to the local URL, same token,
    // just drop the port. Everything now routes through HA since it's the
    // only thing with a stable, reachable-from-anywhere address.
    url: process.env.HA_URL || 'https://PASTE_YOUR_SUBDOMAIN.ui.nabu.casa',
    token: process.env.HA_TOKEN || 'PASTE_YOUR_HA_LONG_LIVED_TOKEN_HERE',
  },

  entities: {
    // Samsung TV via Broadlink IR
    broadlink: 'remote.base_station',
    // Denon AVR — already a known HA entity, NOT home_theater (HEOS) or
    // home_theater_3 (Music Assistant)
    denon: 'media_player.home_theater_2',
    // Google TV — remote entity for D-pad/nav
    googleTvRemote: 'remote.rec_room_google_tv',
    // Google TV — media_player entity for the Android TV integration,
    // used as the target for adb_command (app launching)
    googleTvMediaPlayer: 'media_player.rec_room_google_tv_3',
  },

  govee: {
    apiKey: process.env.GOVEE_API_KEY || 'PASTE_YOUR_GOVEE_API_KEY_HERE',
    // Govee cloud API caps at 10,000 requests/day — keep this long
    pollIntervalMs: 300000,
  },
};
