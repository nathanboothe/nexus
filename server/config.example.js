// Nexus server configuration
// Fill in real values below. This file is gitignored — never commit it.

export default {
  port: 8080,

  homeAssistant: {
    url: 'http://192.168.230.81:8123',
    // Long-lived access token from HA: Profile -> Security -> Long-Lived Access Tokens
    token: 'PASTE_YOUR_HA_LONG_LIVED_TOKEN_HERE',
  },

  denon: {
    enabled: true,
    ip: '192.168.230.29',
    port: 11080, // plain HTTP, no auth, port 80 redirects to HTTPS — use 11080 directly
  },

  broadlink: {
    // Samsung TV is controlled via Broadlink IR through Home Assistant, not directly
    haEntity: 'remote.base_station',
  },

  googleTv: {
    // Navigation (D-pad, home, back) goes through HA's Android TV integration —
    // ADB keyevents do NOT work for nav on this device, only app launching does.
    haEntity: 'remote.rec_room_google_tv',
    adbHost: '192.168.230.174:5555',
    adbPath: 'C:\\tools\\platform-tools\\adb.exe',
  },

  govee: {
    apiKey: 'PASTE_YOUR_GOVEE_API_KEY_HERE',
    // Govee cloud API caps at 10,000 requests/day — keep this long
    pollIntervalMs: 300000,
  },
};
