import { useState, useEffect } from 'react';
import api from '../api.js';
import styles from './RecRoom.module.css';

const STREAMING_APPS = [
  { name: 'Netflix', activity: 'com.netflix.ninja/.MainActivity' },
  { name: 'YouTube', activity: 'com.google.android.youtube.tv/.MainActivity' },
  { name: 'Disney+', activity: 'com.disney.disneyplus/.MainActivity' },
  { name: 'Max', activity: 'com.wbd.stream/com.wbd.beam.BeamActivity' },
  { name: 'Hulu', activity: 'com.hulu.livingroomplus/.MainActivity' },
  { name: 'Prime', activity: 'com.amazon.amazonvideo.livingroom/com.amazon.ignition.IgnitionActivity' },
  { name: 'Plex', activity: 'com.plexapp.android/.MainActivity' },
  { name: 'Spotify', activity: 'com.spotify.tv.android/.MainActivity' },
  { name: 'Apple TV', activity: 'com.apple.atve.androidtv.appletv/.MainActivity' },
  { name: 'Peacock', activity: 'com.peacocktv.peacockandroid/.MainActivity' },
  { name: 'Paramount+', activity: 'com.cbs.ott/.MainActivity' },
  { name: 'ESPN', activity: 'com.espn.score_and_schedule/.MainActivity' },
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
  const [musicQuery, setMusicQuery] = useState('');
  const [isGrouping, setIsGrouping] = useState(false);
  const [musicError, setMusicError] = useState('');
  const [lastPlayed, setLastPlayed] = useState('');

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

  // ── MUSIC ASSISTANT / WHOLE-HOME AUDIO ──────────────────────────────────
  // Calls the group-search / group-favorites routes in recroom.js, which
  // switch the Denon to HEOS Music, join Kitchen/Living Room/Loft/Home
  // Theater into one Music Assistant group, then play. This takes several
  // seconds (Denon input switch + join delay), so isGrouping drives a
  // disabled/loading state rather than assuming it's instant.
  async function playSearch() {
    if (!musicQuery.trim()) return;
    setMusicError('');
    setIsGrouping(true);
    try {
      const result = await api('/recroom/speakers/group-search', 'POST', {
        query: musicQuery.trim(),
      });
      setLastPlayed(result?.played || musicQuery.trim());
      flash(`Playing: ${musicQuery.trim()}`);
      setMusicQuery('');
    } catch (err) {
      setMusicError(err.message);
      flash('Music: error — see details below');
    } finally {
      setIsGrouping(false);
    }
  }

  async function playLikedMusic() {
    setMusicError('');
    setIsGrouping(true);
    try {
      await api('/recroom/speakers/group-favorites', 'POST');
      setLastPlayed('Liked Music (YouTube Music)');
      flash('Playing Liked Music');
    } catch (err) {
      setMusicError(err.message);
      flash('Music: error — see details below');
    } finally {
      setIsGrouping(false);
    }
  }

  function handleMusicKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      playSearch();
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
        <h2>Whole-Home Audio</h2>
        <p className={styles.hint}>
          Groups Kitchen, Living Room, Loft, and Home Theater and plays from YouTube Music.
          Switching input and joining the group takes a few seconds.
        </p>
        <div className={styles.musicRow}>
          <input
            type="text"
            className={styles.musicInput}
            placeholder="Search a song or artist..."
            value={musicQuery}
            onChange={(e) => setMusicQuery(e.target.value)}
            onKeyDown={handleMusicKeyDown}
            disabled={isGrouping}
          />
          <button
            className={styles.btn}
            onClick={playSearch}
            disabled={isGrouping || !musicQuery.trim()}
          >
            {isGrouping ? 'Working...' : 'Search & Play'}
          </button>
        </div>
        <div className={styles.grid}>
          <button className={styles.btn} onClick={playLikedMusic} disabled={isGrouping}>
            {isGrouping ? 'Working...' : '▶ Play Liked Music'}
          </button>
        </div>
        {lastPlayed && !musicError && (
          <div className={styles.status}>Now playing: {lastPlayed}</div>
        )}
        {musicError && (
          <div className={styles.musicErrorBox}>
            Playback failed: {musicError}
          </div>
        )}
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
