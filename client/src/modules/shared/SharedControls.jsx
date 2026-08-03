import { useState, useEffect, useRef } from 'react';
import styles from './shared.module.css';

// Controlled by real Denon state (not defaultValue), so the handle always
// starts at the actual current volume instead of wherever it last happened
// to render. While the user is actively dragging, incoming status refreshes
// are ignored so the slider doesn't jump mid-drag; once they release, the
// chosen value is sent and the slider re-syncs to whatever HA reports next.
export function VolumeSlider({ id, denonStatus, onChange }) {
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
export function BassSlider({ id, onChange }) {
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
