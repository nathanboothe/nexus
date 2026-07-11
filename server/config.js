// Nexus server configuration
// On Render, real values come from environment variables (HA_URL, HA_TOKEN,
// GOVEE_API_KEY) — the strings below are just placeholders for local dev.

export default {
  port: process.env.PORT || 8080,

  homeAssistant: {
    url: process.env.HA_URL || 'https://PASTE_YOUR_SUBDOMAIN.ui.nabu.casa',
    token: process.env.HA_TOKEN || 'PASTE_YOUR_HA_LONG_LIVED_TOKEN_HERE',
  },

  entities: {
    broadlink: 'remote.base_station',
    denon: 'media_player.home_theater_2',
    googleTvRemote: 'remote.rec_room_google_tv',
    googleTvMediaPlayer: 'media_player.rec_room_google_tv_3',
  },

  govee: {
    apiKey: process.env.GOVEE_API_KEY || 'PASTE_YOUR_GOVEE_API_KEY_HERE',
    pollIntervalMs: 300000,
  },
};