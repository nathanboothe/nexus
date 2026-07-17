import { ha, denon } from '../api.js';

export default function RecRoom() {
  async function sendIR(command) {
    try {
      await ha.service('remote', 'send_command', {
        entity_id: 'remote.base_station',
        command,
      });
    } catch (err) {
      console.error('IR command failed:', err);
    }
  }

  async function denonCmd(cmd) {
    try {
      await denon.command(cmd);
    } catch (err) {
      console.error('Denon command failed:', err);
    }
  }

  return (
    <div className="page-narrow">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Rec room</h1>
        <p className="text-muted text-sm">Samsung TV · Denon AVR · Google TV Streamer</p>
      </div>

      {/* Samsung TV */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Samsung TV (Broadlink IR)</h2>
        <div className="grid-4" style={{ gap: 8 }}>
          {[
            { label: 'Power', cmd: 'KEY_POWER' },
            { label: 'Vol +', cmd: 'KEY_VOLUMEUP' },
            { label: 'Vol −', cmd: 'KEY_VOLUMEDOWN' },
            { label: 'Mute', cmd: 'KEY_MUTE' },
            { label: 'Home', cmd: 'KEY_HOME' },
            { label: 'Back', cmd: 'KEY_BACK' },
            { label: 'Up', cmd: 'KEY_UP' },
            { label: 'OK', cmd: 'KEY_ENTER' },
          ].map(b => (
            <button
              key={b.cmd}
              onClick={() => sendIR(b.cmd)}
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '10px 4px',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                color: 'var(--text)',
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Denon AVR */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Denon AVR-S970H</h2>
        <div className="grid-4" style={{ gap: 8 }}>
          {[
            { label: 'Power on', cmd: 'PWON' },
            { label: 'Standby', cmd: 'PWSTANDBY' },
            { label: 'Vol +', cmd: 'MVUP' },
            { label: 'Vol −', cmd: 'MVDOWN' },
            { label: 'Mute', cmd: 'MUON' },
            { label: 'Unmute', cmd: 'MUOFF' },
            { label: 'HDMI 1', cmd: 'SIBD' },
            { label: 'HDMI 2', cmd: 'SIAUX1' },
          ].map(b => (
            <button
              key={b.cmd}
              onClick={() => denonCmd(b.cmd)}
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '10px 4px',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                color: 'var(--text)',
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Google TV */}
      <div className="card">
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Google TV Streamer</h2>
        <div className="grid-4" style={{ gap: 8 }}>
          {[
            { label: 'Home', svc: 'media_player.home' },
            { label: 'Netflix', svc: 'media_player.netflix' },
          ].map(b => (
            <button
              key={b.label}
              onClick={() => ha.service('media_player', 'select_source', { entity_id: 'media_player.google_tv', source: b.label })}
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '10px 4px',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                color: 'var(--text)',
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
        <p className="text-muted text-sm" style={{ marginTop: 12 }}>
          Full Google TV controls require Android TV integration in HA. Google Cast alone is insufficient.
        </p>
      </div>
    </div>
  );
}
