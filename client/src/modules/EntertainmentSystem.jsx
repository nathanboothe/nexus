import { useState, useEffect } from 'react';
import api from '../api.js';
import shared from './shared/shared.module.css';
import styles from './EntertainmentSystem.module.css';
import { VolumeSlider } from './shared/SharedControls.jsx';

// Denon source_list values, confirmed from HA Developer Tools > States for
// media_player.home_theater_2. Must match exactly.
const DENON_SOURCE_TV = 'TV Audio';
const DENON_SOURCE_XBOX = 'XBOX';
const DENON_SOURCE_PS5 = 'PS5';
const DENON_SOURCE_SWITCH2 = 'Switch 2';

// Simple Icons CDN (https://simpleicons.org) — free brand icon SVGs by slug.
// A couple of newer/rebranded services (Max, Peacock, Paramount+) may not have
// a perfectly matching slug; the <img onError> fallback below swaps to a text
// label if a given logo fails to load, so nothing breaks visually either way.
const STREAMING_APPS = [
  { name: 'Netflix', activity: 'com.netflix.ninja', logo: 'netflix' },
  { name: 'YouTube', activity: 'com.google.android.youtube.tv', logo: 'youtube' },
  { name: 'Disney+', activity: 'com.disney.disneyplus', logo: 'disneyplus' },
  { name: 'Max', activity: 'com.wbd.stream', logo: 'hbomax' },
  { name: 'Hulu', activity: 'com.hulu.livingroomplus', logo: 'hulu' },
  { name: 'Prime', activity: 'com.amazon.amazonvideo.livingroom', logo: 'primevideo' },
  { name: 'Apple TV', activity: 'com.apple.atve.androidtv.appletv', logo: 'appletv' },
  { name: 'Peacock', activity: 'com.peacocktv.peacockandroid', logo: 'peacock' },
  { name: 'Paramount+', activity: 'com.cbs.ott', logo: 'paramountplus' },
];

function handleLogoError(e) {
  e.currentTarget.style.display = 'none';
  const fallback = e.currentTarget.nextSibling;
  if (fallback) fallback.style.display = 'inline';
}

export default function EntertainmentSystem() {
  const [flashMsg, setFlashMsg] = useState('');
  const [denonStatus, setDenonStatus] = useState(null);

  // Best-effort local tracking of TV power. Broadlink IR has no read-back
  // state, so unlike the Denon (which reports real state from HA), this is
  // only as accurate as what the app has sent. It's updated whenever the
  // master toggle below fires.
  const [tvOn, setTvOn] = useState(false);
  const [isTogglingAll, setIsTogglingAll] = useState(false);

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

  async function denonVolume(level) {
    try {
      await api('/denon/volume', 'POST', { level });
      refreshDenon();
    } catch (err) {
      flash(`Error: ${err.message}`);
    }
  }

  async function denonInput(source, label) {
    try {
      await api('/denon/input', 'POST', { input: source });
      flash(`Denon input: ${label}`);
      refreshDenon();
    } catch (err) {
      flash(`Error: ${err.message}`);
    }
  }

  // ── MASTER TOGGLE ─────────────────────────────────────────────────────────
  // Direction is decided by the Denon's real reported state (reliable, from
  // HA). The TV has no real state, so it's only toggled when the locally
  // tracked tvOn disagrees with the target direction — this keeps the TV from
  // being double-toggled if it's already in the right state.
  // Used by both the Power button and the Watch TV button below — they
  // currently do the exact same thing, just labeled differently.
  async function toggleEverything() {
    setIsTogglingAll(true);
    try {
      const denonIsOn = denonStatus?.power === 'on';
      const turningOn = !denonIsOn;

      await denonPower(turningOn);

      if (tvOn !== turningOn) {
        await samsungCommand('power');
        setTvOn(turningOn);
      }

      if (turningOn) {
        await denonInput(DENON_SOURCE_TV, 'TV');
      }

      flash(turningOn ? 'Entertainment System: On' : 'Entertainment System: Off');
    } catch (err) {
      flash(`Error: ${err.message}`);
    } finally {
      setIsTogglingAll(false);
    }
  }

  return (
    <div className={styles.page}>
      {flashMsg && <div className={shared.flash}>{flashMsg}</div>}

      <section className={`${shared.section} ${styles.entertainment}`}>
        <h2>Entertainment System</h2>

        <div className={styles.entBody}>
          {/* LEFT: Power + Watch TV */}
          <div className={styles.entLeft}>
            <button className={shared.btn} onClick={toggleEverything} disabled={isTogglingAll}>
              {isTogglingAll ? 'Working…' : '⏻ Power'}
            </button>
            <button className={shared.btn} onClick={toggleEverything} disabled={isTogglingAll}>
              {isTogglingAll
                ? 'Working…'
                : denonStatus?.power === 'on'
                ? 'Stop Watch TV'
                : 'Watch TV'}
            </button>
          </div>

          {/* CENTER: Google TV D-pad */}
          <div className={styles.entCenter}>
            <div className={styles.dpad}>
              <button className={`${shared.btn} ${styles.dpadUp}`} onClick={() => googleTvNav('DPAD_UP')} aria-label="Up">▲</button>
              <button className={`${shared.btn} ${styles.dpadLeft}`} onClick={() => googleTvNav('DPAD_LEFT')} aria-label="Left">◀</button>
              <button className={`${shared.btn} ${styles.dpadOk}`} onClick={() => googleTvNav('DPAD_CENTER')}>OK</button>
              <button className={`${shared.btn} ${styles.dpadRight}`} onClick={() => googleTvNav('DPAD_RIGHT')} aria-label="Right">▶</button>
              <button className={`${shared.btn} ${styles.dpadDown}`} onClick={() => googleTvNav('DPAD_DOWN')} aria-label="Down">▼</button>
            </div>
            <div className={styles.dpadSecondary}>
              <button className={shared.btn} onClick={() => googleTvNav('BACK')}>Back</button>
              <button className={shared.btn} onClick={() => googleTvNav('HOME')}>Home</button>
            </div>
          </div>

          {/* RIGHT: Streaming apps, 3x3 */}
          <div className={styles.entRight}>
            {STREAMING_APPS.map((app) => (
              <button
                key={app.name}
                className={shared.btn}
                onClick={() => launchApp(app)}
                aria-label={app.name}
                title={app.name}
              >
                <img src={`https://cdn.simpleicons.org/${app.logo}`} alt={app.name} onError={handleLogoError} />
                <span className={styles.logoFallback}>{app.name}</span>
              </button>
            ))}
          </div>

          {/* FAR RIGHT: Console shortcuts, stacked */}
          <div className={styles.entConsoles}>
            <h3>Play a Console</h3>
            <button className={shared.btn} onClick={() => denonInput(DENON_SOURCE_XBOX, 'Xbox')}>Xbox</button>
            <button className={shared.btn} onClick={() => denonInput(DENON_SOURCE_PS5, 'PS5')}>PS5</button>
            <button className={shared.btn} onClick={() => denonInput(DENON_SOURCE_SWITCH2, 'Switch 2')}>Switch 2</button>
          </div>
        </div>

        <VolumeSlider id="ent-vol" denonStatus={denonStatus} onChange={denonVolume} />
      </section>
    </div>
  );
}
