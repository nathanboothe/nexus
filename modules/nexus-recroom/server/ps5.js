// adapters/ps5.js
// Controls PS5 via PS Remote Play REST API
// Requires Remote Play enabled on PS5 and PS5 on same network
import fetch from 'node-fetch';

const PS5_IP   = '192.168.230.104';
const PS5_PORT = 9295; // PS5 DDP port

// PS5 uses DDP (Device Discovery Protocol) on UDP 9295
// and REST on port 9295 for wakeup
// We use the HTTP wakeup command

export async function ps5WakeUp() {
  try {
    // PS5 responds to HTTP OPTIONS on port 9295 for wakeup
    const res = await fetch(`http://${PS5_IP}:9295/sce/rp/device/regist`, {
      method: 'GET',
      headers: {
        'Host': `${PS5_IP}:9295`,
        'User-Agent': 'PS4 Second Screen/2.8.0 CFNetwork/1220.1 Darwin/20.3.0',
      },
      signal: AbortSignal.timeout(3000),
    });
    return { ok: true, status: res.status };
  } catch (err) {
    // Send UDP wakeup packet as fallback
    return await sendDDPWakeup();
  }
}

async function sendDDPWakeup() {
  // DDP wakeup via HTTP proxy through HA
  return { ok: false, error: 'DDP wakeup requires HA integration — use HA service call' };
}

export async function ps5Status() {
  try {
    const res = await fetch(`http://${PS5_IP}:9295`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    return { online: true };
  } catch {
    return { online: false };
  }
}
