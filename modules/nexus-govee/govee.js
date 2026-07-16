import fetch from 'node-fetch';
import config from '../config.js';

const BASE = 'https://developer-api.govee.com/v1';
const headers = () => ({
  'Govee-API-Key': config.govee.apiKey,
  'Content-Type': 'application/json',
});

// GET all devices
export async function getDevices() {
  const res = await fetch(`${BASE}/devices`, { headers: headers() });
  const data = await res.json();
  return data.data?.devices || [];
}

// GET device state
export async function getDeviceState(device, model) {
  const res = await fetch(
    `${BASE}/devices/state?device=${encodeURIComponent(device)}&model=${encodeURIComponent(model)}`,
    { headers: headers() }
  );
  const data = await res.json();
  return data.data || {};
}

// PUT control device
export async function controlDevice(device, model, cmd) {
  const res = await fetch(`${BASE}/devices/control`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ device, model, cmd }),
  });
  return res.json();
}

// High-level commands
export async function setPower(device, model, on) {
  return controlDevice(device, model, { name: 'turn', value: on ? 'on' : 'off' });
}

export async function setBrightness(device, model, brightness) {
  // brightness 1-100
  return controlDevice(device, model, { name: 'brightness', value: Math.min(100, Math.max(1, brightness)) });
}

export async function setColor(device, model, r, g, b) {
  return controlDevice(device, model, { name: 'color', value: { r, g, b } });
}

export async function setColorTemp(device, model, kelvin) {
  // kelvin typically 2000-9000
  return controlDevice(device, model, { name: 'colorTem', value: kelvin });
}
