// adapters/xbox.js
// Controls Xbox Series X via Xbox SmartGlass protocol
import fetch from 'node-fetch';

const XBOX_IP = '192.168.230.242';

// Xbox uses REST API on port 5557 when SmartGlass is enabled
// Requires Xbox to be in Instant-On mode and on same network
const BASE = `http://${XBOX_IP}:5557`;

export async function xboxPowerOn() {
  try {
    const res = await fetch(`${BASE}/device/power`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'On' }),
      signal: AbortSignal.timeout(3000),
    });
    return { ok: res.ok };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function xboxPowerOff() {
  try {
    const res = await fetch(`${BASE}/device/power`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'Off' }),
      signal: AbortSignal.timeout(3000),
    });
    return { ok: res.ok };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function xboxStatus() {
  try {
    const res = await fetch(`${BASE}/device`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const data = await res.json();
      return { online: true, state: data };
    }
    return { online: false };
  } catch {
    return { online: false };
  }
}
