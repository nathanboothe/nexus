import { useState, useEffect, useCallback } from 'react';
import api from '../api.js';
import styles from './SmartHome.module.css';

// Govee cloud API caps at 10,000 requests/day — keep this long
const POLL_INTERVAL_MS = 300000;

export default function SmartHome() {
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

  // Devices named "Room - Fixture" get grouped by room; otherwise "Unassigned"
  const rooms = devices.reduce((acc, d) => {
    const parts = (d.deviceName || 'Unknown').split(' - ');
    const label = parts.length > 1 ? parts[0] : 'Unassigned';
    acc[label] = acc[label] || [];
    acc[label].push(d);
    return acc;
  }, {});

  return (
    <div className={styles.page}>
      {error && <div className={styles.error}>{error}</div>}
      {devices.length === 0 && !error && <div className={styles.loading}>Loading devices…</div>}
      {Object.entries(rooms).map(([room, roomDevices]) => (
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
    </div>
  );
}
