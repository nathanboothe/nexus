// layout.js
// Defines the dashboard's navigation structure. Edit this to add/rearrange
// screens. Each panel lists the HA entity_ids it should display.
//
// status: "live"      -> populated with real data now (Stage B)
//         "planned"   -> shell exists, fills in later (Stage C control / Stage D cameras)
//
// kind:   "sensor"    -> read-only value cards (works today)
//         "control"   -> interactive lights/media (Stage C, needs service calls + auth)
//         "camera"    -> live video feeds (Stage D, needs stream proxying)

export const PANELS = [
  // ---------- GLOBAL PANELS ----------
  {
    id: "climate",
    title: "Climate & Air",
    icon: "thermo",
    group: "global",
    status: "live",
    kind: "climate",
    // The thermostat (verified: climate.hallway).
    thermostat: "climate.hallway",
    // Air monitors grouped by room. Each shows temp + humidity + air quality.
    // Rec Room humidity/airquality IDs confirmed from states dump; others
    // follow the same naming pattern (VERIFY if any room's cards are empty).
    airMonitors: [
      { room: "Rec Room", temp: "sensor.rec_room_air_monitor_temperature", humidity: "sensor.rec_room_air_monitor_humidity", aqi: "sensor.rec_room_air_monitor_airquality" },
      { room: "Loft", temp: "sensor.loft_air_monitor_temperature", humidity: "sensor.loft_air_monitor_humidity", aqi: "sensor.loft_air_monitor_airquality" },
      { room: "Sam's", temp: "sensor.sam_s_air_monitor_temperature", humidity: "sensor.sam_s_air_monitor_humidity", aqi: "sensor.sam_s_air_monitor_airquality" },
      { room: "Tyler's", temp: "sensor.tyler_s_air_monitor_temperature", humidity: "sensor.tyler_s_air_monitor_humidity", aqi: "sensor.tyler_s_air_monitor_airquality" },
      { room: "Lucas's", temp: "sensor.lucqs_room_air_monitor_temperature", humidity: "sensor.lucqs_room_air_monitor_humidity", aqi: "sensor.lucqs_room_air_monitor_airquality" },
    ],
    // Plain hallway sensors (shown as simple cards).
    sensors: ["sensor.hallway_temperature", "sensor.hallway_humidity"],
    entities: [],
  },
  {
    id: "network",
    title: "Network",
    icon: "globe",
    group: "global",
    status: "live",
    kind: "sensor",
    entities: [
      "binary_sensor.firewalla_wan_status",
      "sensor.firewalla_external_ip",
      "sensor.firewalla_download_speed",
      "sensor.firewalla_upload_speed",
    ],
  },
  {
    id: "cameras",
    title: "Cameras",
    icon: "camera",
    group: "global",
    status: "live",
    kind: "cameras",
    // Confirmed from states dumps / YAML. Add more by pasting their IDs.
    cameras: [
      { id: "camera.entry_way_doorbell", name: "Entry Way Doorbell" },
      { id: "camera.rec_room_door_view", name: "Rec Room Door" },
      { id: "camera.rec_room_indoor_camera", name: "Rec Room Indoor" },
      // VERIFY/ADD: Patio, Cottage, Deck, Driveway, Living Room, Loft,
      // House Right Side — paste their entity IDs to enable.
    ],
    entities: [],
  },

  // ---------- ROOMS ----------
  {
    id: "rec_room",
    title: "Rec Room",
    icon: "sofa",
    group: "room",
    status: "live",
    kind: "control",
    // Grouped by control type so the panel can render the right widget.
    lights: {
      groups: [
        "light.all_rec_room_lights",
        "light.rec_room_lights",
        "light.rec_room_fridge_lights",
        "light.rec_room_floor_lamps",
        "light.rec_room_default_lighting",
        "light.back_rec_room_fan",
        "light.front_rec_room_fan",
        "light.fridge_lights",
      ],
      bulbs: [
        "light.fireplace_light",
        "light.fridge_1",
        "light.fridge_2",
        "light.fridge_3",
        "light.right_floor_lamp",
        "light.left_floor_lamp",
        "light.h6076_173d",
        "light.back_fan_bulb_1",
        "light.back_fan_bulb_2",
        "light.back_fan_bulb_3",
        "light.back_fan_bulb_4",
        "light.front_fan_bulb_1",
        "light.front_fan_bulb_2",
        "light.front_fan_bulb_3",
        "light.front_fan_bulb_4",
      ],
    },
    media: ["media_player.rec_room_google_tv", "media_player.rec_room_nest_hub"],
    purifier: {
      power: "switch.rec_room_air_purifier_power_switch",
      mode: "select.rec_room_air_purifier_mode",
    },

    // ---- Activities (home theater control via Broadlink + HA scripts) ----
    // All values verified against the user's "Family Mobile" HA dashboard YAML.
    activities: {
      // Default remote for commands that don't specify their own.
      remoteEntity: "remote.base_station",

      // ONE parameterized script launches any streaming app on the Google TV.
      streamingScript: "script.switch_to_google_tv",
      streaming: [
        { label: "Netflix", activity: "com.netflix.ninja" },
        { label: "YouTube", activity: "com.google.android.youtube.tv" },
        { label: "Prime Video", activity: "com.amazon.amazonvideo.livingroom" },
        { label: "Hulu", activity: "com.hulu.livingroomplus" },
        { label: "Disney+", activity: "com.disney.disneyplus" },
        { label: "Peacock", activity: "com.peacocktv.peacockandroid" },
        { label: "HBO Max", activity: "com.wbd.stream" },
        { label: "Apple TV", activity: "com.apple.atve.androidtv.appletv" },
        { label: "Vudu", activity: "air.com.vudu.air.DownloaderTablet" },
      ],

      // Quick Play: full macro commands on base_station (no `device` field).
      quickPlay: [
        { label: "PS5", command: "Play PS5" },
        { label: "Xbox", command: "Play Xbox" },
        { label: "Switch 2", command: "Play Switch 2" },
      ],

      // Navigation D-pad: these go to remote.rec_room_google_tv (not base).
      nav: {
        remote: "remote.rec_room_google_tv",
        // grid order matches the on-screen 3x3 layout
        home: { label: "Home", command: "HOME", icon: "home" },
        up: { label: "Up", command: "DPAD_UP", icon: "up" },
        left: { label: "Left", command: "DPAD_LEFT", icon: "left" },
        ok: { label: "OK", command: "ENTER", icon: "ok" },
        right: { label: "Right", command: "DPAD_RIGHT", icon: "right" },
        back: { label: "Back", command: "BACK", icon: "back" },
        down: { label: "Down", command: "DPAD_DOWN", icon: "down" },
        menu: { label: "Menu", command: "MENU", icon: "menu" },
        mute: { label: "TV Mute", command: "MUTE", icon: "mute" },
      },

      // Denon volume -> base_station with device: denon_receiver (verified).
      volume: [
        { label: "Vol −", device: "denon_receiver", command: "volume_down" },
        { label: "Mute", device: "denon_receiver", command: "mute" },
        { label: "Vol +", device: "denon_receiver", command: "volume_up" },
      ],

      // Individual power toggles -> base_station (verified).
      power: [
        { label: "TV", device: "tv", command: "power" },
        { label: "Denon", device: "denon_receiver", command: "power" },
      ],

      // Master off -> HA script.
      allOff: { label: "Turn Everything Off", script: "script.entertainment_off" },
    },

    // Flat list of everything this panel needs fetched from HA.
    entities: [],
  },
  { id: "kitchen", title: "Kitchen", icon: "kitchen", group: "room", status: "planned", kind: "control", entities: [] },
  { id: "living_room", title: "Living Room", icon: "sofa", group: "room", status: "planned", kind: "control", entities: [] },
  { id: "loft", title: "Loft", icon: "stairs", group: "room", status: "planned", kind: "control", entities: [] },
  { id: "master", title: "Master Bedroom", icon: "bed", group: "room", status: "planned", kind: "control", entities: [] },
  { id: "sam", title: "Sam's Room", icon: "bed", group: "room", status: "planned", kind: "control", entities: [] },
  {
    id: "lucas",
    title: "Lucas's Room",
    icon: "bed",
    group: "room",
    status: "live",
    kind: "control",
    lights: { groups: ["light.lucas_light"], bulbs: [] },
    entities: [],
  },
  {
    id: "tyler",
    title: "Tyler's Room",
    icon: "bed",
    group: "room",
    status: "live",
    kind: "control",
    // Note: YAML labels light.tyler_s_air_purifier as "Tyler's Purifier Light".
    lights: { groups: ["light.tyler_s_air_purifier"], bulbs: [] },
    entities: [],
  },
  { id: "cottage", title: "Cottage", icon: "home", group: "room", status: "planned", kind: "control", entities: [] },
  {
    id: "exterior",
    title: "Porch & Exterior",
    icon: "sun",
    group: "room",
    status: "live",
    kind: "control",
    lights: {
      groups: [
        "light.front_porch_light_1",
        "light.front_porch_light_2",
        "light.porch_light_1",
        "light.porch_light_2",
        "light.porch_light_4",
        "light.porch_light_5",
        "light.porch_light_7",
        "light.porch_light_8",
        "light.flood_lights",
        "light.spotlights_left",
        "light.spotlights_right",
      ],
      bulbs: [],
    },
    entities: [],
  },
  {
    id: "deck",
    title: "Deck",
    icon: "sun",
    group: "room",
    status: "live",
    kind: "control",
    lights: {
      groups: [
        "light.deck_lights",
        "light.deck_stairs",
        "light.grill_lights",
      ],
      bulbs: [],
    },
    entities: [],
  },
];

// Collect every entity_id a panel references, across both the flat
// `entities` list and the structured control groups (lights/media/purifier).
function entitiesForPanel(p) {
  const ids = [...(p.entities ?? [])];
  if (p.lights) ids.push(...(p.lights.groups ?? []), ...(p.lights.bulbs ?? []));
  if (p.media) ids.push(...p.media);
  if (p.purifier) ids.push(p.purifier.power, p.purifier.mode);
  // Climate panel
  if (p.thermostat) ids.push(p.thermostat);
  if (p.sensors) ids.push(...p.sensors);
  if (p.airMonitors) {
    for (const m of p.airMonitors) ids.push(m.temp, m.humidity, m.aqi);
  }
  return ids.filter(Boolean);
}

// All entity_ids the dashboard needs from HA, derived from the panels above.
// Put this list into server/config.js -> homeAssistant.entities so the
// backend only fetches what's actually shown.
export const ALL_ENTITIES = [
  ...new Set(PANELS.flatMap(entitiesForPanel)),
];

export { entitiesForPanel };
