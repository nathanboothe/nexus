// config.example.js
// Copy this to config.js and fill in your real values.
// config.js is gitignored so your tokens never get committed.

export default {
  // Port the dashboard listens on. Because access is via Tailscale,
  // binding to 0.0.0.0 is fine — only tailnet devices can route here.
  port: 8080,

  // How often (ms) to poll HTTP/HA sources. "Every few seconds is fine."
  pollIntervalMs: 5000,

  // ---- Home Assistant ----
  homeAssistant: {
    enabled: true,
    // Base URL of your HA instance, no trailing slash.
    baseUrl: "http://homeassistant.local:8123",
    // Long-Lived Access Token from HA profile page (Bearer token, 10yr).
    token: "PASTE_YOUR_LONG_LIVED_TOKEN_HERE",
    // Only surface these entities. Empty array = all states.
    entities: [
      // "sensor.living_room_temperature",
      // "light.kitchen",
    ],
  },

  // ---- Direct devices polled over HTTP/REST ----
  // Each gets fetched every pollIntervalMs. `parse` turns the raw
  // response into { value, unit } however that device reports.
  httpDevices: [
    // {
    //   id: "garage_temp",
    //   name: "Garage Temperature",
    //   url: "http://192.168.230.40/api/sensor",
    //   parse: (json) => ({ value: json.temp_c, unit: "°C" }),
    // },
  ],

  // ---- Direct devices that publish over MQTT ----
  mqtt: {
    enabled: false,
    brokerUrl: "mqtt://192.168.230.30:1883",
    username: "",
    password: "",
    // Topics to subscribe to; each maps to a device id shown on the dash.
    subscriptions: [
      // { id: "shed_humidity", name: "Shed Humidity", topic: "shed/humidity", unit: "%" },
    ],
  },
};
