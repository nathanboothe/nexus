import { useState, useEffect } from 'react';
import api from '../api.js';
import styles from './RecRoom.module.css';

// Since HA 2024.6, the Android TV Remote integration launches apps from the
// bare package name (application ID) — no activity suffix, no market:// prefix.
const STREAMING_APPS = [
  { name: 'Netflix', activity: 'com.netflix.ninja' },
  { name: 'YouTube', activity: 'com.google.android.youtube.tv' },
  { name: 'Disney+', activity: 'com.disney.disneyplus' },
  { name: 'Max', activity: 'com.wbd.stream' },
  { name: 'Hulu', activity: 'com.hulu.livingroomplus' },
  { name: 'Prime', activity: 'com.amazon.amazonvideo.livingroom' },
  { name: 'Plex', activity: 'com.plexapp.android' },
  { name: 'Spotify', activity: 'com.spotify.tv.android' },
  { name: 'Apple TV', activity: 'com.apple.atve.androidtv.appletv' },
  { name: 'Peacock', activity: 'com.peacocktv.peacockandroid' },
  { name: 'Paramount+', activity: 'com.cbs.ott' },
  { name: 'ESPN', activity: 'com.espn.score_and_schedule' },
];

const SAMSUNG_COMMANDS = [
  { label: 'Power', command: 'power' },
  { label: 'Vol +', command: 'volume_up' },
  { label: 'Vol -', command: 'volume_down' },
  { label: 'Mute', command: 'mute' },
  { label: 'Ch +', command: 'channel_up' },
  { label: 'Ch -', command: 'channel_down' },
];

const NAV_COMMANDS = [
  { label: '▲', command: 'DPAD_UP' },
  { label: '◀', command: 'DPAD_LEFT' },
  { label: 'OK', command: 'DPAD_CENTER' },
  { label: '▶', command: 'DPAD_RIGHT' },
  { label: '▼', command: 'DPAD_DOWN' },
  { label: 'Back', command: 'BACK' },
  { label: 'Home', command: 'HOME' },
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
        <h2>Samsung TV</h2>
        <div className={styles.grid}>
          {SAMSUNG_COMMANDS.map((c) => (
            <button key={c.command} className={styles.btn} onClick={() => samsungCommand(c.command)}>
              {c.label}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Denon AVR</h2>
        {denonStatus && (
          <div className={styles.status}>
            Power: {denonStatus.power ?? '—'} · Input: {denonStatus.input ?? '—'} · Vol:{' '}
            {denonStatus.volume ?? '—'} · Mute: {denonStatus.mute ?? '—'}
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
        <h2>Google TV</h2>
        <div className={styles.dpad}>
          {NAV_COMMANDS.map((c) => (
            <button key={c.command} className={styles.btn} onClick={() => googleTvNav(c.command)}>
              {c.label}
            </button>
          ))}
        </div>
        <h3>Streaming Apps</h3>
        <div className={styles.grid}>
          {STREAMING_APPS.map((app) => (
            <button key={app.name} className={styles.btn} onClick={() => launchApp(app)}>
              {app.name}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
