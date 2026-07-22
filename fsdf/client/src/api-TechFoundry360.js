// api.js — all backend calls go through here

const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || ('HTTP ' + res.status));
  }
  return res.json();
}

export default function api(path, method = 'GET', body) {
  return request(path, {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
}

export const health = () => request('/health');

export const airtable = {
  list: (table, params = {}) => request('/airtable/' + table + '?' + new URLSearchParams(params)),
  create: (table, fields) => request('/airtable/' + table, { method: 'POST', body: JSON.stringify(fields) }),
  update: (table, recordId, fields) => request('/airtable/' + table + '/' + recordId, { method: 'PATCH', body: JSON.stringify(fields) }),
  delete: (table, recordId) => request('/airtable/' + table + '/' + recordId, { method: 'DELETE' }),
};

export const ha = {
  states: () => request('/ha/states'),
  state: (entityId) => request('/ha/states/' + entityId),
  service: (domain, service, data = {}) => request('/ha/service', { method: 'POST', body: JSON.stringify({ domain, service, data }) }),
  script: (scriptId) => request('/ha/script', { method: 'POST', body: JSON.stringify({ scriptId }) }),
};

export const denon = {
  status: () => request('/denon/status'),
  command: (command) => request('/denon/command', { method: 'POST', body: JSON.stringify({ command }) }),
};

export const recroom = {
  samsung: (command) => request('/recroom/samsung/command', { method: 'POST', body: JSON.stringify({ command }) }),
  googleTvNav: (command) => request('/recroom/googletv/nav', { method: 'POST', body: JSON.stringify({ command }) }),
  googleTvLaunch: (activity) => request('/recroom/googletv/launch', { method: 'POST', body: JSON.stringify({ activity }) }),
  groupSearchPlay: (query) => request('/recroom/speakers/group-search', { method: 'POST', body: JSON.stringify({ query }) }),
  groupFavorites: () => request('/recroom/speakers/group-favorites', { method: 'POST' }),
};

export const genealogy = {
  upload: (file) => {
    const form = new FormData();
    form.append('document', file);
    return fetch(BASE + '/genealogy/upload', { method: 'POST', body: form }).then((r) => r.json());
  },
  run: (jsonFile) => request('/genealogy/run', { method: 'POST', body: JSON.stringify({ jsonFile }) }),
  log: () => request('/genealogy/log'),
  logEntry: (runId) => request('/genealogy/log/' + runId),
};

export function connectWebSocket(onMessage) {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(protocol + '://' + window.location.host);
  ws.onmessage = (e) => onMessage(JSON.parse(e.data));
  ws.onclose = () => setTimeout(() => connectWebSocket(onMessage), 3000);
  return ws;
}