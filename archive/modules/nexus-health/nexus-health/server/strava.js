// adapters/strava.js
import fetch from 'node-fetch';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import os from 'os';

const TOKEN_PATH = join(os.homedir(), '.nexus_strava_token.json');
const TOKEN_URL  = 'https://www.strava.com/oauth/token';
const API_BASE   = 'https://www.strava.com/api/v3';

let CLIENT_ID;
let CLIENT_SECRET;

export function initStrava(clientId, clientSecret) {
  CLIENT_ID     = clientId;
  CLIENT_SECRET = clientSecret;
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
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: token.refresh_token,
      grant_type:    'refresh_token',
    }),
  });
  const data = await res.json();
  if (data.access_token) {
    saveToken(data);
    return data;
  }
  throw new Error(`Strava refresh failed: ${data.message || JSON.stringify(data)}`);
}

async function getAccessToken() {
  let token = loadToken();
  if (!token) throw new Error('NOT_AUTHENTICATED');
  if (Date.now() / 1000 > (token.expires_at - 60)) {
    token = await refreshToken(token);
  }
  return token.access_token;
}

async function stravaRequest(path) {
  const accessToken = await getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Strava error ${res.status}`);
  }
  return res.json();
}

export function getAuthUrl(redirectUri) {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope:         'activity:read_all',
  });
  return `https://www.strava.com/oauth/authorize?${params}`;
}

export async function exchangeCode(code) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type:    'authorization_code',
    }),
  });
  const data = await res.json();
  if (data.access_token) {
    saveToken(data);
    return { ok: true, athlete: data.athlete };
  }
  return { ok: false, error: data.message || JSON.stringify(data) };
}

export async function getActivities(perPage = 30, page = 1) {
  return stravaRequest(`/athlete/activities?per_page=${perPage}&page=${page}`);
}

export async function getAthlete() {
  return stravaRequest('/athlete');
}

export function isAuthenticated() {
  return existsSync(TOKEN_PATH);
}

// Map Strava activity to Nexus workout format
export function mapActivity(activity) {
  const typeMap = {
    Run: 'Run', Ride: 'Ride', Walk: 'Walk', Swim: 'Swim',
    WeightTraining: 'Strength', Workout: 'HIIT', Yoga: 'Yoga',
  };
  return {
    Title:               activity.name,
    Date:                activity.start_date?.split('T')[0],
    Type:                typeMap[activity.type] || 'Other',
    'Duration minutes':  Math.round((activity.moving_time || 0) / 60),
    Distance:            activity.distance ? parseFloat((activity.distance / 1609.34).toFixed(2)) : null,
    'Distance unit':     'miles',
    Calories:            activity.calories || null,
    'Heart rate avg':    activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
    Source:              'Strava',
    'Strava ID':         activity.id?.toString(),
    Notes:               activity.description || '',
  };
}
