import { useState, useEffect, useCallback } from 'react';
import styles from './RecRoom.module.css';

// ── API helpers ──────────────────────────────────────────────────────
const api = (path, method = 'GET', body) =>
  fetch(`/api/recroom${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }).then(r => r.json()).catch(() => ({}));

// ── IR command sets ──────────────────────────────────────────────────
const SAMSUNG_IR = {
  power:    'KEY_POWER',
  volUp:    'KEY_VOLUMEUP',
  volDown:  'KEY_VOLUMEDOWN',
  mute:     'KEY_MUTE',
  up:       'KEY_UP',
  down:     'KEY_DOWN',
  left:     'KEY_LEFT',
  right:    'KEY_RIGHT',
  ok:       'KEY_ENTER',
  back:     'KEY_BACK',
  home:     'KEY_HOME',
  menu:     'KEY_MENU',
  info:     'KEY_INFO',
  source:   'KEY_SOURCE',
  chUp:     'KEY_CHUP',
  chDown:   'KEY_CHDOWN',
  num0: 'KEY_0', num1: 'KEY_1', num2: 'KEY_2', num3: 'KEY_3',
  num4: 'KEY_4', num5: 'KEY_5', num6: 'KEY_6', num7: 'KEY_7',
  num8: 'KEY_8', num9: 'KEY_9',
};

const GOOGLE_CMDS = {
  up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', ok: 'CENTER',
  back: 'BACK', home: 'HOME', menu: 'MENU', power: 'POWER',
  volUp: 'VOLUME_UP', volDown: 'VOLUME_DOWN', mute: 'MUTE',
  play: 'MEDIA_PLAY', pause: 'MEDIA_PAUSE', stop: 'MEDIA_STOP',
  next: 'MEDIA_NEXT', prev: 'MEDIA_PREVIOUS',
  rewind: 'MEDIA_REWIND', forward: 'MEDIA_FAST_FORWARD',
};

const SWITCH_IR = {
  power:  'SWITCH_POWER',
  home:   'SWITCH_HOME',
  minus:  'SWITCH_MINUS',
  plus:   'SWITCH_PLUS',
  up:     'SWITCH_UP',
  down:   'SWITCH_DOWN',
  left:   'SWITCH_LEFT',
  right:  'SWITCH_RIGHT',
  a:      'SWITCH_A',
  b:      'SWITCH_B',
  x:      'SWITCH_X',
  y:      'SWITCH_Y',
  l:      'SWITCH_L',
  r:      'SWITCH_R',
  zl:     'SWITCH_ZL',
  zr:     'SWITCH_ZR',
  capture:'SWITCH_CAPTURE',
};

const DENON_INPUTS = [
  { label: 'TV Audio', cmd: 'SITV' },
  { label: 'HDMI 1',  cmd: 'SIBD' },
  { label: 'HDMI 2',  cmd: 'SIAUX1' },
  { label: 'HDMI 3',  cmd: 'SIAUX2' },
  { label: 'HDMI 4',  cmd: 'SIAUX3' },
  { label: 'Xbox',    cmd: 'SIGAME' },
  { label: 'PS5',     cmd: 'SIGAME2' },
  { label: 'Switch',  cmd: 'SIGAME3' },
];

const DENON_SOUNDS = [
  { label: 'Movie',  cmd: 'MSMOVIE' },
  { label: 'Music',  cmd: 'MSMUSIC' },
  { label: 'Game',   cmd: 'MSGAME' },
  { label: 'Pure',   cmd: 'MSPURE DIRECT' },
  { label: 'Stereo', cmd: 'MSSTEREO' },
  { label: 'Auto',   cmd: 'MSAUTO' },
  { label: 'DTS',    cmd: 'MSDTS SURROUND' },
  { label: 'Dolby',  cmd: 'MSDOLBY DIGITAL' },
];

const STREAMING_APPS = [
  { name: 'Netflix',     source: 'Netflix' },
  { name: 'YouTube',     source: 'YouTube' },
  { name: 'Disney+',     source: 'Disney+' },
  { name: 'Max',         source: 'Max' },
  { name: 'Hulu',        source: 'Hulu' },
  { name: 'Prime',       source: 'Prime Video' },
  { name: 'Plex',        source: 'Plex' },
  { name: 'Spotify',     source: 'Spotify' },
  { name: 'Apple TV',    source: 'Apple TV' },
  { name: 'Peacock',     source: 'Peacock TV' },
  { name: 'Paramount+',  source: 'Paramount+' },
  { name: 'ESPN',        source: 'ESPN' },
];

const DEVICES = [
  { id: 'googletv', label: 'Google TV',  icon: 'G' },
  { id: 'samsung',  label: 'Samsung TV', icon: 'S' },
  { id: 'denon',    label: 'Denon AVR',  icon: 'D' },
  { id: 'xbox',     label: 'Xbox',       icon: 'X' },
  { id: 'ps5',      label: 'PS5',        icon: 'P' },
  { id: 'switch',   label: 'Switch',     icon: 'N' },
];

export default function RecRoom() {
  const [device, setDevice] = useState('googletv');
  const [feedback, setFeedback] = useState('');
  const [nowPlaying, setNowPlaying] = useState(null);
  const [xboxOnline, setXboxOnline] = useState(null);
  const [ps5Online, setPs5Online] = useState(null);

  function flash(msg) {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 1500);
  }

  // Now playing poll
  const loadNowPlaying = useCallback(async () => {
    try {
      const data = await api('/googletv/nowplaying');
      setNowPlaying(data);
    } catch {}
  }, []);

  useEffect(() => {
    loadNowPlaying();
    const interval = setInterval(loadNowPlaying, 10000);
    return () => clearInterval(interval);
  }, [loadNowPlaying]);

  // Console status
  useEffect(() => {
    api('/xbox/status').then(d => setXboxOnline(d.online));
    api('/ps5/status').then(d => setPs5Online(d.online));
  }, []);

  // Command handlers
  async function samsung(key) {
    await api('/samsung/ir', 'POST', { command: SAMSUNG_IR[key] });
    flash(`TV: ${key}`);
  }

  async function googleTV(key) {
    await api('/googletv/remote', 'POST', { command: GOOGLE_CMDS[key] });
    flash(`Google TV: ${key}`);
  }

  async function googleTVMedia(service, data = {}) {
    await api('/googletv/media', 'POST', { service, data });
    flash(`Google TV: ${service}`);
  }

  async function launchApp(source) {
    await api('/googletv/media', 'POST', { service: 'select_source', data: { source } });
    flash(`Launching ${source}...`);
  }

  async function denon(cmd, label) {
    await api('/denon/command', 'POST', { command: cmd });
    flash(`Denon: ${label}`);
  }

  async function switchIR(key) {
    await api('/switch/ir', 'POST', { command: SWITCH_IR[key] });
    flash(`Switch: ${key}`);
  }

  return (
    <div className={styles.page}>
      {/* Header + Now Playing */}
      <div className={styles.header}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>Rec room</h1>
          <p className="text-muted text-sm">Home theater control</p>
        </div>
        {nowPlaying && (
          <div className={styles.nowPlaying}>
            <div className={styles.npInfo}>
              <span className={styles.npState}>{nowPlaying.state === 'playing' ? '▶' : nowPlaying.state === 'paused' ? '⏸' : '■'}</span>
              <div>
                <p className={styles.npTitle}>{nowPlaying.title || nowPlaying.app || 'Google TV'}</p>
                {nowPlaying.artist && <p className="text-xs text-faint">{nowPlaying.artist}</p>}
                {nowPlaying.app && nowPlaying.title && <p className="text-xs text-faint">{nowPlaying.app}</p>}
              </div>
            </div>
            {nowPlaying.state === 'playing' || nowPlaying.state === 'paused' ? (
              <div className={styles.npControls}>
                <button className={styles.npBtn} onClick={() => googleTVMedia('media_previous_track')}>⏮</button>
                <button className={styles.npBtn} onClick={() => googleTVMedia(nowPlaying.state === 'playing' ? 'media_pause' : 'media_play')}>
                  {nowPlaying.state === 'playing' ? '⏸' : '▶'}
                </button>
                <button className={styles.npBtn} onClick={() => googleTVMedia('media_next_track')}>⏭</button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {feedback && <div className={styles.feedback}>{feedback}</div>}

      {/* Device selector */}
      <div className={styles.deviceBar}>
        {DEVICES.map(d => (
          <button key={d.id}
            className={`${styles.deviceBtn} ${device === d.id ? styles.deviceBtnActive : ''}`}
            onClick={() => setDevice(d.id)}>
            <span className={styles.deviceIcon}>{d.icon}</span>
            <span className={styles.deviceLabel}>{d.label}</span>
            {d.id === 'xbox' && xboxOnline !== null && (
              <span className={`dot ${xboxOnline ? 'dot-green' : 'dot-gray'}`} style={{ width: 6, height: 6 }} />
            )}
            {d.id === 'ps5' && ps5Online !== null && (
              <span className={`dot ${ps5Online ? 'dot-green' : 'dot-gray'}`} style={{ width: 6, height: 6 }} />
            )}
          </button>
        ))}
      </div>

      {/* ── GOOGLE TV ── */}
      {device === 'googletv' && (
        <div className={styles.remote}>
          <div className={styles.section}>
            <div className={styles.topRow}>
              <button className={`${styles.btn} ${styles.btnPower}`} onClick={() => googleTVMedia('turn_on')}>On</button>
              <button className={`${styles.btn} ${styles.btnOff}`} onClick={() => googleTVMedia('turn_off')}>Off</button>
              <button className={styles.btn} onClick={() => googleTV('volUp')}>Vol +</button>
              <button className={styles.btn} onClick={() => googleTV('mute')}>Mute</button>
              <button className={styles.btn} onClick={() => googleTV('volDown')}>Vol -</button>
            </div>
          </div>

          <Dpad onUp={() => googleTV('up')} onDown={() => googleTV('down')}
            onLeft={() => googleTV('left')} onRight={() => googleTV('right')}
            onOk={() => googleTV('ok')} />

          <div className={styles.section}>
            <div className={styles.navRow}>
              <button className={styles.btn} onClick={() => googleTV('back')}>Back</button>
              <button className={styles.btn} onClick={() => googleTV('home')}>Home</button>
              <button className={styles.btn} onClick={() => googleTV('menu')}>Menu</button>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.playbackRow}>
              <button className={styles.btn} onClick={() => googleTV('prev')}>⏮</button>
              <button className={styles.btn} onClick={() => googleTV('rewind')}>⏪</button>
              <button className={`${styles.btn} ${styles.btnPlay}`} onClick={() => googleTV('play')}>▶</button>
              <button className={styles.btn} onClick={() => googleTV('pause')}>⏸</button>
              <button className={styles.btn} onClick={() => googleTV('forward')}>⏩</button>
              <button className={styles.btn} onClick={() => googleTV('next')}>⏭</button>
            </div>
          </div>

          <div className={styles.section}>
            <p className={styles.sectionLabel}>Streaming apps</p>
            <div className={styles.appGrid}>
              {STREAMING_APPS.map(app => (
                <button key={app.name} className={styles.appBtn} onClick={() => launchApp(app.source)}>
                  {app.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SAMSUNG TV ── */}
      {device === 'samsung' && (
        <div className={styles.remote}>
          <div className={styles.section}>
            <div className={styles.topRow}>
              <button className={`${styles.btn} ${styles.btnPower}`} onClick={() => samsung('power')}>Power</button>
              <button className={styles.btn} onClick={() => samsung('source')}>Source</button>
              <button className={styles.btn} onClick={() => samsung('info')}>Info</button>
              <button className={styles.btn} onClick={() => samsung('menu')}>Menu</button>
            </div>
            <div className={styles.topRow} style={{ marginTop: 8 }}>
              <button className={styles.btn} onClick={() => samsung('volUp')}>Vol +</button>
              <button className={styles.btn} onClick={() => samsung('mute')}>Mute</button>
              <button className={styles.btn} onClick={() => samsung('volDown')}>Vol -</button>
              <button className={styles.btn} onClick={() => samsung('chUp')}>Ch +</button>
              <button className={styles.btn} onClick={() => samsung('chDown')}>Ch -</button>
            </div>
          </div>

          <Dpad onUp={() => samsung('up')} onDown={() => samsung('down')}
            onLeft={() => samsung('left')} onRight={() => samsung('right')}
            onOk={() => samsung('ok')} />

          <div className={styles.section}>
            <div className={styles.navRow}>
              <button className={styles.btn} onClick={() => samsung('back')}>Back</button>
              <button className={styles.btn} onClick={() => samsung('home')}>Home</button>
            </div>
          </div>

          <div className={styles.section}>
            <p className={styles.sectionLabel}>Number pad</p>
            <div className={styles.numpad}>
              {[1,2,3,4,5,6,7,8,9,'',0,''].map((n, i) => (
                <button key={i}
                  className={`${styles.numBtn} ${n === '' ? styles.numBtnEmpty : ''}`}
                  onClick={() => n !== '' && samsung(`num${n}`)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── DENON AVR ── */}
      {device === 'denon' && (
        <div className={styles.remote}>
          <div className={styles.section}>
            <div className={styles.topRow}>
              <button className={`${styles.btn} ${styles.btnPower}`} onClick={() => denon('PWON', 'Power On')}>Power On</button>
              <button className={`${styles.btn} ${styles.btnOff}`} onClick={() => denon('PWSTANDBY', 'Standby')}>Standby</button>
            </div>
          </div>

          <div className={styles.section}>
            <p className={styles.sectionLabel}>Volume</p>
            <div className={styles.topRow}>
              <button className={`${styles.btn} ${styles.btnLarge}`} onClick={() => denon('MVDOWN', 'Vol -')}>Vol -</button>
              <button className={styles.btn} onClick={() => denon('MUON', 'Mute')}>Mute</button>
              <button className={styles.btn} onClick={() => denon('MUOFF', 'Unmute')}>Unmute</button>
              <button className={`${styles.btn} ${styles.btnLarge}`} onClick={() => denon('MVUP', 'Vol +')}>Vol +</button>
            </div>
          </div>

          <div className={styles.section}>
            <p className={styles.sectionLabel}>Input</p>
            <div className={styles.inputGrid}>
              {DENON_INPUTS.map(inp => (
                <button key={inp.cmd} className={styles.inputBtn}
                  onClick={() => denon(inp.cmd, inp.label)}>
                  {inp.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <p className={styles.sectionLabel}>Sound mode</p>
            <div className={styles.inputGrid}>
              {DENON_SOUNDS.map(m => (
                <button key={m.cmd} className={styles.inputBtn}
                  onClick={() => denon(m.cmd, m.label)}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <p className={styles.sectionLabel}>Zone & misc</p>
            <div className={styles.inputGrid}>
              {[
                { label: 'Zone 2 On',  cmd: 'Z2ON' },
                { label: 'Zone 2 Off', cmd: 'Z2OFF' },
                { label: 'Eco On',     cmd: 'ECOMODE ON' },
                { label: 'Eco Off',    cmd: 'ECOMODE OFF' },
                { label: 'Sleep 30',   cmd: 'SLP030' },
                { label: 'Sleep Off',  cmd: 'SLPOFF' },
              ].map(m => (
                <button key={m.cmd} className={styles.inputBtn}
                  onClick={() => denon(m.cmd, m.label)}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── XBOX ── */}
      {device === 'xbox' && (
        <div className={styles.remote}>
          <div className={styles.section}>
            <p className={styles.sectionLabel}>
              Xbox Series X
              <span className={`dot ${xboxOnline ? 'dot-green' : 'dot-gray'}`}
                style={{ width: 8, height: 8, marginLeft: 8, display: 'inline-block' }} />
              <span className="text-xs text-faint" style={{ marginLeft: 4 }}>
                {xboxOnline === null ? 'checking...' : xboxOnline ? 'Online' : 'Offline'}
              </span>
            </p>
            <div className={styles.topRow}>
              <button className={`${styles.btn} ${styles.btnPower}`}
                onClick={async () => { await api('/xbox/power', 'POST', { on: true }); flash('Xbox: Power On'); }}>
                Power On
              </button>
              <button className={`${styles.btn} ${styles.btnOff}`}
                onClick={async () => { await api('/xbox/power', 'POST', { on: false }); flash('Xbox: Power Off'); }}>
                Power Off
              </button>
            </div>
          </div>
          <div className={styles.section}>
            <p className="text-muted text-sm">
              Xbox controller functions require the physical controller or the Xbox app.
              Power on/off is available via Xbox network protocol when Xbox is in Instant-On mode.
            </p>
            <p className="text-muted text-sm" style={{ marginTop: 8 }}>
              To add full Xbox remote control, enable the Xbox SmartGlass integration in Home Assistant
              and the commands will appear here automatically.
            </p>
          </div>
        </div>
      )}

      {/* ── PS5 ── */}
      {device === 'ps5' && (
        <div className={styles.remote}>
          <div className={styles.section}>
            <p className={styles.sectionLabel}>
              PlayStation 5
              <span className={`dot ${ps5Online ? 'dot-green' : 'dot-gray'}`}
                style={{ width: 8, height: 8, marginLeft: 8, display: 'inline-block' }} />
              <span className="text-xs text-faint" style={{ marginLeft: 4 }}>
                {ps5Online === null ? 'checking...' : ps5Online ? 'Online' : 'Standby/Off'}
              </span>
            </p>
            <div className={styles.topRow}>
              <button className={`${styles.btn} ${styles.btnPower}`}
                onClick={async () => { await api('/ps5/wakeup', 'POST'); flash('PS5: Wake up sent'); }}>
                Wake Up
              </button>
              <button className={`${styles.btn} ${styles.btnOff}`}
                onClick={async () => { await api('/ps5/poweroff', 'POST'); flash('PS5: Power off'); }}>
                Power Off
              </button>
            </div>
          </div>
          <div className={styles.section}>
            <p className="text-muted text-sm">
              PS5 controller functions require the DualSense controller or PS Remote Play app.
              Wake from rest mode is available via PS5 network protocol.
            </p>
            <p className="text-muted text-sm" style={{ marginTop: 8 }}>
              For full PS5 control, add the PlayStation integration to Home Assistant using your PSN credentials.
            </p>
          </div>
        </div>
      )}

      {/* ── SWITCH ── */}
      {device === 'switch' && (
        <div className={styles.remote}>
          <div className={styles.section}>
            <p className={styles.sectionLabel}>Nintendo Switch 2</p>
            <div className={styles.topRow}>
              <button className={`${styles.btn} ${styles.btnPower}`} onClick={() => switchIR('power')}>Power</button>
              <button className={styles.btn} onClick={() => switchIR('home')}>Home</button>
              <button className={styles.btn} onClick={() => switchIR('capture')}>Capture</button>
              <button className={styles.btn} onClick={() => switchIR('minus')}>-</button>
              <button className={styles.btn} onClick={() => switchIR('plus')}>+</button>
            </div>
          </div>

          <Dpad onUp={() => switchIR('up')} onDown={() => switchIR('down')}
            onLeft={() => switchIR('left')} onRight={() => switchIR('right')}
            onOk={() => switchIR('a')} />

          <div className={styles.section}>
            <p className={styles.sectionLabel}>Buttons</p>
            <div className={styles.switchButtons}>
              <button className={`${styles.switchBtn} ${styles.switchBtnY}`} onClick={() => switchIR('y')}>Y</button>
              <button className={`${styles.switchBtn} ${styles.switchBtnX}`} onClick={() => switchIR('x')}>X</button>
              <button className={`${styles.switchBtn} ${styles.switchBtnB}`} onClick={() => switchIR('b')}>B</button>
              <button className={`${styles.switchBtn} ${styles.switchBtnA}`} onClick={() => switchIR('a')}>A</button>
            </div>
          </div>

          <div className={styles.section}>
            <p className={styles.sectionLabel}>Shoulder buttons</p>
            <div className={styles.topRow}>
              <button className={styles.btn} onClick={() => switchIR('l')}>L</button>
              <button className={styles.btn} onClick={() => switchIR('zl')}>ZL</button>
              <button className={styles.btn} onClick={() => switchIR('r')}>R</button>
              <button className={styles.btn} onClick={() => switchIR('zr')}>ZR</button>
            </div>
          </div>

          <div className={styles.section}>
            <p className="text-muted text-sm">
              Switch IR commands require Broadlink IR codes to be programmed for each button.
              Commands are sent via remote.base_station. Program codes in HA Broadlink integration.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Dpad({ onUp, onDown, onLeft, onRight, onOk }) {
  return (
    <div className={styles.dpad}>
      <button className={`${styles.dpadBtn} ${styles.dpadUp}`} onClick={onUp}>▲</button>
      <button className={`${styles.dpadBtn} ${styles.dpadLeft}`} onClick={onLeft}>◀</button>
      <button className={`${styles.dpadBtn} ${styles.dpadOk}`} onClick={onOk}>OK</button>
      <button className={`${styles.dpadBtn} ${styles.dpadRight}`} onClick={onRight}>▶</button>
      <button className={`${styles.dpadBtn} ${styles.dpadDown}`} onClick={onDown}>▼</button>
    </div>
  );
}
