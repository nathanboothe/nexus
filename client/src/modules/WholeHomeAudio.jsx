import { useState, useEffect, useRef } from 'react';
import api from '../api.js';
import styles from './WholeHomeAudio.module.css';

// Must match config.js entities.massHomeTheater on the backend — this is the
// Music Assistant group leader every play/now-playing/album-art call targets.
const MASS_HOME_THEATER_ID = 'media_player.home_theater_3';

// Speakers that can be toggled in/out of the Whole-Home Audio group. Home
// Theater isn't listed here — it's the group leader every play_media call
// targets, so it's always included regardless of these toggles.
const TOGGLEABLE_SPEAKERS = [
  { key: 'massKitchen', label: 'Kitchen' },
  { key: 'massLivingRoom', label: 'Living Room' },
  { key: 'massLoft', label: 'Loft' },
];

// Bass (tone control) slider — same PSBAS-backed endpoint and same caveats
// as the identical control on the Entertainment System page: -6dB to +6dB
// in 1dB steps, no real read-back from the Denon protocol (starts at 0/flat
// on every load regardless of the receiver's actual current setting), and
// it's a receiver-wide EQ setting so it affects whatever's playing
// regardless of source — HEOS Music here, TV/consoles on the other page.
// Only commits on release rather than firing a request on every drag step.
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

export default function WholeHomeAudio() {
  const [flashMsg, setFlashMsg] = useState('');
  const [musicQuery, setMusicQuery] = useState('');
  const [isGrouping, setIsGrouping] = useState(false);
  const [musicError, setMusicError] = useState('');
  const [lastPlayed, setLastPlayed] = useState('');

  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState('');
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [playlistError, setPlaylistError] = useState('');

  const [nowPlaying, setNowPlaying] = useState(null);
  const [speakerSelection, setSpeakerSelection] = useState({
    massKitchen: true,
    massLivingRoom: true,
    massLoft: true,
  });

  useEffect(() => {
    loadPlaylists();
    refreshNowPlaying();
    const id = setInterval(refreshNowPlaying, 5000);
    return () => clearInterval(id);
  }, []);

  function flash(msg) {
    setFlashMsg(msg);
    setTimeout(() => setFlashMsg(''), 2000);
  }

  async function refreshNowPlaying() {
    try {
      const state = await api(`/ha/state/${MASS_HOME_THEATER_ID}`);
      setNowPlaying(state);
    } catch (err) {
      console.error(err);
    }
  }

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

  async function denonBass(db) {
    try {
      await api('/denon/bass', 'POST', { db });
      flash(`Bass: ${db > 0 ? '+' : ''}${db} dB`);
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

      <div className={styles.header}>
        <h1>Whole-Home Audio</h1>
        <p className={styles.hint}>
          Home Theater is always included as the group leader. Toggle the other speakers before playing something.
        </p>
      </div>

      <div className={styles.body}>
        {/* LEFT: art, now playing, transport, speakers */}
        <div className={styles.left}>
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

          <div className={styles.nowPlayingTitle}>{mediaTitle || 'Nothing playing'}</div>
          {mediaArtist && <div className={styles.nowPlayingArtist}>{mediaArtist}</div>}

          <button className={`${styles.btn} ${styles.stopBtn}`} onClick={stopAudio} disabled={!isPlaying}>
            ■ Stop
          </button>

          <BassSlider id="wha-bass" onChange={denonBass} />

          <div className={styles.speakerSection}>
            <h3>Speakers in group</h3>
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

        {/* RIGHT: search, liked music, playlists */}
        <div className={styles.right}>
          <section className={styles.card}>
            <h3>Search &amp; Play</h3>
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
            </div>
            <button className={styles.btn} onClick={playLikedMusic} disabled={isGrouping}>
              {isGrouping ? 'Working…' : '▶ Play Liked Music'}
            </button>
          </section>

          <section className={styles.card}>
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
          </section>

          {lastPlayed && !musicError && <div className={styles.status}>Last requested: {lastPlayed}</div>}
          {musicError && <div className={styles.musicErrorBox}>Playback failed: {musicError}</div>}
        </div>
      </div>
    </div>
  );
}
