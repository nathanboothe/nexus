import { useState, useEffect, useCallback } from 'react';
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
  'Kitchen', 'Living Room', 'Utility', 'Desk', 'Outdoor', 'Porch', 'Other'
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

// HA MQTT devices config
const HA_DEVICES = [
  // Lights (full color/brightness control)
  { name: 'Curtain Lights',     entity: 'light.h70b5_7255',         type: 'light',    room: 'Outdoor',        icon: '🪩' },
  { name: 'Deck Lights',        entity: 'light.deck_lights',         type: 'light',    room: 'Outdoor',        icon: '💡' },
  { name: 'Flood Lights',       entity: 'light.flood_lights',        type: 'light',    room: 'Outdoor',        icon: '🔦' },
  { name: 'Front Porch Light 1',entity: 'light.front_porch_light_1', type: 'light',    room: 'Porch',          icon: '💡' },
  { name: 'Grill Lights',       entity: 'light.grill_lights',        type: 'light',    room: 'Outdoor',        icon: '💡' },
  { name: 'Porch Light 1',      entity: 'light.porch_light_1',       type: 'light',    room: 'Porch',          icon: '💡' },
  { name: 'Porch Light 2',      entity: 'light.porch_light_2',       type: 'light',    room: 'Porch',          icon: '💡' },
  // Switches
  { name: 'Decoration Projector',entity: 'switch.decoration_projecto_power', type: 'switch', room: 'Outdoor', icon: '📽' },
  { name: 'Party Lights',       entity: 'switch.party_lights_power_switch',  type: 'switch', room: 'Outdoor', icon: '🎉' },
  { name: 'Rec Room Fan Light', entity: 'switch.rec_room_fan_lighting_power_switch', type: 'switch', room: 'Rec Room', icon: '💡' },
  { name: 'Rec Room Wall Light',entity: 'switch.rec_room_wall_lighting_power_switch', type: 'switch', room: 'Rec Room', icon: '💡' },
  // Air Purifiers
  { name: 'Loft Air Purifier',       entity: 'switch.loft_air_purifier_power_switch',        type: 'purifier', room: 'Loft',          icon: '💨', modeEntity: 'select.loft_air_purifier_mode' },
  { name: 'Lucas Room Purifier',     entity: 'switch.lucas_room_purifier_power_switch',      type: 'purifier', room: "Lucas's Room",  icon: '💨', modeEntity: 'select.lucas_room_purifier_mode' },
  { name: 'Rec Room Air Purifier',   entity: 'switch.rec_room_air_purifier_power_switch',    type: 'purifier', room: 'Rec Room',      icon: '💨', modeEntity: 'select.rec_room_air_purifier_mode' },
];

function friendlyName(entityId) {
  return entityId
    .replace(/^(sensor|binary_sensor)\./, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => (v || 0).toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

export default function SmartHome() {
  const [devices, setDevices] = useState([]);
  const [goveeStates, setGoveeStates] = useState({});
  const [haStates, setHaStates] = useState({});
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('rooms');
  const [pendingDevices, setPendingDevices] = useState(new Set());
  const [expandedDevice, setExpandedDevice] = useState(null);

  const loadGoveeDevices = useCallback(async () => {
    try {
      const data = await goveeRequest('/devices');
      if (Array.isArray(data)) { setDevices(data); return data; }
    } catch {}
    return [];
  }, []);

  const loadGoveeStates = useCallback(async (deviceList) => {
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
          if (p.powerState !== undefined) props.power = p.powerState;
          if (p.powerSwitch !== undefined) props.power = p.powerSwitch === 1 ? 'on' : 'off';
          if (p.brightness !== undefined) props.brightness = p.brightness;
          if (p.color !== undefined) props.color = p.color;
          if (p.colorTemInKelvin !== undefined) props.colorTemp = p.colorTemInKelvin;
          if (p.colorTem !== undefined) props.colorTemp = p.colorTem;
        });
        newStates[deviceId] = props;
      }
    });
    setGoveeStates(prev => ({ ...prev, ...newStates }));
  }, []);

  const loadHaStates = useCallback(async () => {
    try {
      const allStates = await ha.states();
      const stateMap = {};
      allStates.forEach(s => { stateMap[s.entity_id] = s; });
      setHaStates(stateMap);
      setSensors(allStates.filter(s => SENSOR_ENTITIES.includes(s.entity_id)));
    } catch {}
  }, []);

  useEffect(() => {
    const init = async () => {
      const devList = await loadGoveeDevices();
      await Promise.all([loadGoveeStates(devList), loadHaStates()]);
      setLoading(false);
    };
    init();
    const interval = setInterval(async () => {
      const devList = await loadGoveeDevices();
      loadGoveeStates(devList);
      loadHaStates();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Govee controls
  async function handleGoveePower(device, on) {
    const key = device.device;
    setPendingDevices(prev => new Set(prev).add(key));
    try {
      await goveeRequest('/power', 'POST', { device: device.device, model: device.model, on });
      setGoveeStates(prev => ({ ...prev, [key]: { ...prev[key], power: on ? 'on' : 'off' } }));
    } catch {}
    setPendingDevices(prev => { const s = new Set(prev); s.delete(key); return s; });
  }

  async function handleGoveeBrightness(device, brightness) {
    try {
      await goveeRequest('/brightness', 'POST', { device: device.device, model: device.model, brightness });
      setGoveeStates(prev => ({ ...prev, [device.device]: { ...prev[device.device], brightness } }));
    } catch {}
  }

  async function handleGoveeColor(device, hex) {
    const { r, g, b } = hexToRgb(hex);
    try {
      await goveeRequest('/color', 'POST', { device: device.device, model: device.model, r, g, b });
      setGoveeStates(prev => ({ ...prev, [device.device]: { ...prev[device.device], color: { r, g, b } } }));
    } catch {}
  }

  async function handleGoveeColorTemp(device, kelvin) {
    try {
      await goveeRequest('/colortemp', 'POST', { device: device.device, model: device.model, kelvin });
      setGoveeStates(prev => ({ ...prev, [device.device]: { ...prev[device.device], colorTemp: kelvin } }));
    } catch {}
  }

  async function handleGoveeRoomPower(room, on) {
    try {
      await goveeRequest('/room', 'POST', { room, on });
      const roomDevices = devices.filter(d => d.meta?.room === room);
      const updates = {};
      roomDevices.forEach(d => { updates[d.device] = { ...goveeStates[d.device], power: on ? 'on' : 'off' }; });
      setGoveeStates(prev => ({ ...prev, ...updates }));
    } catch {}
  }

  // HA controls
  async function handleHaPower(device, on) {
    const key = device.entity;
    setPendingDevices(prev => new Set(prev).add(key));
    try {
      const domain = device.entity.split('.')[0];
      const service = on ? 'turn_on' : 'turn_off';
      await ha.service(domain, service, { entity_id: device.entity });
      setHaStates(prev => ({
        ...prev,
        [key]: { ...prev[key], state: on ? 'on' : 'off' }
      }));
    } catch {}
    setPendingDevices(prev => { const s = new Set(prev); s.delete(key); return s; });
  }

  async function handleHaBrightness(device, brightness) {
    try {
      const pct = Math.round((brightness / 255) * 100);
      await ha.service('light', 'turn_on', { entity_id: device.entity, brightness });
      setHaStates(prev => ({
        ...prev,
        [device.entity]: { ...prev[device.entity], attributes: { ...prev[device.entity]?.attributes, brightness } }
      }));
    } catch {}
  }

  async function handleHaColor(device, hex) {
    const { r, g, b } = hexToRgb(hex);
    try {
      await ha.service('light', 'turn_on', { entity_id: device.entity, rgb_color: [r, g, b] });
    } catch {}
  }

  async function handleHaColorTemp(device, mireds) {
    try {
      await ha.service('light', 'turn_on', { entity_id: device.entity, color_temp: mireds });
    } catch {}
  }

  async function handleHaMode(device, mode) {
    try {
      await ha.service('select', 'select_option', { entity_id: device.modeEntity, option: mode });
      setHaStates(prev => ({
        ...prev,
        [device.modeEntity]: { ...prev[device.modeEntity], state: mode }
      }));
    } catch {}
  }

  // Build Govee room groups
  const goveeByRoom = {};
  devices.forEach(d => {
    const room = d.meta?.room || 'Other';
    if (!goveeByRoom[room]) goveeByRoom[room] = [];
    goveeByRoom[room].push(d);
  });

  // Build HA room groups
  const haByRoom = {};
  HA_DEVICES.forEach(d => {
    if (!haByRoom[d.room]) haByRoom[d.room] = [];
    haByRoom[d.room].push(d);
  });

  // Merge all rooms
  const allRooms = [...new Set([...Object.keys(goveeByRoom), ...Object.keys(haByRoom)])];
  const sortedRooms = allRooms.sort((a, b) => {
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
            const goveeDevs = goveeByRoom[room] || [];
            const haDevs = haByRoom[room] || [];
            return (
              <div key={room} className={styles.roomSection}>
                <div className={styles.roomHeader}>
                  <h2 className={styles.roomName}>{room}</h2>
                  {goveeDevs.length > 0 && (
                    <div className={styles.roomActions}>
                      <button className={styles.roomBtn} onClick={() => handleGoveeRoomPower(room, true)}>All on</button>
                      <button className={styles.roomBtn} onClick={() => handleGoveeRoomPower(room, false)}>All off</button>
                    </div>
                  )}
                </div>
                <div className={styles.deviceGrid}>
                  {goveeDevs.map(device => (
                    <GoveeDeviceCard
                      key={device.device}
                      device={device}
                      state={goveeStates[device.device]}
                      pending={pendingDevices.has(device.device)}
                      expanded={expandedDevice === device.device}
                      onExpand={() => setExpandedDevice(expandedDevice === device.device ? null : device.device)}
                      onPower={handleGoveePower}
                      onBrightness={handleGoveeBrightness}
                      onColor={handleGoveeColor}
                      onColorTemp={handleGoveeColorTemp}
                    />
                  ))}
                  {haDevs.map(device => (
                    <HaDeviceCard
                      key={device.entity}
                      device={device}
                      state={haStates[device.entity]}
                      modeState={device.modeEntity ? haStates[device.modeEntity] : null}
                      pending={pendingDevices.has(device.entity)}
                      expanded={expandedDevice === device.entity}
                      onExpand={() => setExpandedDevice(expandedDevice === device.entity ? null : device.entity)}
                      onPower={handleHaPower}
                      onBrightness={handleHaBrightness}
                      onColor={handleHaColor}
                      onColorTemp={handleHaColorTemp}
                      onMode={handleHaMode}
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
          {sensors.length === 0 && <p className="text-muted">No sensor data — check HA connection</p>}
          {sensors.map(s => (
            <div key={s.entity_id} className={styles.sensorCard}>
              <p className="text-xs text-faint" style={{ marginBottom: 4 }}>{friendlyName(s.entity_id)}</p>
              <p className="font-medium">
                {isNaN(s.state) ? s.state : parseFloat(s.state).toFixed(1)}
                {s.attributes?.unit_of_measurement && <span className="text-muted"> {s.attributes.unit_of_measurement}</span>}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GoveeDeviceCard({ device, state, pending, expanded, onExpand, onPower, onBrightness, onColor, onColorTemp }) {
  const isOn = state?.power === 'on';
  const brightness = state?.brightness ?? 100;
  const colorHex = state?.color ? rgbToHex(state.color.r, state.color.g, state.color.b) : '#ffffff';
  const colorTemp = state?.colorTemp ?? 4000;
  const isPlug = device.meta?.type === 'Smart Plug';
  const stateKnown = state !== undefined;

  return (
    <div className={`${styles.deviceCard} ${isOn ? styles.deviceCardOn : ''}`}>
      <div className={styles.deviceTop}>
        <div className={styles.deviceInfo} onClick={!isPlug ? onExpand : undefined}
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
              <input type="color" value={colorHex} onChange={e => onColor(device, e.target.value)} className={styles.colorPicker} />
              {['#ffffff','#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#ff922b','#cc5de8'].map(c => (
                <button key={c} className={styles.colorSwatch} style={{ background: c }} onClick={() => onColor(device, c)} />
              ))}
            </div>
          </div>
          <div className={styles.controlRow}>
            <span className={styles.controlLabel}>Warmth</span>
            <div className={styles.controlRight}>
              <span className="text-xs text-faint">Cool</span>
              <input type="range" min="2000" max="9000" step="100" value={colorTemp}
                onChange={e => onColorTemp(device, parseInt(e.target.value))} className={styles.sliderWarm} />
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

function HaDeviceCard({ device, state, modeState, pending, expanded, onExpand, onPower, onBrightness, onColor, onColorTemp, onMode }) {
  const isOn = state?.state === 'on';
  const stateKnown = state !== undefined;
  const isLight = device.type === 'light';
  const isPurifier = device.type === 'purifier';
  const brightness = state?.attributes?.brightness ?? 255;
  const brightnessPct = Math.round((brightness / 255) * 100);
  const rgb = state?.attributes?.rgb_color;
  const colorHex = rgb ? rgbToHex(rgb[0], rgb[1], rgb[2]) : '#ffffff';
  const currentMode = modeState?.state || '';
  const modeOptions = modeState?.attributes?.options || [];

  return (
    <div className={`${styles.deviceCard} ${isOn ? styles.deviceCardOn : ''} ${styles.haDevice}`}>
      <div className={styles.deviceTop}>
        <div className={styles.deviceInfo} onClick={isLight || isPurifier ? onExpand : undefined}
          style={{ cursor: (isLight || isPurifier) ? 'pointer' : 'default' }}>
          <span className={styles.deviceIcon}>{device.icon}</span>
          <span className={styles.deviceName}>{device.name}</span>
          <span className="text-xs" style={{ color: '#4a7ec7' }}>HA · MQTT</span>
        </div>
        <button
          className={`${styles.powerBtn} ${isOn ? styles.powerBtnOn : ''} ${!stateKnown ? styles.powerBtnUnknown : ''}`}
          onClick={() => onPower(device, !isOn)}
          disabled={pending}
        >
          {pending ? '...' : stateKnown ? (isOn ? 'ON' : 'OFF') : '?'}
        </button>
      </div>

      {expanded && isLight && (
        <div className={styles.controls}>
          <div className={styles.controlRow}>
            <span className={styles.controlLabel}>Brightness</span>
            <div className={styles.controlRight}>
              <input type="range" min="1" max="255" value={brightness}
                onChange={e => onBrightness(device, parseInt(e.target.value))} className={styles.slider} />
              <span className="text-xs text-faint" style={{ minWidth: 32, textAlign: 'right' }}>{brightnessPct}%</span>
            </div>
          </div>
          <div className={styles.controlRow}>
            <span className={styles.controlLabel}>Color</span>
            <div className={styles.controlRight}>
              <input type="color" value={colorHex} onChange={e => onColor(device, e.target.value)} className={styles.colorPicker} />
              {['#ffffff','#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#ff922b','#cc5de8'].map(c => (
                <button key={c} className={styles.colorSwatch} style={{ background: c }} onClick={() => onColor(device, c)} />
              ))}
            </div>
          </div>
          <button className={styles.collapseBtn} onClick={onExpand}>Done</button>
        </div>
      )}

      {expanded && isPurifier && (
        <div className={styles.controls}>
          {modeOptions.length > 0 && (
            <div className={styles.controlRow}>
              <span className={styles.controlLabel}>Mode</span>
              <div className={styles.controlRight} style={{ flexWrap: 'wrap' }}>
                {modeOptions.map(m => (
                  <button key={m}
                    className={`${styles.modeBtn} ${currentMode === m ? styles.modeBtnActive : ''}`}
                    onClick={() => onMode(device, m)}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button className={styles.collapseBtn} onClick={onExpand}>Done</button>
        </div>
      )}

      {!expanded && isOn && (isLight || isPurifier) && (
        <button className={styles.expandHint} onClick={onExpand}>✎ Adjust</button>
      )}
    </div>
  );
}
