// adapters/outlookCalendar.js
// Uses the existing Genealogy Automation Personal Azure app
// Requires Calendars.Read + Calendars.ReadWrite permissions

import fetch from 'node-fetch';
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import os from 'os';
import config from '../config.js';

const TOKEN_PATH = join(os.homedir(), '.nexus_outlook_token.json');
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const TOKEN_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
const AUTH_URL  = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize';

const SCOPES = [
  'offline_access',
  'Calendars.Read',
  'Calendars.ReadWrite',
  'User.Read',
].join(' ');

function loadToken() {
  try {
    if (existsSync(TOKEN_PATH)) {
      return JSON.parse(readFileSync(TOKEN_PATH, 'utf8'));
    }
  } catch {}
  return null;
}

function saveToken(token) {
  writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
}

async function refreshToken(token) {
  const params = new URLSearchParams({
    client_id:     config.graph.clientId,
    grant_type:    'refresh_token',
    refresh_token: token.refresh_token,
    scope:         SCOPES,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const data = await res.json();
  if (data.access_token) {
    const newToken = { ...token, ...data, acquired_at: Date.now() };
    saveToken(newToken);
    return newToken;
  }
  throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
}

async function getAccessToken() {
  let token = loadToken();
  if (!token) throw new Error('NOT_AUTHENTICATED');

  const expiresAt = (token.acquired_at || 0) + ((token.expires_in || 3600) * 1000);
  if (Date.now() > expiresAt - 60000) {
    token = await refreshToken(token);
  }
  return token.access_token;
}

async function graphRequest(path, method = 'GET', body) {
  const accessToken = await getAccessToken();
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Graph error ${res.status}`);
  }
  return res.json();
}

// Get events from Outlook calendar
export async function getOutlookEvents(startDate, endDate) {
  const start = startDate || new Date().toISOString();
  const end   = endDate   || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const data = await graphRequest(
    `/me/calendarView?startDateTime=${start}&endDateTime=${end}&$top=50&$orderby=start/dateTime&$select=subject,start,end,isAllDay,bodyPreview,categories,location`
  );
  return (data.value || []).map(e => ({
    id:       `outlook_${e.id}`,
    source:   'outlook',
    title:    e.subject,
    start:    e.start?.dateTime || e.start?.date,
    end:      e.end?.dateTime   || e.end?.date,
    allDay:   e.isAllDay,
    notes:    e.bodyPreview,
    location: e.location?.displayName,
    category: e.categories?.[0] || 'Outlook',
  }));
}

// Create event in Outlook calendar
export async function createOutlookEvent(event) {
  const body = {
    subject: event.title,
    start: { dateTime: event.start, timeZone: 'America/New_York' },
    end:   { dateTime: event.end   || event.start, timeZone: 'America/New_York' },
    isAllDay: event.allDay || false,
    body: { contentType: 'text', content: event.notes || '' },
  };
  return graphRequest('/me/events', 'POST', body);
}

// Auth helpers — called from route to initiate device code flow
export async function startDeviceCodeFlow() {
  const params = new URLSearchParams({
    client_id: config.graph.clientId,
    scope:     SCOPES,
  });
  const res = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  return res.json();
}

export async function pollDeviceCodeFlow(deviceCode) {
  const params = new URLSearchParams({
    client_id:   config.graph.clientId,
    grant_type:  'urn:ietf:params:oauth:grant-type:device_code',
    device_code: deviceCode,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const data = await res.json();
  if (data.access_token) {
    saveToken({ ...data, acquired_at: Date.now() });
    return { ok: true };
  }
  return { ok: false, error: data.error };
}

export function isAuthenticated() {
  return existsSync(TOKEN_PATH);
}
