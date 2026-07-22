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

export default function RecRoom() {
  const [flashMsg, setFlashMsg] = useState('');
  const [denonStatus, setDenonStatus] = useState(null);
  const [musicQuery, setMusicQuery] = useState('');
  const [isGrouping, setIsGrouping] = useState(false);
  const [musicError, setMusicError] = useState('');
  const [lastPlayed, setLastPlayed] = useState('');

  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState('');
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [playlistError, setPlaylistError] = useState('');

  useEffect(() => {
    refreshDenon();
    loadPlaylists();
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

  async function loadPlaylists() {
    setIsLoadingPlaylists(true);
    setPlaylistError('');
    try {
      const result = await api('/recroom/speakers/playlists');
      const list = result?.playlists || [];
      setPlaylists(list);
      if (list.length && !selectedPlaylist) {
        setSelectedPlaylist(list[0].uri);
      }
    } catch (err) {
      setPlaylistError(err.message);
    } finally {
      setIsLoadingPlaylists(false);
    }
  }

  async function playSelectedPlaylist() {
    if (!selectedPlaylist) return;
    setMusicError('');
    setIsGrouping(true);
    try {
      await api('/recroom/speakers/group-play-playlist', 'POST', { uri: selectedPlaylist });
      const match = playlists.find((p) => p.uri === selectedPlaylist);
      setLastPlayed(match?.name || 'Selected playlist');
      flash(`Playing: ${match?.name || 'playlist'}`);
    } catch (err) {
      setMusicError(err.message);
      flash('Music: error — see details below');
    } finally {
      setIsGrouping(false);
    }
  }

  return (
    <div className={styles.page}>
      {flashMsg && <div className={styles.flash}>{flashMsg}</div>}

      {/* ── GOOGLE TV — full width ── */}
      <section className={`${styles.section} ${styles.fullWidth}`}>
        <h2>Google TV</h2>
        <div className={styles.dpad}>
          <button
            className={`${styles.btn} ${styles.dpadUp}`}
            onClick={() => googleTvNav('DPAD_UP')}
            aria-label="Up"
          >
            ▲
          </button>
          <button
            className={`${styles.btn} ${styles.dpadLeft}`}
            onClick={() => googleTvNav('DPAD_LEFT')}
            aria-label="Left"
          >
            ◀
          </button>
          <button
            className={`${styles.btn} ${styles.dpadOk}`}
            onClick={() => googleTvNav('DPAD_CENTER')}
          >
            OK
          </button>
          <button
            className={`${styles.btn} ${styles.dpadRight}`}
            onClick={() => googleTvNav('DPAD_RIGHT')}
            aria-label="Right"
          >
            ▶
          </button>
          <button
            className={`${styles.btn} ${styles.dpadDown}`}
            onClick={() => googleTvNav('DPAD_DOWN')}
            aria-label="Down"
          >
            ▼
          </button>
        </div>
        <div className={styles.dpadSecondary}>
          <button className={styles.btn} onClick={() => googleTvNav('BACK')}>Back</button>
          <button className={styles.btn} onClick={() => googleTvNav('HOME')}>Home</button>
        </div>
      </section>

      {/* ── ROW: Streaming Apps | Whole-Home Audio ── */}
      <section className={styles.section}>
        <h2>Streaming Apps</h2>
        <div className={styles.grid}>
          {STREAMING_APPS.map((app) => (
            <button key={app.name} className={styles.btn} onClick={() => launchApp(app)}>
              {app.name}
            </button>
          ))}
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

        <h3>Synced Playlists</h3>
        <div className={styles.musicRow}>
          <select
            className={styles.musicSelect}
            value={selectedPlaylist}
            onChange={(e) => setSelectedPlaylist(e.target.value)}
            disabled={isGrouping || isLoadingPlaylists || !playlists.length}
          >
            {!playlists.length && <option value="">No playlists loaded</option>}
            {playlists.map((p) => (
              <option key={p.uri} value={p.uri}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            className={styles.btn}
            onClick={playSelectedPlaylist}
            disabled={isGrouping || !selectedPlaylist}
          >
            {isGrouping ? 'Working...' : 'Play'}
          </button>
          <button
            className={styles.btn}
            onClick={loadPlaylists}
            disabled={isLoadingPlaylists}
            title="Reload if you just added a playlist in YT Music"
          >
            {isLoadingPlaylists ? '...' : '⟳'}
          </button>
        </div>
        {playlistError && (
          <div className={styles.musicErrorBox}>
            Couldn't load playlists: {playlistError}
          </div>
        )}

        {lastPlayed && !musicError && (
          <div className={styles.status}>Now playing: {lastPlayed}</div>
        )}
        {musicError && (
          <div className={styles.musicErrorBox}>
            Playback failed: {musicError}
          </div>
        )}
      </section>

      {/* ── ROW: Samsung TV | Denon AVR ── */}
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
    </div>
  );
}
