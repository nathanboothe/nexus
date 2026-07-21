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
    // Music Assistant players (for grouped speaker playback)
    massHomeTheater: 'media_player.home_theater_3',
    massKitchen: 'media_player.kitchen_speaker_2',
    massLivingRoom: 'media_player.living_room_speaker_2',
    massLoft: 'media_player.loft_speaker_2',
  },

  musicAssistant: {
    configEntryId: '01KR1SAXN6ZQNPY23F611HS081',
    likedMusicUri: 'https://music.youtube.com/playlist?list=LM',
  },

  govee: {
    apiKey: process.env.GOVEE_API_KEY || 'PASTE_YOUR_GOVEE_API_KEY_HERE',
    pollIntervalMs: 300000,
  },
};