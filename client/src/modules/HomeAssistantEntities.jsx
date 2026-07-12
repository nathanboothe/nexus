import { useState, useEffect, useCallback } from 'react';
import api from '../api.js';
import styles from './HomeAssistantEntities.module.css';

const POLL_INTERVAL_MS = 15000;

// Domains that support a simple on/off toggle via the generic homeassistant.toggle service
const TOGGLE_DOMAINS = new Set(['switch', 'fan', 'input_boolean', 'siren', 'humidifier']);

// Preferred tab order — domains not listed here appear after, alphabetically
const DOMAIN_ORDER = [
  'light', 'switch', 'lock', 'climate', 'cover', 'fan', 'media_player',
  'binary_sensor', 'sensor',
];

function domainOf(entityId) {
  return entityId.split('.')[0];
}

// Govee's HA bridges create per-segment sub-entities and combined "group"
// entities alongside the real physical devices — pure noise here.
const GOVEE_SEGMENT_PATTERN = /_segment_\d+$/;

function isNoiseEntity(entity) {
  const id = entity.entity_id;
  const domain = domainOf(id);

  // Dead entities left behind by removed/renamed integrations — not actionable
  if (entity.state === 'unavailable' || entity.state === 'unknown') return true;

  // Per-segment LED sub-entities (light.deck_lights_segment_001, etc.)
  if (GOVEE_SEGMENT_PATTERN.test(id)) return true;

  // Govee "group" entities combine several real devices into one virtual
  // entity — recognizable because their entity_id attribute is itself a list
  // of other entity ids, rather than a normal attribute value
  if (domain === 'light' && Array.isArray(entity.attributes?.entity_id)) return true;

  // Govee bridge diagnostic dumps duplicating state already shown elsewhere
  if (domain === 'sensor' && id.endsWith('_status') && entity.attributes?.platform_metadata) return true;

  // Noisy utility buttons with no useful action from this dashboard
  if (domain === 'button' && (id.endsWith('_request_platform_api_state') || id.endsWith('_favorite_current_song'))) {
    return true;
  }

  return false;
}

function friendlyDomainLabel(domain) {
  return domain
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

export default function HomeAssistantEntities() {
  const [entities, setEntities] = useState([]);
  const [error, setError] = useState('');
  const [activeDomain, setActiveDomain] = useState(null);

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
      setTimeout(load, 500); // let HA settle, then refresh
    } catch (err) {
      setError(err.message);
    }
  }

  const byDomain = entities.filter((e) => !isNoiseEntity(e)).reduce((acc, e) => {
    const d = domainOf(e.entity_id);
    acc[d] = acc[d] || [];
    acc[d].push(e);
    return acc;
  }, {});

  const domains = [
    ...DOMAIN_ORDER.filter((d) => byDomain[d]?.length),
    ...Object.keys(byDomain).filter((d) => !DOMAIN_ORDER.includes(d)).sort(),
  ];

  const current = activeDomain && byDomain[activeDomain] ? activeDomain : domains[0];

  function renderControls(entity) {
    const domain = domainOf(entity.entity_id);
    const isOn = entity.state === 'on' || entity.state === 'open' || entity.state === 'unlocked';

    if (domain === 'light') {
      const lightOn = entity.state === 'on';
      const modes = entity.attributes?.supported_color_modes || [];
      const supportsColor = modes.some((m) => ['rgb', 'hs', 'xy', 'rgbw', 'rgbww'].includes(m));
      const supportsBrightness = modes.some((m) => m !== 'onoff') || entity.attributes?.brightness != null;
      const brightnessPct = entity.attributes?.brightness != null
        ? Math.round((entity.attributes.brightness / 255) * 100)
        : 100;
      const [r, g, b] = entity.attributes?.rgb_color || [255, 255, 255];
      const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

      return (
        <div className={styles.lightControls}>
          <button
            className={lightOn ? styles.toggleOn : styles.toggleOff}
            onClick={() => callService('light', lightOn ? 'turn_off' : 'turn_on', { entity_id: entity.entity_id })}
          >
            {lightOn ? 'On' : 'Off'}
          </button>
          {supportsBrightness && (
            <input
              type="range"
              min="1"
              max="100"
              defaultValue={brightnessPct}
              onMouseUp={(e) => callService('light', 'turn_on', { entity_id: entity.entity_id, brightness_pct: Number(e.target.value) })}
              onTouchEnd={(e) => callService('light', 'turn_on', { entity_id: entity.entity_id, brightness_pct: Number(e.target.value) })}
            />
          )}
          {supportsColor && (
            <input
              type="color"
              defaultValue={hex}
              className={styles.colorPicker}
              onChange={(e) => {
                const hx = e.target.value;
                const rr = parseInt(hx.slice(1, 3), 16);
                const gg = parseInt(hx.slice(3, 5), 16);
                const bb = parseInt(hx.slice(5, 7), 16);
                callService('light', 'turn_on', { entity_id: entity.entity_id, rgb_color: [rr, gg, bb] });
              }}
            />
          )}
        </div>
      );
    }

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
      return (
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
        {domains.map((d) => (
          <button
            key={d}
            className={d === current ? styles.tabActive : styles.tab}
            onClick={() => setActiveDomain(d)}
          >
            {friendlyDomainLabel(d)} <span className={styles.tabCount}>{byDomain[d].length}</span>
          </button>
        ))}
      </div>

      {current && (
        <div className={styles.grid}>
          {byDomain[current]
            .slice()
            .sort((a, b) => (a.attributes?.friendly_name || a.entity_id).localeCompare(b.attributes?.friendly_name || b.entity_id))
            .map((entity) => (
              <div key={entity.entity_id} className={styles.card}>
                <div className={styles.cardName}>{entity.attributes?.friendly_name || entity.entity_id}</div>
                {renderControls(entity)}
              </div>
            ))}
        </div>
      )}

      {domains.length === 0 && !error && <div className={styles.loading}>Loading entities…</div>}
    </div>
  );
}
