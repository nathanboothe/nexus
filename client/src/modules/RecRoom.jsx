import { useState } from 'react';
import { ha, denon, recroom } from '../api.js';
import styles from './RecRoom.module.css';

// Entity IDs
const SAMSUNG_REMOTE = 'remote.base_station';
const DENON_ENTITY = 'media_player.home_theater_2';
const GOOGLE_TV_REMOTE = 'remote.rec_room_google_tv';
const GOOGLE_TV_MEDIA = 'media_player.rec_room_google_tv_3';

// Samsung IR commands via Broadlink
const SAMSUNG_CMDS = {
  power:      'KEY_POWER',
  volUp:      'KEY_VOLUMEUP',
  volDown:    'KEY_VOLUMEDOWN',
  mute:       'KEY_MUTE',
  up:         'KEY_UP',
  down:       'KEY_DOWN',
  left:       'KEY_LEFT',
  right:      'KEY_RIGHT',
  ok:         'KEY_ENTER',
  back:       'KEY_BACK',
  home:       'KEY_HOME',
  menu:       'KEY_MENU',
  info:       'KEY_INFO',
  ch_up:      'KEY_CHUP',
  ch_down:    'KEY_CHDOWN',
  num1: 'KEY_1', num2: 'KEY_2', num3: 'KEY_3',
  num4: 'KEY_4', num5: 'KEY_5', num6: 'KEY_6',
  num7: 'KEY_7', num8: 'KEY_8', num9: 'KEY_9',
  num0: 'KEY_0',
  source:     'KEY_SOURCE',
  hdmi1:      'KEY_HDMI1',
};

// Google TV Android TV Remote commands
const GOOGLE_CMDS = {
  up:       'UP',
  down:     'DOWN',
  left:     'LEFT',
  right:    'RIGHT',
  ok:       'CENTER',
  back:     'BACK',
  home:     'HOME',
  menu:     'MENU',
  power:    'POWER',
  volUp:    'VOLUME_UP',
  volDown:  'VOLUME_DOWN',
  mute:     'MUTE',
  play:     'MEDIA_PLAY',
  pause:    'MEDIA_PAUSE',
  stop:     'MEDIA_STOP',
  next:     'MEDIA_NEXT',
  prev:     'MEDIA_PREVIOUS',
  rewind:   'MEDIA_REWIND',
  forward:  'MEDIA_FAST_FORWARD',
};

// Streaming apps — launched via Google TV media player source
const APPS = [
  { name: 'Netflix',      source: 'Netflix',       icon: '🎬' },
  { name: 'YouTube',      source: 'YouTube',        icon: '▶️' },
  { name: 'Disney+',      source: 'Disney+',        icon: '✨' },
  { name: 'Max',          source: 'Max',            icon: '🎭' },
  { name: 'Hulu',         source: 'Hulu',           icon: '💚' },
  { name: 'Prime Video',  source: 'Prime Video',    icon: '📦' },
  { name: 'Plex',         source: 'Plex',           icon: '🔶' },
  { name: 'Spotify',      source: 'Spotify',        icon: '🎵' },
];

// Denon inputs
const DENON_INPUTS = [
  { label: 'TV Audio', cmd: 'SITV' },
  { label: 'HDMI 1',   cmd: 'SIBD' },
  { label: 'HDMI 2',   cmd: 'SIAUX1' },
  { label: 'HDMI 3',   cmd: 'SIAUX2' },
  { label: 'Blu-ray',  cmd: 'SIBD' },
  { label: 'Game',     cmd: 'SIGAME' },
];

async function sendSamsung(command) {
  return ha.service('remote', 'send_command', {
    entity_id: SAMSUNG_REMOTE,
    command,
  });
}

async function sendGoogleTV(command) {
  return ha.service('remote', 'send_command', {
    entity_id: GOOGLE_TV_REMOTE,
    command,
  });
}

async function sendDenon(cmd) {
  return denon.command(cmd);
}

async function launchApp(source) {
  return ha.service('media_player', 'select_source', {
    entity_id: GOOGLE_TV_MEDIA,
    source,
  });
}

async function googleTVPower(on) {
  return ha.service('media_player', on ? 'turn_on' : 'turn_off', {
    entity_id: GOOGLE_TV_MEDIA,
  });
}

export default function RecRoom() {
  const [activeDevice, setActiveDevice] = useState('googletv');
  const [denonVol, setDenonVol] = useState(50);
  const [feedback, setFeedback] = useState('');
  const [groupQuery, setGroupQuery] = useState('');
  const [groupBusy, setGroupBusy] = useState(false);

  function flash(msg) {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 1500);
  }

  async function handleSamsung(key) {
    try { await sendSamsung(SAMSUNG_CMDS[key]); flash(`Samsung: ${key}`); }
    catch { flash('Samsung command failed'); }
  }

  async function handleGoogleTV(key) {
    try { await sendGoogleTV(GOOGLE_CMDS[key]); flash(`Google TV: ${key}`); }
    catch { flash('Google TV command failed'); }
  }

  async function handleDenon(cmd, label) {
    try { await sendDenon(cmd); flash(`Denon: ${label}`); }
    catch { flash('Denon command failed'); }
  }

  async function handleApp(app) {
    try { await launchApp(app.source); flash(`Launching ${app.name}...`); }
    catch { flash('App launch failed'); }
  }

  async function handleDenonVol(direction) {
    const cmd = direction === 'up' ? 'MVUP' : 'MVDOWN';
    try { await sendDenon(cmd); }
    catch {}
  }

  async function handleGroupSearch() {
    if (!groupQuery.trim()) { flash('Enter a search first'); return; }
    setGroupBusy(true);
    try {
      await recroom.groupSearchPlay(groupQuery.trim());
      flash(`Playing: ${groupQuery.trim()}`);
    } catch (err) {
      flash(`Search failed: ${err.message}`);
    }
    setGroupBusy(false);
  }

  async function handleGroupFavorites() {
    setGroupBusy(true);
    try {
      await recroom.groupFavorites();
      flash('Playing Liked Music');
    } catch (err) {
      flash(`Failed: ${err.message}`);
    }
    setGroupBusy(false);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>Rec room</h1>
          <p className="text-muted text-sm">TV · receiver · streamer</p>
        </div>
        {feedback && <div className={styles.feedback}>{feedback}</div>}
      </div>

      {/* Device tabs */}
      <div className={styles.deviceTabs}>
        <button className={`${styles.deviceTab} ${activeDevice === 'googletv' ? styles.deviceTabActive : ''}`}
          onClick={() => setActiveDevice('googletv')}>
          <span>▶</span> Google TV
        </button>
        <button className={`${styles.deviceTab} ${activeDevice === 'samsung' ? styles.deviceTabActive : ''}`}
          onClick={() => setActiveDevice('samsung')}>
          <span>📺</span> Samsung TV
        </button>
        <button className={`${styles.deviceTab} ${activeDevice === 'denon' ? styles.deviceTabActive : ''}`}
          onClick={() => setActiveDevice('denon')}>
          <span>🔊</span> Denon AVR
        </button>
      </div>

      {/* Grouped speakers */}
      <div className={styles.section} style={{ marginBottom: 20 }}>
        <p className={styles.sectionLabel}>Rec Room + Speakers</p>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
          Kitchen · Living Room · Loft
        </p>
        <div className={styles.topRow} style={{ marginBottom: 10 }}>
          <button className={styles.btn} onClick={handleGroupFavorites} disabled={groupBusy}>
            ▶ Play Liked Music
          </button>
        </div>
        <div className={styles.searchRow}>
          <input
            className={styles.searchInput}
            type="text"
            value={groupQuery}
            onChange={e => setGroupQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleGroupSearch(); }}
            placeholder="Search YouTube Music..."
            disabled={groupBusy}
          />
          <button className={styles.btn} onClick={handleGroupSearch} disabled={groupBusy}>
            Play
          </button>
        </div>
      </div>

      {/* ── GOOGLE TV ── */}
      {activeDevice === 'googletv' && (
        <div className={styles.remote}>
          {/* Power + Volume */}
          <div className={styles.topRow}>
            <button className={`${styles.btn} ${styles.btnPower}`} onClick={() => googleTVPower(true)}>Power On</button>
            <button className={`${styles.btn} ${styles.btnPower} ${styles.btnPowerOff}`} onClick={() => googleTVPower(false)}>Power Off</button>
            <button className={styles.btn} onClick={() => handleGoogleTV('volUp')}>Vol +</button>
            <button className={styles.btn} onClick={() => handleGoogleTV('mute')}>Mute</button>
            <button className={styles.btn} onClick={() => handleGoogleTV('volDown')}>Vol −</button>
          </div>

          {/* D-pad */}
          <div className={styles.dpad}>
            <button className={`${styles.dpadBtn} ${styles.dpadUp}`} onClick={() => handleGoogleTV('up')}>▲</button>
            <button className={`${styles.dpadBtn} ${styles.dpadLeft}`} onClick={() => handleGoogleTV('left')}>◀</button>
            <button className={`${styles.dpadBtn} ${styles.dpadOk}`} onClick={() => handleGoogleTV('ok')}>OK</button>
            <button className={`${styles.dpadBtn} ${styles.dpadRight}`} onClick={() => handleGoogleTV('right')}>▶</button>
            <button className={`${styles.dpadBtn} ${styles.dpadDown}`} onClick={() => handleGoogleTV('down')}>▼</button>
          </div>

          {/* Nav buttons */}
          <div className={styles.navRow}>
            <button className={styles.btn} onClick={() => handleGoogleTV('back')}>← Back</button>
            <button className={styles.btn} onClick={() => handleGoogleTV('home')}>⌂ Home</button>
            <button className={styles.btn} onClick={() => handleGoogleTV('menu')}>☰ Menu</button>
          </div>

          {/* Playback */}
          <div className={styles.playbackRow}>
            <button className={styles.btn} onClick={() => handleGoogleTV('prev')}>⏮</button>
            <button className={styles.btn} onClick={() => handleGoogleTV('rewind')}>⏪</button>
            <button className={`${styles.btn} ${styles.btnPlay}`} onClick={() => handleGoogleTV('play')}>▶</button>
            <button className={styles.btn} onClick={() => handleGoogleTV('pause')}>⏸</button>
            <button className={styles.btn} onClick={() => handleGoogleTV('forward')}>⏩</button>
            <button className={styles.btn} onClick={() => handleGoogleTV('next')}>⏭</button>
          </div>

          {/* Apps */}
          <div className={styles.section}>
            <p className={styles.sectionLabel}>Launch app</p>
            <div className={styles.appGrid}>
              {APPS.map(app => (
                <button key={app.name} className={styles.appBtn} onClick={() => handleApp(app)}>
                  <span className={styles.appIcon}>{app.icon}</span>
                  <span className={styles.appName}>{app.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SAMSUNG TV ── */}
      {activeDevice === 'samsung' && (
        <div className={styles.remote}>
          <div className={styles.topRow}>
            <button className={`${styles.btn} ${styles.btnPower}`} onClick={() => handleSamsung('power')}>Power</button>
            <button className={styles.btn} onClick={() => handleSamsung('source')}>Source</button>
            <button className={styles.btn} onClick={() => handleSamsung('info')}>Info</button>
            <button className={styles.btn} onClick={() => handleSamsung('menu')}>Menu</button>
          </div>

          <div className={styles.topRow}>
            <button className={styles.btn} onClick={() => handleSamsung('volUp')}>Vol +</button>
            <button className={styles.btn} onClick={() => handleSamsung('mute')}>Mute</button>
            <button className={styles.btn} onClick={() => handleSamsung('volDown')}>Vol −</button>
            <button className={styles.btn} onClick={() => handleSamsung('ch_up')}>Ch +</button>
            <button className={styles.btn} onClick={() => handleSamsung('ch_down')}>Ch −</button>
          </div>

          <div className={styles.dpad}>
            <button className={`${styles.dpadBtn} ${styles.dpadUp}`} onClick={() => handleSamsung('up')}>▲</button>
            <button className={`${styles.dpadBtn} ${styles.dpadLeft}`} onClick={() => handleSamsung('left')}>◀</button>
            <button className={`${styles.dpadBtn} ${styles.dpadOk}`} onClick={() => handleSamsung('ok')}>OK</button>
            <button className={`${styles.dpadBtn} ${styles.dpadRight}`} onClick={() => handleSamsung('right')}>▶</button>
            <button className={`${styles.dpadBtn} ${styles.dpadDown}`} onClick={() => handleSamsung('down')}>▼</button>
          </div>

          <div className={styles.navRow}>
            <button className={styles.btn} onClick={() => handleSamsung('back')}>← Back</button>
            <button className={styles.btn} onClick={() => handleSamsung('home')}>⌂ Home</button>
          </div>

          {/* Number pad */}
          <div className={styles.section}>
            <p className={styles.sectionLabel}>Channel / Number</p>
            <div className={styles.numpad}>
              {[1,2,3,4,5,6,7,8,9,'',0,''].map((n, i) => (
                <button key={i} className={`${styles.numBtn} ${n === '' ? styles.numBtnEmpty : ''}`}
                  onClick={() => n !== '' && handleSamsung(`num${n}`)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── DENON AVR ── */}
      {activeDevice === 'denon' && (
        <div className={styles.remote}>
          {/* Power */}
          <div className={styles.topRow}>
            <button className={`${styles.btn} ${styles.btnPower}`} onClick={() => handleDenon('PWON', 'Power On')}>Power On</button>
            <button className={`${styles.btn} ${styles.btnPowerOff}`} onClick={() => handleDenon('PWSTANDBY', 'Standby')}>Standby</button>
          </div>

          {/* Volume */}
          <div className={styles.section}>
            <p className={styles.sectionLabel}>Volume</p>
            <div className={styles.volRow}>
              <button className={`${styles.btn} ${styles.btnLarge}`} onClick={() => handleDenonVol('down')}>Vol −</button>
              <button className={styles.btn} onClick={() => handleDenon('MUON', 'Mute')}>Mute</button>
              <button className={styles.btn} onClick={() => handleDenon('MUOFF', 'Unmute')}>Unmute</button>
              <button className={`${styles.btn} ${styles.btnLarge}`} onClick={() => handleDenonVol('up')}>Vol +</button>
            </div>
          </div>

          {/* Inputs */}
          <div className={styles.section}>
            <p className={styles.sectionLabel}>Input</p>
            <div className={styles.inputGrid}>
              {DENON_INPUTS.map(inp => (
                <button key={inp.cmd} className={styles.inputBtn}
                  onClick={() => handleDenon(inp.cmd, inp.label)}>
                  {inp.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sound modes */}
          <div className={styles.section}>
            <p className={styles.sectionLabel}>Sound mode</p>
            <div className={styles.inputGrid}>
              {[
                { label: 'Movie',   cmd: 'MSMOVIE' },
                { label: 'Music',   cmd: 'MSMUSIC' },
                { label: 'Game',    cmd: 'MSGAME' },
                { label: 'Pure',    cmd: 'MSPURE DIRECT' },
                { label: 'Stereo',  cmd: 'MSSTEREO' },
                { label: 'Auto',    cmd: 'MSAUTO' },
              ].map(m => (
                <button key={m.cmd} className={styles.inputBtn}
                  onClick={() => handleDenon(m.cmd, m.label)}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}