// api.js — all backend calls go through here

const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch('${BASE}${path}', {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'HTTP ${res.status}');
  }
  return res.json();
}

// ── Default export ───────────────────────────────────────────────────
// Some older modules (e.g. GoveeLights.jsx) call this directly as
// api(path, method, body) instead of using the named helpers below.
// Both styles hit the same request() function underneath.
export default function api(path, method = 'GET', body) {
  return request(path, {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── Health ────────────────────────────────────────────────────────────
export const health = () => request('/health');

// ── Airtable ──────────────────────────────────────────────────────────
export const airtable = {
  list: (table, params = {}) => request('/airtable/${table}?${new URLSearchParams(params)}'),
  create: (table, fields) => request('/airtable/${table}', { method: 'POST', body: JSON.stringify(fields) }),
  update: (table, recordId, fields) => request('/airtable/${table}/${recordId}', { method: 'PATCH', body: JSON.stringify(fields) }),
  delete: (table, recordId) => request('/airtable/${table}/${recordId}', { method: 'DELETE' }),
};

// ── Home Assistant ────────────────────────────────────────────────────
export const ha = {
  states: () => request('/ha/states'),
  state: (entityId) => request('/ha/states/${entityId}'),
  service: (domain, service, data = {}) => request('/ha/service', { method: 'POST', body: JSON.stringify({ domain, service, data }) }),
  script: (scriptId) => request('/ha/script', { method: 'POST', body: JSON.stringify({ scriptId }) }),
};

// ── Denon ─────────────────────────────────────────────────────────────
export const denon = {
  status: () =>