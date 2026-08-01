import { useState, useEffect, useCallback, Component } from 'react';
import api from '../api.js';
import styles from './SmartHome.module.css';
import { SMART_HOME_ENTITIES } from './entityConfig.js';

// HA's own REST API has no daily cap — safe to poll fairly often
const HA_POLL_INTERVAL_MS = 15000;

// Cards per "screen" within a section/location. This is a tuned guess for a
// tablet/Skylight-landscape viewport with the dense row card style below —
// check it against the real device and adjust up/down if a page ever clips
// content or leaves too much empty space.
const ENTITIES_PER_PAGE = 24;

// Catches render-time errors in the wrapped section only, so a bad entity
// shape can't blank the whole page.
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
      return <div className={styles.error}>This section hit an error: {this.state.error.message}</div>;
    }
    return this.props.children;
  }
}

// Order sections appear in on "By Section" — edit to reorder.
const SECTION_ORDER = ['Lights', 'Climate', 'Cameras', 'Reciever', 'Speaker', 'Google TV', 'Power', 'Network Backend'];

const DOMAIN_SORT_PRIORITY = ['light', 'switch', 'climate', 'media_player', 'camera', 'select', 'binary_sensor', 'sensor', 'event'];

function sortEntities(list) {
  return [...list].sort((a, b) => {
    const da = a.id.split('.')[0];
    const db = b.id.split('.')[0];
    const pa = DOMAIN_SORT_PRIORITY.indexOf(da);
    const pb = DOMAIN_SORT_PRIORITY.indexOf(db);
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });
}

function sortBuckets(keys, lastLabel) {
  return [...keys].sort((a, b) => {
    if (a === lastLabel) return 1;
    if (b === lastLabel) return -1;
    return a.localeCompare(b);
  });
}

function groupBySection(entities) {
  const bySection = {};
  for (const e of entities) {
    bySection[e.section] = bySection[e.section] || {};
    const g = e.group || 'General';
    bySection[e.section][g] = bySection[e.section][g] || [];
    bySection[e.section][g].push(e);
  }
  return bySection;
}

function groupByLocation(entities) {
  const map = {};
  for (const e of entities) {
    const key = e.location || 'Unspecified';
    map[key] = map[key] || [];
    map[key].push(e);
  }
  return map;
}

// Splits a section's { groupName: entities[] } into "screens" that each stay
// under ENTITIES_PER_PAGE cards, keeping whole groups together where
// possible so a group's header doesn't get orphaned from its cards. A single
// group larger than one page (e.g. every Light) gets chunked on its own
// page(s) rather than forcing everything else onto extra screens too.
function paginateGroups(groupEntries, perPage) {
  const pages = [];
  let current = [];
  let currentCount = 0;

  for (const [groupName, ents] of groupEntries) {
    const sorted = sortEntities(ents);

    if (sorted.length > perPage) {
      if (current.length) {
        pages.push(current);
        current = [];
        currentCount = 0;
      }
      for (let i = 0; i < sorted.length; i += perPage) {
        const chunk = sorted.slice(i, i + perPage);
        pages.push([[i > 0 ? `${groupName} (cont.)` : groupName, chunk]]);
      }
      continue;
    }

    if (current.length && currentCount + sorted.length > perPage) {
      pages.push(current);
      current = [];
      currentCount = 0;
    }
    current.push([groupName, sorted]);
    currentCount += sorted.length;
  }

  if (current.length) pages.push(current);
  return pages.length ? pages : [[]];
}

// ── COLOR HELPERS ───────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(rgb) {
  if (!Array.isArray(rgb) || rgb.length < 3) return '#ffffff';
  return '#' + rgb.slice(0, 3).map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

// ── PER-DOMAIN CONTROLS ──────────────────────────────────────────────────────
function LightControls({ id, live, color, onAction }) {
  const isOn = live.state === 'on';
  const brightnessPct = live.attributes?.brightness != null
    ? Math.round((live.attributes.brightness / 255) * 100)
    : 100;
  const [hex, setHex] = useState(rgbToHex(live.attributes?.rgb_color));

  return (
    <div className={styles.cardControls}>
      <button className={styles.btn} onClick={() => onAction('light', isOn ? 'turn_off' : 'turn_on', id)}>
        {isOn ? 'Off' : 'On'}
      </button>
      {isOn && (
        <input
          type="range"
          min="1"
          max="100"
          defaultValue={brightnessPct}
          onMouseUp={(e) => onAction('light', 'turn_on', id, { brightness_pct: Number(e.target.value) })}
          onTouchEnd={(e) => onAction('light', 'turn_on', id, { brightness_pct: Number(e.target.value) })}
        />
      )}
      {color && (
        <div className={styles.colorRow}>
          <input
            type="color"
            className={styles.colorInput}
            value={hex}
            onChange={(e) => setHex(e.target.value)}
          />
          <button className={styles.btn} onClick={() => onAction('light', 'turn_on', id, { rgb_color: hexToRgb(hex) })}>
            Set
          </button>
        </div>
      )}
    </div>
  );
}

function SwitchControls({ id, live, onAction }) {
  const isOn = live.state === 'on';
  return (
    <button className={styles.btn} onClick={() => onAction('switch', isOn ? 'turn_off' : 'turn_on', id)}>
      {isOn ? 'Turn Off' : 'Turn On'}
    </button>
  );
}

function ClimateControls({ id, live, onAction }) {
  if (live.state === 'unavailable') {
    return <div className={styles.reading}>Unavailable</div>;
  }
  const current = live.attributes?.current_temperature;
  const target = live.attributes?.temperature;
  return (
    <div className={styles.cardControls}>
      {current != null && <span className={styles.reading}>Now: {current}°</span>}
      {target != null && (
        <>
          <button className={styles.btn} onClick={() => onAction('climate', 'set_temperature', id, { temperature: target - 1 })}>−</button>
          <span className={styles.reading}>{target}°</span>
          <button className={styles.btn} onClick={() => onAction('climate', 'set_temperature', id, { temperature: target + 1 })}>+</button>
        </>
      )}
    </div>
  );
}

function MediaControls({ id, live, onAction }) {
  const state = live.state;
  if (state === 'unavailable') {
    return <div className={styles.reading}>Unavailable</div>;
  }
  if (state === 'off') {
    return (
      <button className={styles.btn} onClick={() => onAction('media_player', 'turn_on', id)}>
        Turn On
      </button>
    );
  }
  return (
    <div className={styles.cardControls}>
      <button className={styles.btn} onClick={() => onAction('media_player', 'media_play_pause', id)}>
        {state === 'playing' ? 'Pause' : 'Play'}
      </button>
      <button className={styles.btn} onClick={() => onAction('media_player', 'turn_off', id)}>
        Off
      </button>
    </div>
  );
}

function SelectControls({ id, live, onAction }) {
  const options = live.attributes?.options || [];
  if (!options.length) return <div className={styles.reading}>{live.state}</div>;
  return (
    <select
      className={styles.select}
      value={live.state}
      onChange={(e) => onAction('select', 'select_option', id, { option: e.target.value })}
    >
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
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

function ReadingDisplay({ id, live }) {
  if (/_status(_\d+)?$/.test(id)) {
    const color = live.state === 'Available' ? 'var(--success)' : live.state === 'Unavailable' ? 'var(--danger)' : 'var(--text-secondary)';
    return <div className={styles.reading} style={{ color }}>{live.state}</div>;
  }
  const value = parseSensorValue(live.state);
  return (
    <div className={styles.reading}>
      {value}
      {sensorUnit(id)}
    </div>
  );
}

function BinaryReading({ live }) {
  return <div className={styles.reading}>{live.state === 'on' ? 'Online' : 'Offline'}</div>;
}

function EventReading({ live }) {
  let display = live.state;
  const parsed = new Date(live.state);
  if (!isNaN(parsed.getTime())) {
    display = parsed.toLocaleString();
  }
  return <div className={styles.reading}>Last motion: {display}</div>;
}

// Cameras poll on a 2s interval only while "Live" is toggled on for that
// specific card.
function CameraCard({ id, name }) {
  const [live, setLive] = useState(false);
  const [src, setSrc] = useState(`/api/ha/camera/${id}?t=${Date.now()}`);

  useEffect(() => {
    if (!live) return;
    const interval = setInterval(() => {
      setSrc(`/api/ha/camera/${id}?t=${Date.now()}`);
    }, 2000);
    return () => clearInterval(interval);
  }, [live, id]);

  return (
    <div>
      <img
        src={src}
        alt={name}
        className={styles.cameraImg}
        onError={(e) => { e.currentTarget.style.opacity = 0.3; }}
      />
      <button className={styles.btn} onClick={() => setLive((v) => !v)}>
        {live ? 'Stop Live' : 'Go Live'}
      </button>
    </div>
  );
}

function EntityCard({ config, live, onAction }) {
  const domain = config.id.split('.')[0];
  const isCamera = domain === 'camera';

  if (!live) {
    return (
      <div className={isCamera ? styles.cameraCard : styles.card}>
        <div className={styles.cardName}>{config.name}</div>
        <div className={styles.reading}>Not found in HA</div>
      </div>
    );
  }

  const isActive = ['on', 'playing', 'home'].includes(live.state);

  return (
    <div className={`${isCamera ? styles.cameraCard : styles.card} ${isActive ? styles.cardActive : ''}`}>
      <div className={styles.cardName}>{config.name}</div>
      {domain === 'light' && <LightControls id={config.id} live={live} color={config.color} onAction={onAction} />}
      {domain === 'switch' && <SwitchControls id={config.id} live={live} onAction={onAction} />}
      {domain === 'climate' && <ClimateControls id={config.id} live={live} onAction={onAction} />}
      {domain === 'media_player' && <MediaControls id={config.id} live={live} onAction={onAction} />}
      {domain === 'camera' && <CameraCard id={config.id} name={config.name} />}
      {domain === 'select' && <SelectControls id={config.id} live={live} onAction={onAction} />}
      {domain === 'sensor' && <ReadingDisplay id={config.id} live={live} />}
      {domain === 'binary_sensor' && <BinaryReading live={live} />}
      {domain === 'event' && <EventReading live={live} />}
    </div>
  );
}

export default function SmartHome() {
  const [haStates, setHaStates] = useState([]);
  const [haError, setHaError] = useState('');
  const [viewMode, setViewMode] = useState('section');
  const [activeSection, setActiveSection] = useState(null);
  const [activeLocation, setActiveLocation] = useState(null);
  const [page, setPage] = useState(0);

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
      await api('/ha/service', 'POST', { domain, service, data: { entity_id: entityId, ...data } });
      setTimeout(loadHaStates, 800);
    } catch (err) {
      setHaError(err.message);
    }
  }

  const statesMap = Object.fromEntries(haStates.map((s) => [s.entity_id, s]));

  const sectionGroups = groupBySection(SMART_HOME_ENTITIES);
  const locationGroups = groupByLocation(SMART_HOME_ENTITIES);

  const availableSections = SECTION_ORDER.filter((s) => sectionGroups[s]);
  const availableLocations = sortBuckets(Object.keys(locationGroups), 'Unspecified');

  const currentSection = activeSection && sectionGroups[activeSection] ? activeSection : availableSections[0];
  const currentLocation = activeLocation && locationGroups[activeLocation] ? activeLocation : availableLocations[0];

  function selectViewMode(mode) {
    setViewMode(mode);
    setPage(0);
  }
  function selectSection(s) {
    setActiveSection(s);
    setPage(0);
  }
  function selectLocation(l) {
    setActiveLocation(l);
    setPage(0);
  }

  let pages = [[]];
  let headerLabel = '';
  if (viewMode === 'section' && currentSection) {
    pages = paginateGroups(Object.entries(sectionGroups[currentSection] || {}), ENTITIES_PER_PAGE);
    headerLabel = currentSection;
  } else if (viewMode === 'location' && currentLocation) {
    pages = paginateGroups([[currentLocation, locationGroups[currentLocation] || []]], ENTITIES_PER_PAGE);
    headerLabel = currentLocation;
  }
  const safePage = Math.min(page, pages.length - 1);
  const pageGroups = pages[safePage] || [];

  return (
    <div className={styles.page}>
      <SectionErrorBoundary>
        <div className={styles.topBar}>
          <div className={styles.modeSwitch}>
            <button className={viewMode === 'section' ? styles.modeActive : styles.modeBtn} onClick={() => selectViewMode('section')}>
              By Section
            </button>
            <button className={viewMode === 'location' ? styles.modeActive : styles.modeBtn} onClick={() => selectViewMode('location')}>
              By Location
            </button>
          </div>
          <button className={styles.refreshBtn} onClick={loadHaStates} title="Refresh">⟳ Refresh</button>
        </div>

        {haError && <div className={styles.error}>{haError}</div>}
        {!haStates.length && !haError && <div className={styles.loading}>Loading devices…</div>}

        <div className={styles.pillRow}>
          {(viewMode === 'section' ? availableSections : availableLocations).map((key) => {
            const isActive = (viewMode === 'section' ? currentSection : currentLocation) === key;
            return (
              <button
                key={key}
                className={isActive ? styles.pillActive : styles.pill}
                onClick={() => (viewMode === 'section' ? selectSection(key) : selectLocation(key))}
              >
                {key}
              </button>
            );
          })}
        </div>

        <div className={styles.sectionBody}>
          <h2 className={styles.sectionTitle}>{headerLabel}</h2>

          <div className={styles.sectionContent}>
            {pageGroups.map(([group, ents]) => (
              <div key={group} className={styles.subsection}>
                {group !== headerLabel && <h3>{group}</h3>}
                <div className={styles.grid}>
                  {ents.map((e) => (
                    <EntityCard key={e.id} config={e} live={statesMap[e.id]} onAction={handleAction} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {pages.length > 1 && (
            <div className={styles.pager}>
              <button className={styles.btn} onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0}>
                ← Prev
              </button>
              <span className={styles.pagerLabel}>Page {safePage + 1} of {pages.length}</span>
              <button className={styles.btn} onClick={() => setPage((p) => Math.min(pages.length - 1, p + 1))} disabled={safePage === pages.length - 1}>
                Next →
              </button>
            </div>
          )}
        </div>
      </SectionErrorBoundary>
    </div>
  );
}
