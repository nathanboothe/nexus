// adapters/googleCalendar.js
import fetch from 'node-fetch';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import os from 'os';

const TOKEN_PATH = join(os.homedir(), '.nexus_google_token.json');
const TOKEN_URL  = 'https://oauth2.googleapis.com/token';
const AUTH_URL   = 'https://accounts.google.com/o/oauth2/v2/auth';
const CAL_BASE   = 'https://www.googleapis.com/calendar/v3';

// These are stored in config.js
let CLIENT_ID;
let CLIENT_SECRET;
let REDIRECT_URI;

export function initGoogle(clientId, clientSecret, redirectUri) {
  CLIENT_ID     = clientId;
  CLIENT_SECRET = clientSecret;
  REDIRECT_URI  = redirectUri;
}

function loadToken() {
  try {
    if (existsSync(TOKEN_PATH)) return JSON.parse(readFileSync(TOKEN_PATH, 'utf8'));
  } catch {}
  return null;
}

function saveToken(token) {
  writeFileSync(TOKEN_PATH, JSON.stringify({ ...token, acquired_at: Date.now() }, null, 2));
}

async function refreshToken(token) {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: token.refresh_token,
    grant_type:    'refresh_token',
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
  throw new Error(`Google token refresh failed: ${data.error_description || data.error}`);
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

async function calRequest(path, method = 'GET', body) {
  const accessToken = await getAccessToken();
  const res = await fetch(`${CAL_BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Google Calendar error ${res.status}`);
  }
  return res.json();
}

// Get events from primary Google calendar
export async function getGoogleEvents(startDate, endDate) {
  const start = startDate || new Date().toISOString();
  const end   = endDate   || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const params = new URLSearchParams({
    timeMin:      start,
    timeMax:      end,
    maxResults:   '50',
    orderBy:      'startTime',
    singleEvents: 'true',
  });

  const data = await calRequest(`/calendars/primary/events?${params}`);
  return (data.items || []).map(e => ({
    id:     `google_${e.id}`,
    source: 'google',
    title:  e.summary || '(No title)',
    start:  e.start?.dateTime || e.start?.date,
    end:    e.end?.dateTime   || e.end?.date,
    allDay: !e.start?.dateTime,
    notes:  e.description,
    location: e.location,
    category: 'Google',
  }));
}

// Create event in Google Calendar
export async function createGoogleEvent(event) {
  const body = {
    summary:     event.title,
    description: event.notes || '',
    location:    event.location || '',
    start: event.allDay
      ? { date: event.start?.split('T')[0] }
      : { dateTime: event.start, timeZone: 'America/New_York' },
    end: event.allDay
      ? { date: (event.end || event.start)?.split('T')[0] }
      : { dateTime: event.end || event.start, timeZone: 'America/New_York' },
  };
  return calRequest('/calendars/primary/events', 'POST', body);
}

// OAuth flow — get auth URL
export function getAuthUrl(state) {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/calendar',
    access_type:   'offline',
    prompt:        'consent',
    state:         state || 'nexus',
  });
  return `${AUTH_URL}?${params}`;
}

// Exchange auth code for token
export async function exchangeCode(code) {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri:  REDIRECT_URI,
    grant_type:    'authorization_code',
    code,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const data = await res.json();
  if (data.access_token) {
    saveToken(data);
    return { ok: true };
  }
  return { ok: false, error: data.error_description || data.error };
}

export function isAuthenticated() {
  return existsSync(TOKEN_PATH);
}
