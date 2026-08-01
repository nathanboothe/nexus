import { useState, useEffect, useRef } from 'react';
import api from '../api.js';
import styles from './RecRoom.module.css';

// Denon source_list values, confirmed from HA Developer Tools > States for
// media_player.home_theater_2. Must match exactly.
const DENON_SOURCE_TV = 'TV Audio';
const DENON_SOURCE_XBOX = 'XBOX';
const DENON_SOURCE_PS5 = 'PS5';
const DENON_SOURCE_SWITCH2 = 'Switch 2';

// Must match config.js entities.massHomeTheater on the backend — this is the
// Music Assistant group leader every play/now-playing/album-art call targets.
const MASS_HOME_THEATER_ID = 'media_player.home_theater_3';

// Simple Icons CDN (https://simpleicons.org) — free brand icon SVGs by slug.
// A couple of newer/rebranded services (Max, Peacock, Paramount+) may not have
// a perfectly matching slug; the <img onError> fallback below swaps to a text
// label if a given logo fails to load, so nothing breaks visually either way.
const STREAMING_APPS = [
  { name: 'Netflix', activity: 'com.netflix.ninja/.MainActivity', logo: 'netflix' },
  { name: 'YouTube', activity: 'com.google.android.youtube.tv/.MainActivity', logo: 'youtube' },
  { name: 'Disney+', activity: 'com.disney.disneyplus/.MainActivity', logo: 'disneyplus' },
  { name: 'Max', activity: 'com.wbd.stream/com.wbd.beam.BeamActivity', logo: 'hbomax' },
  { name: 'Hulu', activity: 'com.hulu.livingroomplus/.MainActivity', logo: 'hulu' },
  { name: 'Prime', activity: 'com.amazon.amazonvideo.livingroom/com.amazon.ignition.IgnitionActivity', logo: 'primevideo' },
  { name: 'Apple TV', activity: 'com.apple.atve.androidtv.appletv/.MainActivity', logo: 'appletv' },
  { name: 'Peacock', activity: 'com.peacocktv.peacockandroid/.MainActivity', logo: 'peacock' },
  { name: 'Paramount+', activity: 'com.cbs.ott/.MainActivity', logo: 'paramountplus' },
];

const SAMSUNG_COMMANDS = [
  { label: 'Power', command: 'power' },
  { label: 'Vol +', command: 'volume_up' },
  { label: 'Vol -', command: 'volume_down' },
  { label: 'Mute', command: 'mute' },
  { label: 'Ch +', command: 'channel_up' },
  { label: 'Ch -', command: 'channel_down' },
];

// Speakers that can be toggled in/out of the Whole-Home Audio group. Home
// Theater isn't listed here — it's the group leader every play_media call
// targets, so it's always included regardless of these toggles.
const TOGGLEABLE_SPEAKERS = [
  { key: 'massKitchen', label: 'Kitchen' },
  { key: 'massLivingRoom', label: 'Living Room' },
  { key: 'massLoft', label: 'Loft' },
];

// Shared volume slider — used in both the Entertainment System card and the
// Denon AVR card. Controlled by real Denon state (not defaultValue), so the
// handle always starts at the actual current volume instead of wherever it
// last happened to render. While the user is actively dragging, incoming
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

function handleLogoError(e) {
  e.currentTarget.style.display = 'none';
  const fallback = e.currentTarget.nextSibling;
  if (fallback) fallback.style.display = 'inline';
}

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

  // Best-effort local tracking of TV power. Broadlink IR has no read-back
  // state, so unlike the Denon (which reports real state from HA), this is
  // only as accurate as what the app has sent. It's updated whenever the
  // individual Samsung Power button or the master toggle below fires.
  const [tvOn, setTvOn] = useState(false);
  const [isTogglingAll, setIsTogglingAll] = useState(false);

  const [nowPlaying, setNowPlaying] = useState(null);
  const [speakerSelection, setSpeakerSelection] = useState({
    massKitchen: true,
    massLivingRoom: true,
    massLoft: true,
  });

  useEffect(() => {
    refreshDenon();
    loadPlaylists();
    refreshNowPlaying();
    const id = setInterval(refreshNowPlaying, 5000);
    return () => clearInterval(id);
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

  async function refreshNowPlaying() {
    try {
      const state = await api(`/ha/state/${MASS_HOME_THEATER_ID}`);
      setNowPlaying(state);
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

  // ── MUSIC ASSISTANT / WHOLE-HOME AUDIO ──────────────────────────────────
  function toggleSpeaker(key) {
    setSpeakerSelection((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function selectedMembers() {
    const keys = Object.entries(speakerSelection)
      .filter(([, checked]) => checked)
      .map(([key]) => key);
    return ['massHomeTheater', ...keys];
  }

  async function playSearch() {
    if (!musicQuery.trim()) return;
    setMusicError('');
    setIsGrouping(true);
    try {
      const result = await api('/recroom/speakers/group-search', 'POST', {
        query: musicQuery.trim(),
        members: selectedMembers(),
      });
      setLastPlayed(result?.played || musicQuery.trim());
      flash(`Playing: ${musicQuery.trim()}`);
      setMusicQuery('');
      setTimeout(refreshNowPlaying, 1500);
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
      await api('/recroom/speakers/group-favorites', 'POST', { members: selectedMembers() });
      setLastPlayed('Liked Music (YouTube Music)');
      flash('Playing Liked Music');
      setTimeout(refreshNowPlaying, 1500);
    } catch (err) {
      setMusicError(err.message);
      flash('Music: error — see details below');
    } finally {
      setIsGrouping(false);
    }
  }

  async function stopAudio() {
    try {
      await api('/recroom/speakers/stop', 'POST');
      flash('Whole-Home Audio: Stopped');
      setTimeout(refreshNowPlaying, 500);
    } catch (err) {
      flash(`Error: ${err.message}`);
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
      await api('/recroom/speakers/group-play-playlist', 'POST', {
        uri: selectedPlaylist,
        members: selectedMembers(),
      });
      const match = playlists.find((p) => p.uri === selectedPlaylist);
      setLastPlayed(match?.name || 'Selected playlist');
      flash(`Playing: ${match?.name || 'playlist'}`);
      setTimeout(refreshNowPlaying, 1500);
    } catch (err) {
      setMusicError(err.message);
      flash('Music: error — see details below');
    } finally {
      setIsGrouping(false);
    }
  }

  const mediaTitle = nowPlaying?.attributes?.media_title;
  const mediaArtist = nowPlaying?.attributes?.media_artist;
  const hasArt = !!nowPlaying?.attributes?.entity_picture;
  const isPlaying = nowPlaying?.state === 'playing';

  return (
    <div className={styles.page}>
      {flashMsg && <div className={styles.flash}>{flashMsg}</div>}

      {/* ── ENTERTAINMENT SYSTEM ── */}
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
        </div>

        <VolumeSlider id="ent-vol" denonStatus={denonStatus} onChange={denonVolume} />

        <div className={styles.consoleRow}>
          <h3>Play a Console</h3>
          <div className={styles.consoleGrid}>
            <button className={styles.btn} onClick={() => denonInput(DENON_SOURCE_XBOX, 'Xbox')}>Play Xbox</button>
            <button className={styles.btn} onClick={() => denonInput(DENON_SOURCE_PS5, 'PS5')}>Play PS5</button>
            <button className={styles.btn} onClick={() => denonInput(DENON_SOURCE_SWITCH2, 'Switch 2')}>Play Switch 2</button>
          </div>
        </div>
      </section>

      {/* ── WHOLE-HOME AUDIO ── */}
      <section className={`${styles.section} ${styles.wholeHome}`}>
        <h2>Whole-Home Audio</h2>
        <p className={styles.hint}>
          Home Theater is always included as the group leader. Toggle the other speakers before playing something.
        </p>

        <div className={styles.waBody}>
          <div className={styles.artBox}>
            {hasArt ? (
              <img
                src={`/api/ha/media-thumbnail/${MASS_HOME_THEATER_ID}?t=${nowPlaying?.last_updated || ''}`}
                alt="Album art"
                onError={(e) => { e.currentTarget.style.opacity = 0.2; }}
              />
            ) : (
              <span>No album art</span>
            )}
          </div>

          <div className={styles.waInfo}>
            <div>
              <div className={styles.nowPlayingTitle}>{mediaTitle || 'Nothing playing'}</div>
              {mediaArtist && <div className={styles.nowPlayingArtist}>{mediaArtist}</div>}
            </div>

            <button className={styles.btn} onClick={stopAudio} disabled={!isPlaying}>■ Stop</button>

            <div className={styles.speakerList}>
              <span className={`${styles.speakerLabel} ${styles.disabled}`}>
                <input type="checkbox" checked disabled />
                Home Theater
              </span>
              {TOGGLEABLE_SPEAKERS.map((s) => (
                <label key={s.key} className={styles.speakerLabel}>
                  <input type="checkbox" checked={speakerSelection[s.key]} onChange={() => toggleSpeaker(s.key)} />
                  {s.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.musicRow}>
          <input
            type="text"
            className={styles.musicInput}
            placeholder="Search a song or artist…"
            value={musicQuery}
            onChange={(e) => setMusicQuery(e.target.value)}
            onKeyDown={handleMusicKeyDown}
            disabled={isGrouping}
          />
          <button className={styles.btn} onClick={playSearch} disabled={isGrouping || !musicQuery.trim()}>
            {isGrouping ? 'Working…' : 'Search & Play'}
          </button>
          <button className={styles.btn} onClick={playLikedMusic} disabled={isGrouping}>
            {isGrouping ? 'Working…' : '▶ Liked Music'}
          </button>
        </div>

        <div className={styles.musicRow}>
          <select
            className={styles.musicSelect}
            value={selectedPlaylist}
            onChange={(e) => setSelectedPlaylist(e.target.value)}
            disabled={isGrouping || isLoadingPlaylists || !playlists.length}
          >
            {!playlists.length && <option value="">No playlists loaded</option>}
            {playlists.map((p) => (
              <option key={p.uri} value={p.uri}>{p.name}</option>
            ))}
          </select>
          <button className={styles.btn} onClick={playSelectedPlaylist} disabled={isGrouping || !selectedPlaylist}>
            {isGrouping ? 'Working…' : 'Play'}
          </button>
          <button className={styles.btn} onClick={loadPlaylists} disabled={isLoadingPlaylists} title="Reload if you just added a playlist in YT Music">
            {isLoadingPlaylists ? '…' : '⟳'}
          </button>
        </div>

        {playlistError && <div className={styles.musicErrorBox}>Couldn't load playlists: {playlistError}</div>}
        {lastPlayed && !musicError && <div className={styles.status}>Last requested: {lastPlayed}</div>}
        {musicError && <div className={styles.musicErrorBox}>Playback failed: {musicError}</div>}
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
      </section>
    </div>
  );
}
