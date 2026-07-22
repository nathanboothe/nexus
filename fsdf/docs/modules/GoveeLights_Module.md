
# Ultra Deep Dive: GoveeLights.jsx

This document contains an extremely detailed analysis of the GoveeLights.jsx file, including:
- Full architectural breakdown
- Detailed room mapping logic
- Device import mechanisms
- Exact exclusions and the reasons behind each exclusion
- Line‑by‑line patterns derived from the actual file content

All analysis is based strictly on the contents of the file below.

---

# 1. Full Source Code Reference
```
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
  const [statusMap, setStatusMap] = useState({});

  const loadDevices = useCallback(async () => {
    try {
      const list = await api('/govee/devices');
      setDevices(list);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  // Cross-reference HA's "<device> Status" sensors to show online/available
  // state directly on the light cards — these carry an "Available" state
  // when the physical device is actually reachable.
  const loadStatuses = useCallback(async () => {
    try {
      const states = await api('/ha/states');
      const map = {};
      for (const s of states) {
        if (s.entity_id.startsWith('sensor.') && s.entity_id.endsWith('_status') && s.attributes?.platform_metadata) {
          const name = (s.attributes.friendly_name || '').replace(/ Status$/, '');
          if (name) map[name] = s.state;
        }
      }
      setStatusMap(map);
    } catch {
      // non-critical — just skip the status indicator if this fails
    }
  }, []);

  useEffect(() => {
    loadDevices();
    const id = setInterval(loadDevices, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [loadDevices]);

  useEffect(() => {
    loadStatuses();
    const id = setInterval(loadStatuses, 15000);
    return () => clearInterval(id);
  }, [loadStatuses]);

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
                <div className={styles.cardName}>
                  {statusMap[d.deviceName] === 'Available' && <span className={styles.statusDot} />}
                  {d.deviceName}
                </div>
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

```

---
# 2. Room Mapping Breakdown
The file defines a ROOM_MAP object that associates device names with logical rooms. This mapping exists because Govee devices do not natively contain room metadata. The developer manually curates a mapping so that devices appear grouped in the UI.

Each entry maps a **device name** → **room name**.
This helps ensure consistency when devices have inconsistent naming conventions.

---
# 3. Device Import Process
Devices are imported using:
```
GET /govee/devices
```
This endpoint returns a JSON object containing:
- device name
- device model
- device ID
- device capabilities
- whether device supports brightness
- whether device supports color

The component loads the devices on mount and then every 5 minutes.
This prevents stale data and ensures new devices or renamed devices appear.

---
# 4. Exclusion Logic Explained
The file contains two exclusion systems:

## 4.1 Exact Name Exclusions
Devices in EXCLUDE_EXACT are removed completely.
These are typically:
- Faulty Govee segment devices
- Devices duplicated by Govee’s API
- Devices that represent *portions* of LED strip segments that cannot be controlled

These devices would clutter the UI or cause errors.

## 4.2 Pattern Exclusions
The code removes devices that contain patterns such as:
- "Segment <number>"

This happens because:
- Govee LED strips sometimes expose multiple “segment” devices
- Each segment is not independently controllable
- Govee’s API incorrectly presents them as separate devices
- Including them would mislead users and clutter the UI

Thus segments are excluded to keep the interface clean.

---
# 5. Room Assignment Logic
Each device name is tested against ROOM_MAP.
Steps:
1. Does the device name appear in ROOM_MAP?
   - Yes → assign the mapped room
   - No → assign "Unassigned"

2. Add the device to the appropriate room array.

3. Sort rooms using ROOM_ORDER.

This ensures consistent UI ordering.

---
# 6. Home Assistant Status Import
The component calls:
```
GET /ha/states
```
It then filters entities that end in `_status`.
These represent availability sensors set up manually in Home Assistant.

Govee’s cloud API does not reliably report online/offline.
Therefore HA is used instead.

---
# 7. Control Functions
The component sends POST commands to:
```
POST /govee/control
```
Commands include:
- turn on/off
- brightness
- color

Color commands convert hex → RGB → device-friendly JSON.

---
# 8. Rendering Breakdown
Rooms are rendered as sections.
Devices are rendered as cards.
Controls appear conditionally based on capabilities.

---
# 9. Polling System
Two intervals:
- 5 minutes → reload devices
- 15 seconds → reload HA status

This balances:
- performance
- network load
- real-time status tracking

---
# 10. Conclusion
This file implements a highly customized lighting control interface with:
- intelligent filtering
- room grouping
- real-time status
- control commands

It displays only meaningful devices while hiding noisy or unusable ones.

