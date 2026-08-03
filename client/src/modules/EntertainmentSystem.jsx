import { useState, useEffect, useRef } from 'react';
import api from '../api.js';
import styles from './EntertainmentSystem.module.css';

// Denon source_list values, confirmed from HA Developer Tools > States for
// media_player.home_theater_2. Must match exactly.
const DENON_SOURCE_TV = 'TV Audio';
const DENON_SOURCE_XBOX = 'XBOX';
const DENON_SOURCE_PS5 = 'PS5';
const DENON_SOURCE_SWITCH2 = 'Switch 2';

// PLACEHOLDER — confirm this matches the exact command name used when the
// input/source IR code was learned on the Broadlink hub (remote.base_station,
// device 'TV'). Broadlink is fire-and-forget with no state read-back, so a
// wrong string here fails silently (button does nothing, no error surfaced).
// If it's wrong, this is the only line that needs to change.
const SAMSUNG_INPUT_COMMAND = 'source';

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

const SAMSUNG_COMMANDS = [
  { label: 'Power', command: 'power' },
  { label: 'Input', command: SAMSUNG_INPUT_COMMAND },
  { label: 'Vol +', command: 'volume_up' },
  { label: 'Vol -', command: 'volume_down' },
  { label: 'Mute', command: 'mute' },
  { label: 'Ch +', command: 'channel_up' },
  { label: 'Ch -', command: 'channel_down' },
];

// Shared volume slider. Controlled by real Denon state (not defaultValue), so
// the handle always starts at the actual current volume instead of wherever
// it last happened to render. While the user is actively dragging, incoming
// status refreshes are ignored so the slider doesn't jump mid-drag; once
// they release, the chosen value is sent and the slider re-syncs to
// whatever HA reports next.
function VolumeSlider({ id, denonStatus, onChange }) {
  const [localValue, setLocalValue] = useState(denonStatus?.volume ?? 30);
  const isDragging = useRef(false);

  useEffect(() => {
    if (!isDragging.current && denonStatus?.volume != null) {
      setLocalValue(denonStatus.volume);
    }
  }, [denonStatus?.volume]);

  function commit(value) {
    isDragging.current = false;
    onChange(value);
  }

  return (
    <div className={styles.sliderRow}>
      <label htmlFor={id}>Volume</label>
      <input
        id={id}
        type="range"
        min="0"
        max="98"
        value={localValue}
        onMouseDown={() => { isDragging.current = true; }}
        onTouchStart={() => { isDragging.current = true; }}
        onChange={(e) => setLocalValue(Number(e.target.value))}
        onMouseUp={(e) => commit(Number(e.target.value))}
        onTouchEnd={(e) => commit(Number(e.target.value))}
      />
      <span className={styles.sliderValue}>{localValue}</span>
    </div>
  );
}

// Bass (tone control) slider. -6dB to +6dB in 1dB steps, matching the
// Denon's actual PSBAS range. Unlike Volume, the Denon protocol gives no
// reliable read-back for tone control over denonavr.get_command, so this has
// no real state to sync against — it starts at 0 (flat) on every page load
// regardless of what's actually set on the receiver, and only reflects
// what's been sent locally since. Same fire-and-forget caveat as the
// Samsung IR buttons. Only commits on release, matching VolumeSlider,
// rather than firing a request on every step while dragging.
function BassSlider({ id, onChange }) {
  const [localValue, setLocalValue] = useState(0);
  const isDragging = useRef(false);

  function commit(value) {
    isDragging.current = false;
    onChange(value);
  }

  return (
    <div className={styles.sliderRow}>
      <label htmlFor={id}>Bass</label>
      <input
        id={id}
        type="range"
        min="-6"
        max="6"
        value={localValue}
        onMouseDown={() => { isDragging.current = true; }}
        onTouchStart={() => { isDragging.current = true; }}
        onChange={(e) => setLocalValue(Number(e.target.value))}
        onMouseUp={(e) => commit(Number(e.target.value))}
        onTouchEnd={(e) => commit(Number(e.target.value))}
      />
      <span className={styles.sliderValue}>{localValue > 0 ? `+${localValue}` : localValue} dB</span>
    </div>
  );
}

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
  // individual Samsung Power button or the master toggle below fires.
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

  async function samsungPowerButton() {
    await samsungCommand('power');
    setTvOn((prev) => !prev);
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

  async function denonInput(source, label) {
    try {
      await api('/denon/input', 'POST', { input: source });
      flash(`Denon input: ${label}`);
      refreshDenon();
    } catch (err) {
      flash(`Error: ${err.message}`);
    }
  }

  async function denonBass(db) {
    try {
      await api('/denon/bass', 'POST', { db });
      flash(`Bass: ${db > 0 ? '+' : ''}${db} dB`);
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

  const isDirectMode = denonStatus?.soundMode && /direct/i.test(denonStatus.soundMode);

  return (
    <div className={styles.page}>
      {flashMsg && <div className={styles.flash}>{flashMsg}</div>}

      {/* ── ENTERTAINMENT SYSTEM — full width, top ── */}
      <section className={`${styles.section} ${styles.entertainment}`}>
        <h2>Entertainment System</h2>

        <div className={styles.entBody}>
          {/* LEFT: Power + Watch TV */}
          <div className={styles.entLeft}>
            <button className={styles.btn} onClick={toggleEverything} disabled={isTogglingAll}>
              {isTogglingAll ? 'Working…' : '⏻ Power'}
            </button>
            <button className={styles.btn} onClick={toggleEverything} disabled={isTogglingAll}>
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
              <button className={`${styles.btn} ${styles.dpadUp}`} onClick={() => googleTvNav('DPAD_UP')} aria-label="Up">▲</button>
              <button className={`${styles.btn} ${styles.dpadLeft}`} onClick={() => googleTvNav('DPAD_LEFT')} aria-label="Left">◀</button>
              <button className={`${styles.btn} ${styles.dpadOk}`} onClick={() => googleTvNav('DPAD_CENTER')}>OK</button>
              <button className={`${styles.btn} ${styles.dpadRight}`} onClick={() => googleTvNav('DPAD_RIGHT')} aria-label="Right">▶</button>
              <button className={`${styles.btn} ${styles.dpadDown}`} onClick={() => googleTvNav('DPAD_DOWN')} aria-label="Down">▼</button>
            </div>
            <div className={styles.dpadSecondary}>
              <button className={styles.btn} onClick={() => googleTvNav('BACK')}>Back</button>
              <button className={styles.btn} onClick={() => googleTvNav('HOME')}>Home</button>
            </div>
          </div>

          {/* RIGHT: Streaming apps, 3x3 */}
          <div className={styles.entRight}>
            {STREAMING_APPS.map((app) => (
              <button
                key={app.name}
                className={styles.btn}
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
            <button className={styles.btn} onClick={() => denonInput(DENON_SOURCE_XBOX, 'Xbox')}>Xbox</button>
            <button className={styles.btn} onClick={() => denonInput(DENON_SOURCE_PS5, 'PS5')}>PS5</button>
            <button className={styles.btn} onClick={() => denonInput(DENON_SOURCE_SWITCH2, 'Switch 2')}>Switch 2</button>
          </div>
        </div>

        <VolumeSlider id="ent-vol" denonStatus={denonStatus} onChange={denonVolume} />
      </section>

      {/* ── Samsung TV ── */}
      <section className={`${styles.section} ${styles.samsungCard}`}>
        <h2>Samsung TV</h2>
        <div className={styles.grid}>
          {SAMSUNG_COMMANDS.map((c) =>
            c.command === 'power' ? (
              <button key={c.command} className={styles.btn} onClick={samsungPowerButton}>{c.label}</button>
            ) : (
              <button key={c.command} className={styles.btn} onClick={() => samsungCommand(c.command)}>{c.label}</button>
            )
          )}
        </div>
      </section>

      {/* ── Denon AVR ── */}
      <section className={`${styles.section} ${styles.denonCard}`}>
        <h2>Denon AVR</h2>
        {denonStatus && (
          <div className={styles.status}>
            Power: {denonStatus.power ?? '—'} · Input: {denonStatus.input ?? '—'} · Vol: {denonStatus.volume ?? '—'} · Mute: {denonStatus.mute ?? '—'}
          </div>
        )}
        <div className={styles.grid}>
          <button className={styles.btn} onClick={() => denonPower(true)}>Power On</button>
          <button className={styles.btn} onClick={() => denonPower(false)}>Standby</button>
          <button className={styles.btn} onClick={() => denonMute(true)}>Mute</button>
          <button className={styles.btn} onClick={() => denonMute(false)}>Unmute</button>
        </div>
        <VolumeSlider id="denon-vol" denonStatus={denonStatus} onChange={denonVolume} />
        <BassSlider id="denon-bass" onChange={denonBass} />
        {isDirectMode && (
          <div style={{ fontSize: '0.85em', opacity: 0.8, marginTop: 4 }}>
            Bass has no effect in {denonStatus.soundMode} mode.
          </div>
        )}
      </section>
    </div>
  );
}
