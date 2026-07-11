import { useState, useEffect } from 'react';
import api from '../api.js';
import styles from './RecRoom.module.css';

// Since HA 2024.6, the Android TV Remote integration launches apps from the
// bare package name (application ID) — no activity suffix, no market:// prefix.
// Since HA 2024.6, most apps launch from the bare package name. A few devices
// still resolve certain packages to the Play Store on cold launch instead of
// opening the app directly — for those, the older market://launch?id= form
// works instead. Confirmed via current_activity on this device: Max, Prime,
// and Apple TV all needed the market:// form; the rest work bare.
// Netflix is a known unsupported case for this HA integration (per HA's own
// docs) — commands don't reach it even from Google's first-party apps.
const STREAMING_APPS = [
  { name: 'YouTube', activity: 'com.google.android.youtube.tv' },
  { name: 'Disney+', activity: 'com.disney.disneyplus' },
  { name: 'Max', activity: 'market://launch?id=com.wbd.stream' },
  { name: 'Hulu', activity: 'com.hulu.livingroomplus' },
  { name: 'Prime', activity: 'market://launch?id=com.amazon.amazonvideo.livingroom' },
  { name: 'Apple TV', activity: 'market://launch?id=com.apple.atve.androidtv.appletv' },
  { name: 'Peacock', activity: 'com.peacocktv.peacockandroid' },
  { name: 'Paramount+', activity: 'com.cbs.ott' },
];

const SAMSUNG_COMMANDS = [
  { label: 'Power', command: 'power' },
  { label: 'Vol +', command: 'volume_up' },
  { label: 'Vol -', command: 'volume_down' },
  { label: 'Mute', command: 'mute' },
  { label: 'Ch +', command: 'channel_up' },
  { label: 'Ch -', command: 'channel_down' },
];

export default function RecRoom() {
  const [flashMsg, setFlashMsg] = useState('');
  const [denonStatus, setDenonStatus] = useState(null);

  useEffect(() => {
    refreshDenon();
  }, []);

  function flash(msg) {
    setFlashMsg(msg);
    setTimeout(() => setFlashMsg(''), 2000);
  }

  async function refreshDenon() {
    try {
      const status = await api('/denon/status');
      setDenonStatus(status);
    } catch (err) {
      console.error(err);
    }
  }

  async function samsungCommand(command) {
    try {
      await api('/recroom/samsung/command', 'POST', { command });
      flash(`Samsung: ${command}`);
    } catch (err) {
      flash(`Error: ${err.message}`);
    }
  }

  async function googleTvNav(command) {
    try {
      await api('/recroom/googletv/nav', 'POST', { command });
      flash(`Google TV: ${command}`);
    } catch (err) {
      flash(`Error: ${err.message}`);
    }
  }

  async function launchApp(app) {
    try {
      await api('/recroom/googletv/launch', 'POST', { activity: app.activity });
      flash(`Launching ${app.name}...`);
    } catch (err) {
      flash(`Error: ${err.message}`);
    }
  }

  async function denonPower(on) {
    try {
      await api('/denon/power', 'POST', { on });
      flash(on ? 'Denon: On' : 'Denon: Standby');
      refreshDenon();
    } catch (err) {
      flash(`Error: ${err.message}`);
    }
  }

  async function denonMute(muted) {
    try {
      await api('/denon/mute', 'POST', { muted });
      refreshDenon();
    } catch (err) {
      flash(`Error: ${err.message}`);
    }
  }

  async function denonVolume(level) {
    try {
      await api('/denon/volume', 'POST', { level });
      refreshDenon();
    } catch (err) {
      flash(`Error: ${err.message}`);
    }
  }

  return (
    <div className={styles.page}>
      {flashMsg && <div className={styles.flash}>{flashMsg}</div>}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Samsung TV</h2>
        <div className={styles.grid}>
          {SAMSUNG_COMMANDS.map((c) => (
            <button key={c.command} className={styles.btn} onClick={() => samsungCommand(c.command)}>
              {c.label}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Denon AVR</h2>
        {denonStatus && (
          <div className={styles.readout}>
            <span>{denonStatus.power === 'on' ? 'ON' : 'STANDBY'}</span>
            <span>{denonStatus.input ?? '—'}</span>
            <span>VOL {denonStatus.volume ?? '—'}</span>
            <span>{denonStatus.mute ? 'MUTED' : ''}</span>
          </div>
        )}
        <div className={styles.grid}>
          <button className={styles.btn} onClick={() => denonPower(true)}>Power On</button>
          <button className={styles.btn} onClick={() => denonPower(false)}>Standby</button>
          <button className={styles.btn} onClick={() => denonMute(true)}>Mute</button>
          <button className={styles.btn} onClick={() => denonMute(false)}>Unmute</button>
        </div>
        <div className={styles.sliderRow}>
          <label htmlFor="denon-vol">Volume</label>
          <input
            id="denon-vol"
            type="range"
            min="0"
            max="98"
            defaultValue={denonStatus?.volume ?? 30}
            onMouseUp={(e) => denonVolume(Number(e.target.value))}
            onTouchEnd={(e) => denonVolume(Number(e.target.value))}
          />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Google TV</h2>
        <div className={styles.dpad}>
          <button className={`${styles.dpadBtn} ${styles.dpadUp}`} onClick={() => googleTvNav('DPAD_UP')}>▲</button>
          <button className={`${styles.dpadBtn} ${styles.dpadLeft}`} onClick={() => googleTvNav('DPAD_LEFT')}>◀</button>
          <button className={`${styles.dpadBtn} ${styles.dpadCenter}`} onClick={() => googleTvNav('DPAD_CENTER')}>OK</button>
          <button className={`${styles.dpadBtn} ${styles.dpadRight}`} onClick={() => googleTvNav('DPAD_RIGHT')}>▶</button>
          <button className={`${styles.dpadBtn} ${styles.dpadDown}`} onClick={() => googleTvNav('DPAD_DOWN')}>▼</button>
        </div>
        <div className={styles.dpadRow}>
          <button className={styles.btn} onClick={() => googleTvNav('BACK')}>Back</button>
          <button className={styles.btn} onClick={() => googleTvNav('HOME')}>Home</button>
        </div>
        <h3 className={styles.subheading}>Streaming Apps</h3>
        <div className={styles.appGrid}>
          {STREAMING_APPS.map((app) => (
            <button key={app.name} className={styles.appBtn} onClick={() => launchApp(app)}>
              {app.name}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
