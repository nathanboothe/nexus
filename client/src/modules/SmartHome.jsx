import { useState, useEffect, useCallback, Component } from 'react';
import api from '../api.js';
import styles from './SmartHome.module.css';

// Catches render-time errors in the wrapped section only, so a bad entity
// shape can't blank the whole page the way it just did.
class SectionErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('SmartHome section crashed:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className={styles.error}>
          This section hit an error: {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}

// Govee cloud API caps at 10,000 requests/day — keep this long
const GOVEE_POLL_INTERVAL_MS = 300000;
// HA's own REST API has no comparable daily cap — safe to poll much faster
const HA_POLL_INTERVAL_MS = 15000;

// ── ROOM INFERENCE ──────────────────────────────────────────────────────────
// 1. Manual overrides always win — fix a misclassified entity here in one line.
// 2. Otherwise use the area HA already reports on the entity (attributes.area_id).
// 3. Otherwise match an unambiguous keyword in the entity_id.
// 4. Otherwise "Unassigned" — same convention the Lights section above uses.
const ROOM_OVERRIDES = {
  // 'light.deck_lights': 'Backyard',
  // 'switch.dog_closet_power_switch': 'Rec Room',
};

const ROOM_KEYWORDS = [
  ['rec_room', 'Rec Room'],
  ['loft', 'Loft'],
  ['frontyard', 'Frontyard'],
  ['backyard', 'Backyard'],
  ['porch', 'Porch'],
  ['cottage', 'Cottage'],
  ['tyler_s', 'Cottage'],
  ['lucas', "Lucas's Room"],
  ['sam_s_', "Sam's Bedroom"],
  ['sam_bedroom', "Sam's Bedroom"],
  ['master_bedroom', 'Master Bedroom'],
  ['entry_way', 'Entryway'],
  ['entryway', 'Entryway'],
  ['patio', 'Patio'],
  ['kitchen', 'Kitchen'],
  ['living_room', 'Living Room'],
  ['outdoor', 'Outdoors'],
];

function deriveRoom(entity) {
  if (ROOM_OVERRIDES[entity.entity_id]) return ROOM_OVERRIDES[entity.entity_id];
  if (entity.attributes?.area_id) return entity.attributes.area_id;
  const haystack = entity.entity_id.toLowerCase();
  for (const [keyword, room] of ROOM_KEYWORDS) {
    if (haystack.includes(keyword)) return room;
  }
  return 'Unassigned';
}

// Keeps room-grouped sections in a consistent order, with Unassigned last.
function roomSortKey(a, b) {
  if (a === 'Unassigned') return 1;
  if (b === 'Unassigned') return -1;
  return a.localeCompare(b);
}

// ── GOVEE LIGHTS ROOM MAPPING ────────────────────────────────────────────
// Built from the light-domain rows of your HA entity export, so Govee cloud
// devices land in the same rooms as everything else instead of relying on
// Govee's own "Room - Fixture" app naming (still used as a fallback below
// for any device not in this table). Matched case-insensitively against
// the Govee cloud deviceName.
const GOVEE_NAME_TO_ROOM = {
  'back fan bulb 1': 'Rec Room',
  'back fan bulb 2': 'Rec Room',
  'back fan bulb 3': 'Rec Room',
  'back fan bulb 4': 'Rec Room',
  'back rec room fan': 'Rec Room',
  'fireplace light': 'Rec Room',
  'flood lights': 'Backyard',
  'fridge 1': 'Rec Room',
  'fridge 2': 'Rec Room',
  'fridge 3': 'Rec Room',
  'fridge lights': 'Rec Room',
  'front fan bulb 1': 'Rec Room',
  'front fan bulb 2': 'Rec Room',
  'front fan bulb 3': 'Rec Room',
  'front fan bulb 4': 'Rec Room',
  'front porch light 1': 'Entryway',
  'front porch light 2': 'Entryway',
  'front rec room fan': 'Rec Room',
  'grill lights': 'Patio',
  'left floor lamp': 'Rec Room',
  'spotlights right': 'Frontyard',
  'spotlights left': 'Frontyard',
  'curtain lights': 'Frontyard',
  'lucas light': "Lucas's Room",
  'porch light 1': 'Porch',
  'porch light 2': 'Porch',
  'porch light 4': 'Porch',
  'porch light 5': 'Porch',
  'porch light 7': 'Porch',
  'porch light 8': 'Porch',
  'rec room floor lamps': 'Rec Room',
  'rec room fridge lights': 'Rec Room',
  'rec room lights': 'Rec Room',
  'right floor lamp': 'Rec Room',
  "tyler's air purifier": 'Cottage',
};

// These three had no area AND no room keyword anywhere in the CSV export —
// genuinely no location info to go on. Fill in here (or tell me the room
// and I'll add it) rather than have me guess wrong.
const GOVEE_ROOM_OVERRIDES = {
  // 'Deck Lights': 'Backyard',
  // 'Deck Stairs': 'Backyard',
  // 'Dog Closet': 'Rec Room',
};

function deriveGoveeRoom(deviceName) {
  const name = (deviceName || 'Unknown').trim();
  if (GOVEE_ROOM_OVERRIDES[name]) return GOVEE_ROOM_OVERRIDES[name];

  const known = GOVEE_NAME_TO_ROOM[name.toLowerCase()];
  if (known) return known;

  // Legacy Govee-app convention: "Room - Fixture"
  const parts = name.split(' - ');
  if (parts.length > 1) return parts[0];

  const haystack = name.toLowerCase();
  for (const [keyword, room] of ROOM_KEYWORDS) {
    if (haystack.includes(keyword.replace(/_/g, ' '))) return room;
  }

  return 'Unassigned';
}

// ── TYPE / CATEGORY CLASSIFICATION ──────────────────────────────────────────
const TYPE_LABELS = {
  switch: 'Switches',
  climate: 'Climate',
  media_player: 'Media Players',
  camera: 'Cameras',
  select: 'Air Purifier Modes',
  reading: 'Air Quality & Climate Sensors',
  utility: 'Network & Utilities',
};

const TYPE_ORDER = ['switch', 'climate', 'media_player', 'camera', 'select', 'reading', 'utility'];

// Already covered elsewhere: lights (Govee section above), remotes (Rec Room
// page), scripts/events (automations, not device controls).
const EXCLUDED_DOMAINS = new Set(['light', 'remote', 'script', 'event']);

function classify(entity) {
  const domain = entity.entity_id.split('.')[0];
  if (EXCLUDED_DOMAINS.has(domain)) return null;

  if (domain === 'sensor') {
    // "_status" sensors are just Available/Unavailable/Unknown per-device
    // heartbeats — folded into a dot on the matching switch card instead.
    if (/_status(_\d+)?$/.test(entity.entity_id)) return null;
    if (/temperature|humidity|airquality|filterlifetime/i.test(entity.entity_id)) return 'reading';
    return 'utility'; // firewalla, printer, govee-to-mqtt version, etc.
  }
  if (domain === 'binary_sensor') return 'utility';
  if (['switch', 'climate', 'media_player', 'camera', 'select'].includes(domain)) return domain;
  return 'utility';
}

const DOMAIN_SORT_PRIORITY = ['switch', 'climate', 'media_player', 'camera', 'select', 'sensor', 'binary_sensor'];

function sortEntities(list) {
  return [...list].sort((a, b) => {
    const da = a.entity_id.split('.')[0];
    const db = b.entity_id.split('.')[0];
    const pa = DOMAIN_SORT_PRIORITY.indexOf(da);
    const pb = DOMAIN_SORT_PRIORITY.indexOf(db);
    if (pa !== pb) return pa - pb;
    const na = a.attributes?.friendly_name || a.entity_id;
    const nb = b.attributes?.friendly_name || b.entity_id;
    return na.localeCompare(nb);
  });
}

function orderedGroupEntries(grouped, viewMode) {
  if (viewMode === 'type') {
    return TYPE_ORDER.filter((k) => grouped[k]?.length).map((k) => [TYPE_LABELS[k], grouped[k]]);
  }
  const rooms = Object.keys(grouped).sort(roomSortKey);
  return rooms.map((r) => [r, grouped[r]]);
}

// ── AVAILABILITY DOTS (switches only) ───────────────────────────────────────
function buildAvailabilityMap(allStates) {
  const map = {};
  for (const s of allStates) {
    if (s.entity_id.startsWith('sensor.') && /_status(_\d+)?$/.test(s.entity_id)) {
      const base = s.entity_id.replace(/^sensor\./, '').replace(/_status(_\d+)?$/, '');
      map[base] = s.state;
    }
  }
  return map;
}

function availabilityFor(entity, availabilityMap) {
  if (!entity.entity_id.startsWith('switch.')) return null;
  const base = entity.entity_id
    .replace('switch.', '')
    .replace(/_power_switch$/, '')
    .replace(/_gradient_toggle$/, '')
    .replace(/_dream_view_toggle$/, '')
    .replace(/_nightlight_toggle$/, '');
  return availabilityMap[base] ?? null;
}

function dotColor(availability) {
  if (availability === 'Available') return '#4caf50';
  if (availability === 'Unavailable') return '#e05252';
  return '#666';
}

function parseSensorValue(state) {
  if (typeof state === 'string' && state.startsWith('{')) {
    try {
      const parsed = JSON.parse(state);
      return parsed.value ?? state;
    } catch {
      return state;
    }
  }
  return state;
}

function sensorUnit(entityId) {
  if (/temperature/i.test(entityId)) return '°F';
  if (/humidity/i.test(entityId)) return '%';
  if (/filterlifetime/i.test(entityId)) return '% filter life';
  return '';
}

// ── PER-DOMAIN CONTROLS ──────────────────────────────────────────────────────
function SwitchControls({ entity, onAction }) {
  const isOn = entity.state === 'on';
  return (
    <button
      className={styles.btn}
      onClick={() => onAction('switch', isOn ? 'turn_off' : 'turn_on', entity.entity_id)}
    >
      {isOn ? 'Turn Off' : 'Turn On'}
    </button>
  );
}

function ClimateControls({ entity, onAction }) {
  if (entity.state === 'unavailable') {
    return <div className={styles.reading}>Unavailable</div>;
  }
  const current = entity.attributes?.current_temperature;
  const target = entity.attributes?.temperature;
  return (
    <div className={styles.cardControls}>
      {current != null && <span className={styles.reading}>Now: {current}°</span>}
      {target != null && (
        <>
          <button
            className={styles.btn}
            onClick={() => onAction('climate', 'set_temperature', entity.entity_id, { temperature: target - 1 })}
          >
            −
          </button>
          <span className={styles.reading}>{target}°</span>
          <button
            className={styles.btn}
            onClick={() => onAction('climate', 'set_temperature', entity.entity_id, { temperature: target + 1 })}
          >
            +
          </button>
        </>
      )}
    </div>
  );
}

function MediaControls({ entity, onAction }) {
  const state = entity.state;
  if (state === 'unavailable') {
    return <div className={styles.reading}>Unavailable</div>;
  }
  if (state === 'off') {
    return (
      <button className={styles.btn} onClick={() => onAction('media_player', 'turn_on', entity.entity_id)}>
        Turn On
      </button>
    );
  }
  return (
    <div className={styles.cardControls}>
      <button className={styles.btn} onClick={() => onAction('media_player', 'media_play_pause', entity.entity_id)}>
        {state === 'playing' ? 'Pause' : 'Play'}
      </button>
      <button className={styles.btn} onClick={() => onAction('media_player', 'turn_off', entity.entity_id)}>
        Turn Off
      </button>
    </div>
  );
}

function SelectControls({ entity, onAction }) {
  const options = entity.attributes?.options || [];
  if (!options.length) return <div className={styles.reading}>{entity.state}</div>;
  return (
    <select
      className={styles.select}
      value={entity.state}
      onChange={(e) => onAction('select', 'select_option', entity.entity_id, { option: e.target.value })}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function ReadingDisplay({ entity }) {
  const value = parseSensorValue(entity.state);
  return (
    <div className={styles.reading}>
      {value}
      {sensorUnit(entity.entity_id)}
    </div>
  );
}

// Cameras poll on a 2s interval only while "Live" is toggled on for that
// specific card — polling all cameras constantly regardless of visibility
// isn't worth the bandwidth. NOTE: image URL assumes an '/api' base prefix,
// matching the pattern your other routers use — adjust if that's wrong.
function CameraCard({ entity }) {
  const [live, setLive] = useState(false);
  const [src, setSrc] = useState(`/api/ha/camera/${entity.entity_id}?t=${Date.now()}`);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      setSrc(`/api/ha/camera/${entity.entity_id}?t=${Date.now()}`);
    }, 2000);
    return () => clearInterval(id);
  }, [live, entity.entity_id]);

  return (
    <div>
      <img
        src={src}
        alt={entity.attributes?.friendly_name || entity.entity_id}
        className={styles.cameraImg}
        onError={(e) => {
          e.currentTarget.style.opacity = 0.3;
        }}
      />
      <button className={styles.btn} onClick={() => setLive((v) => !v)}>
        {live ? 'Stop Live' : 'Go Live'}
      </button>
    </div>
  );
}

function EntityCard({ entity, availabilityMap, onAction }) {
  const domain = entity.entity_id.split('.')[0];
  const availability = availabilityFor(entity, availabilityMap);

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        {availability != null && (
          <span className={styles.dot} style={{ background: dotColor(availability) }} />
        )}
        <span className={styles.cardName}>{entity.attributes?.friendly_name || entity.entity_id}</span>
      </div>
      {domain === 'switch' && <SwitchControls entity={entity} onAction={onAction} />}
      {domain === 'climate' && <ClimateControls entity={entity} onAction={onAction} />}
      {domain === 'media_player' && <MediaControls entity={entity} onAction={onAction} />}
      {domain === 'camera' && <CameraCard entity={entity} />}
      {domain === 'select' && <SelectControls entity={entity} onAction={onAction} />}
      {(domain === 'sensor' || domain === 'binary_sensor') && <ReadingDisplay entity={entity} />}
    </div>
  );
}

export default function SmartHome() {
  // ── Govee cloud lights (unchanged) ──
  const [devices, setDevices] = useState([]);
  const [error, setError] = useState('');

  const loadDevices = useCallback(async () => {
    try {
      const list = await api('/govee/devices');
      if (!Array.isArray(list)) {
        setDevices([]);
        setError(`Unexpected response from /govee/devices: ${JSON.stringify(list).slice(0, 200)}`);
        return;
      }
      setDevices(list);
      setError('');
    } catch (err) {
      setDevices([]);
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadDevices();
    const id = setInterval(loadDevices, GOVEE_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [loadDevices]);

  async function toggle(device, on) {
    try {
      await api('/govee/control', 'POST', {
        device: device.device,
        model: device.model,
        cmd: { name: 'turn', value: on ? 'on' : 'off' },
      });
    } catch (err) {
      setError(err.message);
    }
  }

  async function setBrightness(device, value) {
    try {
      await api('/govee/control', 'POST', {
        device: device.device,
        model: device.model,
        cmd: { name: 'brightness', value },
      });
    } catch (err) {
      setError(err.message);
    }
  }

  const rooms = devices.reduce((acc, d) => {
    const label = deriveGoveeRoom(d.deviceName);
    acc[label] = acc[label] || [];
    acc[label].push(d);
    return acc;
  }, {});

  // ── HA-sourced "All Devices" section (new) ──
  const [haStates, setHaStates] = useState([]);
  const [haError, setHaError] = useState('');
  const [viewMode, setViewMode] = useState('room');

  const loadHaStates = useCallback(async () => {
    try {
      const states = await api('/ha/states');
      if (!Array.isArray(states)) {
        setHaStates([]);
        setHaError(`Unexpected response from /ha/states: ${JSON.stringify(states).slice(0, 200)}`);
        return;
      }
      setHaStates(states);
      setHaError('');
    } catch (err) {
      setHaStates([]);
      setHaError(err.message);
    }
  }, []);

  useEffect(() => {
    loadHaStates();
    const id = setInterval(loadHaStates, HA_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [loadHaStates]);

  async function handleAction(domain, service, entityId, data = {}) {
    try {
      await api('/ha/service', 'POST', {
        domain,
        service,
        data: { entity_id: entityId, ...data },
      });
      setTimeout(loadHaStates, 800);
    } catch (err) {
      setHaError(err.message);
    }
  }

  const relevantEntities = haStates.filter((e) => classify(e) !== null);
  const availabilityMap = buildAvailabilityMap(haStates);
  const grouped = relevantEntities.reduce((acc, entity) => {
    const key = viewMode === 'room' ? deriveRoom(entity) : classify(entity);
    acc[key] = acc[key] || [];
    acc[key].push(entity);
    return acc;
  }, {});

  return (
    <div className={styles.page}>
      {/* ── LIGHTS (Govee cloud) ── */}
      {error && <div className={styles.error}>{error}</div>}
      {devices.length === 0 && !error && <div className={styles.loading}>Loading devices…</div>}
      {Object.entries(rooms).sort(([a], [b]) => roomSortKey(a, b)).map(([room, roomDevices]) => (
        <section key={room} className={styles.section}>
          <h2>{room}</h2>
          <div className={styles.grid}>
            {roomDevices.map((d) => (
              <div key={d.device} className={styles.card}>
                <div className={styles.cardName}>{d.deviceName}</div>
                <div className={styles.cardControls}>
                  <button className={styles.btn} onClick={() => toggle(d, true)}>On</button>
                  <button className={styles.btn} onClick={() => toggle(d, false)}>Off</button>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  defaultValue="100"
                  onMouseUp={(e) => setBrightness(d, Number(e.target.value))}
                  onTouchEnd={(e) => setBrightness(d, Number(e.target.value))}
                />
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* ── ALL DEVICES (Home Assistant, grouped by Room or Type) ── */}
      <SectionErrorBoundary>
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>All Devices</h2>
            <div className={styles.headerControls}>
              <select
                className={styles.select}
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
              >
                <option value="room">Group by Room</option>
                <option value="type">Group by Type</option>
              </select>
              <button className={styles.btn} onClick={loadHaStates} title="Refresh">⟳</button>
            </div>
          </div>

          {haError && <div className={styles.error}>{haError}</div>}
          {!haStates.length && !haError && <div className={styles.loading}>Loading devices…</div>}

          {orderedGroupEntries(grouped, viewMode).map(([label, entities]) => (
            <div key={label} className={styles.subsection}>
              <h3>{label}</h3>
              <div className={styles.grid}>
                {sortEntities(entities).map((entity) => (
                  <EntityCard
                    key={entity.entity_id}
                    entity={entity}
                    availabilityMap={availabilityMap}
                    onAction={handleAction}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      </SectionErrorBoundary>
    </div>
  );
}
