import { useState, useEffect, useCallback } from 'react';
import api from '../api.js';
import styles from './HomeAssistantEntities.module.css';

const POLL_INTERVAL_MS = 15000;

const TOGGLE_DOMAINS = new Set(['switch', 'fan', 'input_boolean', 'siren', 'humidifier']);

function domainOf(entityId) {
  return entityId.split('.')[0];
}

function nameOf(entity) {
  return entity.attributes?.friendly_name || entity.entity_id;
}

// Govee's HA bridges create per-segment sub-entities alongside real devices — pure noise.
const GOVEE_SEGMENT_PATTERN = /_segment_\d+$/;

// Exact-name exclusions — duplicate/dead/irrelevant cards confirmed not wanted here
const EXCLUDE_EXACT_NAMES = new Set([
  '85" QLED',
  'Home Theater',
  'XBOX Series X',
  'Remote UI',
]);

// Prefix exclusions
const EXCLUDE_PREFIXES = ['Lucas iPhone', 'SM-F766U1', 'Sun'];

function isNoiseEntity(entity) {
  const id = entity.entity_id;
  const domain = domainOf(id);
  const name = nameOf(entity);

  if (entity.state === 'unavailable' || entity.state === 'unknown') return true;
  if (domain === 'light') return true;
  if (GOVEE_SEGMENT_PATTERN.test(id)) return true;
  if (domain === 'sensor' && id.endsWith('_status') && entity.attributes?.platform_metadata) return true;
  if (domain === 'button' && (id.endsWith('_request_platform_api_state') || id.endsWith('_favorite_current_song'))) return true;

  // All power switches except the one explicitly kept
  if (domain === 'switch' && id.endsWith('_power_switch') && id !== 'switch.wiz_socket_c095c5') return true;

  if (EXCLUDE_EXACT_NAMES.has(name)) return true;
  if (EXCLUDE_PREFIXES.some((p) => name.startsWith(p))) return true;

  return false;
}

// Room assignment — first matching rule wins. Anything unmatched falls into "Other".
const ROOM_RULES = [
  { test: (n) => n.startsWith('Firewalla'), room: 'Network Core' },
  { test: (n) => n.startsWith('Hallway'), room: 'Upstairs Hallway' },
  { test: (n) => n.startsWith('Loft'), room: 'Loft' },
  { test: (n) => n.startsWith('Lucas'), room: "Lucas's Room" },
  { test: (n) => n.startsWith('Rec Room'), room: 'Rec Room' },
  { test: (n) => n.startsWith('Sam'), room: "Sam's Room" },
  { test: (n) => n.startsWith('Tyler'), room: 'Cottage' }, // was "Tyler's Room"
];

const ROOM_ORDER = ['Rec Room', "Lucas's Room", "Sam's Room", 'Cottage', 'Loft', 'Upstairs Hallway', 'Network Core'];

function roomOf(entity) {
  const name = nameOf(entity);
  const match = ROOM_RULES.find((r) => r.test(name));
  return match ? match.room : 'Other';
}

// Card display name override — e.g. the Hallway thermostat is labeled "Thermostat"
function displayName(entity) {
  const name = nameOf(entity);
  if (name === 'Hallway') return 'Thermostat';
  return name;
}

export default function HomeAssistantEntities() {
  const [entities, setEntities] = useState([]);
  const [error, setError] = useState('');
  const [activeRoom, setActiveRoom] = useState(null);

  const load = useCallback(async () => {
    try {
      const states = await api('/ha/states');
      setEntities(states);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [load]);

  async function callService(domain, service, data) {
    try {
      await api('/ha/service', 'POST', { domain, service, data });
      setTimeout(load, 500);
    } catch (err) {
      setError(err.message);
    }
  }

  const byRoom = entities.filter((e) => !isNoiseEntity(e)).reduce((acc, e) => {
    const r = roomOf(e);
    acc[r] = acc[r] || [];
    acc[r].push(e);
    return acc;
  }, {});

  const rooms = [
    ...ROOM_ORDER.filter((r) => byRoom[r]?.length),
    ...Object.keys(byRoom).filter((r) => !ROOM_ORDER.includes(r)).sort(),
  ];

  const current = activeRoom && byRoom[activeRoom] ? activeRoom : rooms[0];

  function renderControls(entity) {
    const domain = domainOf(entity.entity_id);
    const isOn = entity.state === 'on' || entity.state === 'open' || entity.state === 'unlocked';

    if (TOGGLE_DOMAINS.has(domain)) {
      return (
        <button
          className={isOn ? styles.toggleOn : styles.toggleOff}
          onClick={() => callService('homeassistant', 'toggle', { entity_id: entity.entity_id })}
        >
          {isOn ? 'On' : 'Off'}
        </button>
      );
    }

    if (domain === 'lock') {
      return (
        <button
          className={isOn ? styles.toggleOn : styles.toggleOff}
          onClick={() => callService('lock', isOn ? 'lock' : 'unlock', { entity_id: entity.entity_id })}
        >
          {isOn ? 'Unlocked' : 'Locked'}
        </button>
      );
    }

    if (domain === 'cover') {
      return (
        <div className={styles.coverBtns}>
          <button className={styles.smallBtn} onClick={() => callService('cover', 'open_cover', { entity_id: entity.entity_id })}>Open</button>
          <button className={styles.smallBtn} onClick={() => callService('cover', 'close_cover', { entity_id: entity.entity_id })}>Close</button>
          <button className={styles.smallBtn} onClick={() => callService('cover', 'stop_cover', { entity_id: entity.entity_id })}>Stop</button>
        </div>
      );
    }

    if (domain === 'climate') {
      const target = entity.attributes?.temperature;
      const hvacModes = entity.attributes?.hvac_modes || [];
      const fanModes = entity.attributes?.fan_modes || [];
      const presetModes = entity.attributes?.preset_modes || [];

      return (
        <div className={styles.climateBlock}>
          <div className={styles.climateBtns}>
            <button
              className={styles.smallBtn}
              onClick={() => callService('climate', 'set_temperature', { entity_id: entity.entity_id, temperature: (target ?? 70) - 1 })}
            >−</button>
            <span className={styles.climateTemp}>{target ?? '—'}°</span>
            <button
              className={styles.smallBtn}
              onClick={() => callService('climate', 'set_temperature', { entity_id: entity.entity_id, temperature: (target ?? 70) + 1 })}
            >+</button>
          </div>
          {hvacModes.length > 0 && (
            <select
              className={styles.selectCtrl}
              value={entity.state}
              onChange={(e) => callService('climate', 'set_hvac_mode', { entity_id: entity.entity_id, hvac_mode: e.target.value })}
            >
              {hvacModes.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          {fanModes.length > 0 && (
            <select
              className={styles.selectCtrl}
              value={entity.attributes?.fan_mode || ''}
              onChange={(e) => callService('climate', 'set_fan_mode', { entity_id: entity.entity_id, fan_mode: e.target.value })}
            >
              {fanModes.map((m) => <option key={m} value={m}>Fan: {m}</option>)}
            </select>
          )}
          {presetModes.length > 0 && (
            <select
              className={styles.selectCtrl}
              value={entity.attributes?.preset_mode || ''}
              onChange={(e) => callService('climate', 'set_preset_mode', { entity_id: entity.entity_id, preset_mode: e.target.value })}
            >
              {presetModes.map((m) => <option key={m} value={m}>Preset: {m}</option>)}
            </select>
          )}
        </div>
      );
    }

    if (domain === 'media_player') {
      return (
        <button className={styles.smallBtn} onClick={() => callService('media_player', 'media_play_pause', { entity_id: entity.entity_id })}>
          Play/Pause
        </button>
      );
    }

    // Read-only fallback (sensor, binary_sensor, sun, weather, person, etc.)
    const unit = entity.attributes?.unit_of_measurement;
    return <span className={styles.readout}>{entity.state}{unit ? ` ${unit}` : ''}</span>;
  }

  return (
    <div className={styles.page}>
      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.tabs}>
        {rooms.map((r) => (
          <button
            key={r}
            className={r === current ? styles.tabActive : styles.tab}
            onClick={() => setActiveRoom(r)}
          >
            {r} <span className={styles.tabCount}>{byRoom[r].length}</span>
          </button>
        ))}
      </div>

      {current && (
        <div className={styles.grid}>
          {byRoom[current]
            .slice()
            .sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
            .map((entity) => (
              <div key={entity.entity_id} className={styles.card}>
                <div className={styles.cardName}>{displayName(entity)}</div>
                {renderControls(entity)}
              </div>
            ))}
        </div>
      )}

      {rooms.length === 0 && !error && <div className={styles.loading}>Loading entities…</div>}
    </div>
  );
}
