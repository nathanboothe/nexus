import { useState, useEffect } from 'react';
import api from '../api.js';
import shared from './shared/shared.module.css';
import styles from './TvReceiver.module.css';
import { VolumeSlider, BassSlider } from './shared/SharedControls.jsx';

// PLACEHOLDER — confirm this matches the exact command name used when the
// input/source IR code was learned on the Broadlink hub (remote.base_station,
// device 'TV'). Broadlink is fire-and-forget with no state read-back, so a
// wrong string here fails silently (button does nothing, no error surfaced).
// If it's wrong, this is the only line that needs to change.
const SAMSUNG_INPUT_COMMAND = 'source';

const SAMSUNG_COMMANDS = [
  { label: 'Power', command: 'power' },
  { label: 'Input', command: SAMSUNG_INPUT_COMMAND },
  { label: 'Vol +', command: 'volume_up' },
  { label: 'Vol -', command: 'volume_down' },
  { label: 'Mute', command: 'mute' },
  { label: 'Ch +', command: 'channel_up' },
  { label: 'Ch -', command: 'channel_down' },
];

export default function TvReceiver() {
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

  async function denonBass(db) {
    try {
      await api('/denon/bass', 'POST', { db });
      flash(`Bass: ${db > 0 ? '+' : ''}${db} dB`);
    } catch (err) {
      flash(`Error: ${err.message}`);
    }
  }

  const isDirectMode = denonStatus?.soundMode && /direct/i.test(denonStatus.soundMode);

  return (
    <div className={styles.page}>
      {flashMsg && <div className={shared.flash}>{flashMsg}</div>}

      {/* ── Samsung TV ── */}
      <section className={`${shared.section} ${styles.samsungCard}`}>
        <h2>Samsung TV</h2>
        <div className={shared.grid}>
          {SAMSUNG_COMMANDS.map((c) =>
            c.command === 'power' ? (
              <button key={c.command} className={shared.btn} onClick={() => samsungCommand('power')}>{c.label}</button>
            ) : (
              <button key={c.command} className={shared.btn} onClick={() => samsungCommand(c.command)}>{c.label}</button>
            )
          )}
        </div>
      </section>

      {/* ── Denon AVR ── */}
      <section className={`${shared.section} ${styles.denonCard}`}>
        <h2>Denon AVR</h2>
        {denonStatus && (
          <div className={shared.status}>
            Power: {denonStatus.power ?? '—'} · Input: {denonStatus.input ?? '—'} · Vol: {denonStatus.volume ?? '—'} · Mute: {denonStatus.mute ?? '—'}
          </div>
        )}
        <div className={shared.grid}>
          <button className={shared.btn} onClick={() => denonPower(true)}>Power On</button>
          <button className={shared.btn} onClick={() => denonPower(false)}>Standby</button>
          <button className={shared.btn} onClick={() => denonMute(true)}>Mute</button>
          <button className={shared.btn} onClick={() => denonMute(false)}>Unmute</button>
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
