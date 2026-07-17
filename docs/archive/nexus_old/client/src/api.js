// api.js — all backend calls go through here
const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Health ────────────────────────────────────────────────────────────
export const health = () => request('/health');

// ── Airtable ──────────────────────────────────────────────────────────
export const airtable = {
  list: (table, params = {}) => {
    const { filterByFormula, ...rest } = params;
    const query = new URLSearchParams(rest).toString();
    const formula = filterByFormula
      ? '&filterByFormula=' + encodeURIComponent(filterByFormula)
      : '';
    return request(`/airtable/${table}?${query}${formula}`);
  },
  create: (table, fields) => request(`/airtable/${table}`, { method: 'POST', body: JSON.stringify(fields) }),
  update: (table, recordId, fields) => request(`/airtable/${table}/${recordId}`, { method: 'PATCH', body: JSON.stringify(fields) }),
  delete: (table, recordId) => request(`/airtable/${table}/${recordId}`, { method: 'DELETE' }),
};

// ── Home Assistant ────────────────────────────────────────────────────
export const ha = {
  states: () => request('/ha/states'),
  state: (entityId) => request(`/ha/states/${entityId}`),
  service: (domain, service, data = {}) => request('/ha/service', { method: 'POST', body: JSON.stringify({ domain, service, data }) }),
  script: (scriptId) => request('/ha/script', { method: 'POST', body: JSON.stringify({ scriptId }) }),
};

// ── Denon ─────────────────────────────────────────────────────────────
export const denon = {
  status: () => request('/denon/status'),
  command: (command) => request('/denon/command', { method: 'POST', body: JSON.stringify({ command }) }),
};

// ── Genealogy ─────────────────────────────────────────────────────────
export const genealogy = {
  upload: (file) => {
    const form = new FormData();
    form.append('document', file);
    return fetch(`${BASE}/genealogy/upload`, { method: 'POST', body: form }).then(r => r.json());
  },
  run: (jsonFile) => request('/genealogy/run', { method: 'POST', body: JSON.stringify({ jsonFile }) }),
  log: () => request('/genealogy/log'),
  logEntry: (runId) => request(`/genealogy/log/${runId}`),
};

// ── WebSocket ─────────────────────────────────────────────────────────
export function connectWebSocket(onMessage) {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${protocol}://${window.location.host}`);
  ws.onmessage = (e) => onMessage(JSON.parse(e.data));
  ws.onclose = () => setTimeout(() => connectWebSocket(onMessage), 3000);
  return ws;
}