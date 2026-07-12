import { useState, useEffect, useCallback } from 'react';
import api from '../api.js';
import styles from './GoveeLights.module.css';

// Govee cloud API caps at 10,000 requests/day — keep this long
const POLL_INTERVAL_MS = 300000;

// Govee's own deviceName field doesn't encode room — mapped explicitly here.
// Add new devices here as they're added in the Govee app; anything not
// listed falls into "Unassigned" so it's still visible rather than dropped.
const ROOM_MAP = {
  'Spotlights Right': 'Front Yard',
  'Spotlights Left': 'Front Yard',
  'Curtain Lights': 'Front Yard',
  'Deck Lights': 'Deck',
  'Deck Stairs': 'Deck',
  'Front Porch Light 1': 'Front Porch',
  'Front Porch Light 2': 'Front Porch',
  'Grill Lights': 'Patio',
  'Porch Light 1': 'Porch',
  'Porch Light 2': 'Porch',
  'Porch Light 4': 'Porch',
  'Porch Light 5': 'Porch',
  'Porch Light 7': 'Porch',
  'Porch Light 8': 'Porch',
  'Back Fan Bulb 1': 'Rec Room',
  'Back Fan Bulb 2': 'Rec Room',
  'Back Fan Bulb 3': 'Rec Room',
  'Back Fan Bulb 4': 'Rec Room',
  'Front Fan Bulb 1': 'Rec Room',
  'Front Fan Bulb 2': 'Rec Room',
  'Front Fan Bulb 3': 'Rec Room',
  'Front Fan Bulb 4': 'Rec Room',
  'Fridge 1': 'Rec Room',
  'Fridge 2': 'Rec Room',
  'Fridge 3': 'Rec Room',
  'Fireplace Light': 'Rec Room',
  'Left Floor Lamp': 'Rec Room',
  'Right Floor Lamp': 'Rec Room',
  'PC Smart Plug': 'Rec Room',
  'Lucas Light': "Lucas's Room",
  'Dog Closet': 'Dog Closet',
  'Flood Lights': 'Back Yard',
  "Tyler's Air Purifier": "Tyler's Room",
};

// Govee exposes each LED segment of a strip/scene group as its own separate
// "device" in the API. These are noise, not real controllable fixtures —
// filtered out entirely rather than shown as Unassigned.
const EXCLUDE_EXACT = new Set([
  'Rec Room - All Rec Room Lights',
  'Rec Room Default Lighting',
  'Rec Room Floor Lamps',
  'Rec Room Fridge Lights',
  'Rec Room Lights',
]);

const EXCLUDE_PATTERNS = [
  /^Deck Lights Segment \d+$/,
  /^Deck Stairs Segment \d+$/,
  /^Flood Lights Segment \d+$/,
  /^Grill Lights Segment \d+$/,
  /^Left Floor Lamp Segment \d+$/,
  /^Right Floor Lamp Segment \d+$/,
  /^Spot ?Lights Segment \d+$/,
];

function isExcluded(deviceName) {
  if (EXCLUDE_EXACT.has(deviceName)) return true;
  return EXCLUDE_PATTERNS.some((p) => p.test(deviceName));
}

// Preferred display order — rooms not listed here fall in after these, alphabetically
const ROOM_ORDER = [
  'Rec Room', "Lucas's Room", "Tyler's Room", 'Front Yard', 'Back Yard',
  'Deck', 'Front Porch', 'Porch', 'Patio', 'Dog Closet',
];

export default function GoveeLights() {
  const [devices, setDevices] = useState([]);
  const [error, setError] = useState('');

  const loadDevices = useCallback(async () => {
    try {
      const list = await api('/govee/devices');
      setDevices(list);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadDevices();
    const id = setInterval(loadDevices, POLL_INTERVAL_MS);
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

  async function setColor(device, hex) {
    try {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      await api('/govee/control', 'POST', {
        device: device.device,
        model: device.model,
        cmd: { name: 'color', value: { r, g, b } },
      });
    } catch (err) {
      setError(err.message);
    }
  }

  const rooms = devices
    .filter((d) => !isExcluded(d.deviceName))
    .reduce((acc, d) => {
    const label = ROOM_MAP[d.deviceName] || 'Unassigned';
    acc[label] = acc[label] || [];
    acc[label].push(d);
    return acc;
  }, {});

  const orderedRoomNames = [
    ...ROOM_ORDER.filter((r) => rooms[r]),
    ...Object.keys(rooms).filter((r) => !ROOM_ORDER.includes(r)).sort(),
  ];

  return (
    <div className={styles.page}>
      {error && <div className={styles.error}>{error}</div>}
      {devices.length === 0 && !error && <div className={styles.loading}>Loading devices…</div>}
      {orderedRoomNames.map((room) => (
        <section key={room} className={styles.section}>
          <h2 className={styles.sectionTitle}>{room}</h2>
          <div className={styles.grid}>
            {rooms[room].map((d) => (
              <div key={d.device} className={styles.card}>
                <div className={styles.cardName}>{d.deviceName}</div>
                <div className={styles.cardControls}>
                  <button className={styles.btn} onClick={() => toggle(d, true)}>On</button>
                  <button className={styles.btn} onClick={() => toggle(d, false)}>Off</button>
                </div>
                {d.supportCmds?.includes('brightness') && (
                  <input
                    type="range"
                    min="1"
                    max="100"
                    defaultValue="100"
                    onMouseUp={(e) => setBrightness(d, Number(e.target.value))}
                    onTouchEnd={(e) => setBrightness(d, Number(e.target.value))}
                  />
                )}
                {d.supportCmds?.includes('color') && (
                  <input
                    type="color"
                    defaultValue="#ffffff"
                    className={styles.colorPicker}
                    onChange={(e) => setColor(d, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
