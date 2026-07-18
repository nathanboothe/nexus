import { useState, useEffect, useCallback, useRef } from 'react';
import { ha } from '../api.js';
import styles from './SmartHome.module.css';

const GOVEE_BASE = '/api/govee';

async function goveeRequest(path, method = 'GET', body) {
  const res = await fetch(`${GOVEE_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

const ROOM_ORDER = [
  'Rec Room', "Lucas's Room", 'Loft', 'Master Bedroom', "Sam's Room",
  'Kitchen', 'Living Room', 'Utility', 'Desk', 'Outdoor', 'Other'
];

const SENSOR_ENTITIES = [
  'sensor.hallway_temperature',
  'sensor.hallway_humidity',
  'sensor.rec_room_air_monitor_temperature',
  'sensor.loft_air_monitor_temperature',
  'sensor.sam_s_air_monitor_temperature',
  'sensor.tyler_s_air_monitor_temperature',
  'sensor.lucqs_room_air_monitor_temperature',
  'binary_sensor.firewalla_wan_status',
  'sensor.firewalla_download_speed',
  'sensor.firewalla_upload_speed',
];

function friendlyName(entityId) {
  return entityId
    .replace(/^(sensor|binary_sensor)\./, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

export default function SmartHome() {
  const [devices, setDevices] = useState([]);
  const [states, setStates] = useState({});
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('rooms');
  const [pendingDevices, setPendingDevices] = useState(new Set());
  const [expandedDevice, setExpandedDevice] = useState(null);

  const loadDevices = useCallback(async () => {
    try {
      const data = await goveeRequest('/devices');
      if (Array.isArray(data)) { setDevices(data); return data; }
    } catch {}
    return [];
  }, []);

  const loadStates = useCallback(async (deviceList) => {
    if (!deviceList?.length) return;
    const results = await Promise.allSettled(
      deviceList.map(d =>
        fetch(`${GOVEE_BASE}/state?device=${encodeURIComponent(d.device)}&model=${encodeURIComponent(d.model)}`)
          .then(r => r.json())
          .then(data => ({ deviceId: d.device, data }))
      )
    );
    const newStates = {};
    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value?.data?.properties) {
        const { deviceId, data } = r.value;
        const props = {};
        data.properties.forEach(p => {
          if (p.powerSwitch !== undefined) props.power = p.powerSwitch === 1 ? 'on' : 'off';
          if (p.brightness !== undefined) props.brightness = p.brightness;
          if (p.color !== undefined) props.color = p.color;
          if (p.colorTemInKelvin !== undefined) props.colorTemp = p.colorTemInKelvin;
        });
        newStates[deviceId] = props;
      }
    });
    setStates(prev => ({ ...prev, ...newStates }));
  }, []);

  const loadSensors = useCallback(async () => {
    try {
      const data = await ha.states();
      setSensors(data.filter(s => SENSOR_ENTITIES.includes(s.entity_id)));
    } catch {}
  }, []);

  useEffect(() => {
    const init = async () => {
      const devList = await loadDevices();
      await Promise.all([loadStates(devList), loadSensors()]);
      setLoading(false);
    };
    init();
    const interval = setInterval(async () => {
      const devList = await loadDevices();
      loadStates(devList);
      loadSensors();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  async function handlePower(device, on) {
    const key = device.device;
    setPendingDevices(prev => new Set(prev).add(key));
    try {
      await goveeRequest('/power', 'POST', { device: device.device, model: device.model, on });
      setStates(prev => ({ ...prev, [key]: { ...prev[key], power: on ? 'on' : 'off' } }));
    } catch {}
    setPendingDevices(prev => { const s = new Set(prev); s.delete(key); return s; });
  }

  async function handleBrightness(device, brightness) {
    try {
      await goveeRequest('/brightness', 'POST', { device: device.device, model: device.model, brightness });
      setStates(prev => ({ ...prev, [device.device]: { ...prev[device.device], brightness } }));
    } catch {}
  }

  async function handleColor(device, hex) {
    const { r, g, b } = hexToRgb(hex);
    try {
      await goveeRequest('/color', 'POST', { device: device.device, model: device.model, r, g, b });
      setStates(prev => ({ ...prev, [device.device]: { ...prev[device.device], color: { r, g, b } } }));
    } catch {}
  }

  async function handleColorTemp(device, kelvin) {
    try {
      await goveeRequest('/colortemp', 'POST', { device: device.device, model: device.model, kelvin });
      setStates(prev => ({ ...prev, [device.device]: { ...prev[device.device], colorTemp: kelvin } }));
    } catch {}
  }

  async function handleRoomPower(room, on) {
    try {
      await goveeRequest('/room', 'POST', { room, on });
      const roomDevices = devices.filter(d => d.meta?.room === room);
      const updates = {};
      roomDevices.forEach(d => { updates[d.device] = { ...states[d.device], power: on ? 'on' : 'off' }; });
      setStates(prev => ({ ...prev, ...updates }));
    } catch {}
  }

  const byRoom = {};
  devices.forEach(d => {
    const room = d.meta?.room || 'Other';
    if (!byRoom[room]) byRoom[room] = [];
    byRoom[room].push(d);
  });

  const sortedRooms = Object.keys(byRoom).sort((a, b) => {
    const ai = ROOM_ORDER.indexOf(a);
    const bi = ROOM_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  if (loading) return <div className="page"><p className="text-muted">Loading smart home...</p></div>;

  return (
    <div className="page">
      <div className={styles.header}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>Smart home</h1>
          <p className="text-muted text-sm">Devices · scenes · sensors</p>
        </div>
        <div className={styles.viewToggle}>
          <button className={`${styles.toggleBtn} ${view === 'rooms' ? styles.toggleActive : ''}`}
            onClick={() => setView('rooms')}>Rooms</button>
          <button className={`${styles.toggleBtn} ${view === 'sensors' ? styles.toggleActive : ''}`}
            onClick={() => setView('sensors')}>Sensors</button>
        </div>
      </div>

      {view === 'rooms' && (
        <div className={styles.rooms}>
          {sortedRooms.map(room => {
            const roomDevices = byRoom[room];
            return (
              <div key={room} className={styles.roomSection}>
                <div className={styles.roomHeader}>
                  <h2 className={styles.roomName}>{room}</h2>
                  <div className={styles.roomActions}>
                    <button className={styles.roomBtn} onClick={() => handleRoomPower(room, true)}>All on</button>
                    <button className={styles.roomBtn} onClick={() => handleRoomPower(room, false)}>All off</button>
                  </div>
                </div>
                <div className={styles.deviceGrid}>
                  {roomDevices.map(device => (
                    <DeviceCard
                      key={device.device}
                      device={device}
                      state={states[device.device]}
                      pending={pendingDevices.has(device.device)}
                      expanded={expandedDevice === device.device}
                      onExpand={() => setExpandedDevice(
                        expandedDevice === device.device ? null : device.device
                      )}
                      onPower={handlePower}
                      onBrightness={handleBrightness}
                      onColor={handleColor}
                      onColorTemp={handleColorTemp}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === 'sensors' && (
        <div className={styles.sensorGrid}>
          {sensors.length === 0 && (
            <p className="text-muted">No sensor data — check HA connection in config.js</p>
          )}
          {sensors.map(s => (
            <div key={s.entity_id} className={styles.sensorCard}>
              <p className="text-xs text-faint" style={{ marginBottom: 4 }}>{friendlyName(s.entity_id)}</p>
              <p className="font-medium">
                {isNaN(s.state) ? s.state : parseFloat(s.state).toFixed(1)}
                {s.attributes?.unit_of_measurement && (
                  <span className="text-muted"> {s.attributes.unit_of_measurement}</span>
                )}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeviceCard({ device, state, pending, expanded, onExpand, onPower, onBrightness, onColor, onColorTemp }) {
  const isOn = state?.power === 'on';
  const brightness = state?.brightness ?? 100;
  const colorHex = state?.color ? rgbToHex(state.color.r, state.color.g, state.color.b) : '#ffffff';
  const colorTemp = state?.colorTemp ?? 4000;
  const isPlug = device.meta?.type === 'Smart Plug';
  const stateKnown = state !== undefined;

  return (
    <div className={`${styles.deviceCard} ${isOn ? styles.deviceCardOn : ''}`}>
      <div className={styles.deviceTop}>
        <div className={styles.deviceInfo}
          onClick={!isPlug ? onExpand : undefined}
          style={{ cursor: isPlug ? 'default' : 'pointer' }}>
          <span className={styles.deviceIcon}>{device.meta?.icon || '💡'}</span>
          <span className={styles.deviceName}>{device.deviceName}</span>
          <span className="text-xs text-faint">{device.meta?.type}</span>
        </div>
        <button
          className={`${styles.powerBtn} ${isOn ? styles.powerBtnOn : ''} ${!stateKnown ? styles.powerBtnUnknown : ''}`}
          onClick={() => onPower(device, !isOn)}
          disabled={pending}
        >
          {pending ? '...' : stateKnown ? (isOn ? 'ON' : 'OFF') : '?'}
        </button>
      </div>

      {expanded && !isPlug && (
        <div className={styles.controls}>
          <div className={styles.controlRow}>
            <span className={styles.controlLabel}>Brightness</span>
            <div className={styles.controlRight}>
              <input type="range" min="1" max="100" value={brightness}
                onChange={e => onBrightness(device, parseInt(e.target.value))}
                className={styles.slider} />
              <span className="text-xs text-faint" style={{ minWidth: 32, textAlign: 'right' }}>{brightness}%</span>
            </div>
          </div>

          <div className={styles.controlRow}>
            <span className={styles.controlLabel}>Color</span>
            <div className={styles.controlRight}>
              <input type="color" value={colorHex}
                onChange={e => onColor(device, e.target.value)}
                className={styles.colorPicker} />
              {['#ffffff','#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#ff922b','#cc5de8'].map(c => (
                <button key={c} className={styles.colorSwatch}
                  style={{ background: c }}
                  onClick={() => onColor(device, c)} />
              ))}
            </div>
          </div>

          <div className={styles.controlRow}>
            <span className={styles.controlLabel}>Warmth</span>
            <div className={styles.controlRight}>
              <span className="text-xs text-faint">Cool</span>
              <input type="range" min="2000" max="9000" step="100" value={colorTemp}
                onChange={e => onColorTemp(device, parseInt(e.target.value))}
                className={styles.sliderWarm} />
              <span className="text-xs text-faint">Warm</span>
              <span className="text-xs text-faint" style={{ minWidth: 48, textAlign: 'right' }}>{colorTemp}K</span>
            </div>
          </div>

          <button className={styles.collapseBtn} onClick={onExpand}>Done</button>
        </div>
      )}

      {!expanded && !isPlug && isOn && (
        <button className={styles.expandHint} onClick={onExpand}>✎ Adjust</button>
      )}
    </div>
  );
}
