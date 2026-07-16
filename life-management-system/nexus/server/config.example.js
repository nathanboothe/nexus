// config.example.js
// Copy this file to config.js and fill in your real values.
// config.js is gitignored — never commit real tokens.

export default {

  // ── Server ──────────────────────────────────────────────────────────
  port: 8080,
  pollIntervalMs: 5000,

  // ── Airtable ─────────────────────────────────────────────────────────
  airtable: {
    baseId: "appjBazhQ7EqRseCc",
    pat: "YOUR_AIRTABLE_PAT_HERE",
    // Table IDs — fill in after creating tables in Airtable
    tables: {
      projects:         "tblXXXXXXXXXXXXXX",
      inbox:            "tblXXXXXXXXXXXXXX",
      reference:        "tblXXXXXXXXXXXXXX",
      areas:            "tblXXXXXXXXXXXXXX",
      tasks:            "tblXXXXXXXXXXXXXX",
      calendar:         "tblXXXXXXXXXXXXXX",
      habits:           "tblXXXXXXXXXXXXXX",
      notes:            "tblXXXXXXXXXXXXXX",
      devices:          "tblXXXXXXXXXXXXXX",
      automationsLog:   "tblXXXXXXXXXXXXXX",
      // Genealogy tables
      repositories:     "tblXXXXXXXXXXXXXX",
      sources:          "tblXXXXXXXXXXXXXX",
      informationRecords: "tblXXXXXXXXXXXXXX",
      subjects:         "tblXXXXXXXXXXXXXX",
      irSubjectLinks:   "tblXXXXXXXXXXXXXX",
      events:           "tblXXXXXXXXXXXXXX",
      families:         "tblXXXXXXXXXXXXXX",
      researchQuestions: "tblXXXXXXXXXXXXXX",
    }
  },

  // ── Home Assistant ────────────────────────────────────────────────────
  homeAssistant: {
    enabled: true,
    baseUrl: "http://YOUR_HA_IP:8123",
    token: "YOUR_HA_LONG_LIVED_TOKEN",
    entities: [
      "sensor.hallway_temperature",
      "sensor.hallway_humidity",
      "sensor.rec_room_air_monitor_temperature",
      "sensor.loft_air_monitor_temperature",
      "sensor.sam_s_air_monitor_temperature",
      "sensor.tyler_s_air_monitor_temperature",
      "sensor.lucqs_room_air_monitor_temperature",
      "binary_sensor.firewalla_wan_status",
      "sensor.firewalla_external_ip",
      "sensor.firewalla_download_speed",
      "sensor.firewalla_upload_speed",
      "media_player.home_theater_2",
      "remote.base_station",
    ],
  },

  // ── Denon AVR (direct) ────────────────────────────────────────────────
  denon: {
    enabled: true,
    ip: "YOUR_DENON_IP",
    port: 80,
  },

  // ── Govee (direct) ───────────────────────────────────────────────────
  govee: {
    enabled: false,           // set true once API key obtained
    apiKey: "YOUR_GOVEE_API_KEY",
  },

  // ── Microsoft Graph (Genealogy pipeline) ─────────────────────────────
  graph: {
    clientId: "YOUR_AZURE_APP_CLIENT_ID",
    tenantId: "consumers",
    // Token cached at %USERPROFILE%\.genealogy_token via DPAPI
    // Do not store tokens here
  },

  // ── Genealogy pipeline ────────────────────────────────────────────────
  genealogy: {
    scriptPath: "C:\\Users\\YourName\\Documents\\Process-GenealogyDocument.ps1",
    oneDriveInbox: "Genealogy/Inbox",
    oneDriveProcessed: "Genealogy/Processed",
  },

  // ── MQTT (optional) ───────────────────────────────────────────────────
  mqtt: {
    enabled: false,
    brokerUrl: "mqtt://192.168.230.30:1883",
    username: "",
    password: "",
    subscriptions: [],
  },

};
