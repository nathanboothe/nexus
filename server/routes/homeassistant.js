import { Router } from 'express';
import config from '../config.js';

const router = Router();
const { url: HA_URL, token: HA_TOKEN } = config.homeAssistant;

async function haCall(path, method = 'GET', body) {
  const res = await fetch(`${HA_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${HA_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HA ${method} ${path} -> ${res.status}: ${text}`);
  }
  const contentType = res.headers.get('content-type') || '';
  return contentType.includes('application/json') ? res.json() : res.text();
}

// Used by recroom.js/denon.js to call any HA service (remote.send_command, etc.)
// Pass { returnResponse: true } for actions that return data (e.g. music_assistant.search)
export async function callService(domain, service, data, options = {}) {
  const query = options.returnResponse ? '?return_response=true' : '';
  return haCall(`/api/services/${domain}/${service}${query}`, 'POST', data);
}

export async function getState(entityId) {
  return haCall(`/api/states/${entityId}`);
}

// Simple connectivity check
router.get('/ping', async (_req, res) => {
  try {
    await haCall('/api/');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/state/:entityId', async (req, res) => {
  try {
    const state = await getState(req.params.entityId);
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ALL STATES ── returns every entity in HA — client groups by domain
router.get('/states', async (_req, res) => {
  try {
    const states = await haCall('/api/states');
    res.json(states);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GENERIC SERVICE CALL ── body: { domain, service, data }
// Lets the client control any entity type (lights, switches, locks, climate,
// covers, etc.) without a bespoke route for each one.
router.post('/service', async (req, res) => {
  try {
    const { domain, service, data } = req.body;
    await callService(domain, service, data);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CAMERA SNAPSHOT ── proxies HA's authenticated camera_proxy endpoint so
// the browser never needs a direct HA connection or token of its own.
router.get('/camera/:entityId', async (req, res) => {
  try {
    const response = await fetch(`${HA_URL}/api/camera_proxy/${req.params.entityId}`, {
      headers: { Authorization: `Bearer ${HA_TOKEN}` },
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: `HA returned ${response.status}` });
    }
    res.set('Content-Type', response.headers.get('content-type') || 'image/jpeg');
    res.set('Cache-Control', 'no-store');
    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── MEDIA ARTWORK ── proxies a media_player's entity_picture (album art).
//
// For most media players this works directly. But Music-Assistant-backed
// players (YouTube Music here) report an entity_picture pointing at MA's own
// internal image proxy on a Home-Assistant-Supervisor-internal network
// address (something like 172.30.32.1:8095) — reachable only from inside
// HA's own host, not via HA's remote/Nabu Casa URL, and not at all from
// Render. This is a known, currently-unresolved gap in the Music Assistant
// integration (see github.com/orgs/music-assistant/discussions/4833) — not
// something fixable by changing how this route fetches the image, since the
// address itself isn't routable from outside your LAN.
//
// Fallback: if the HA-reported entity_picture can't be reached, look the
// track up on Apple's public iTunes Search API (no key required) by
// title+artist and serve that artwork instead. Won't be perfect for obscure
// tracks, but covers the vast majority of a normal YouTube Music library.
router.get('/media-thumbnail/:entityId', async (req, res) => {
  try {
    const state = await getState(req.params.entityId);
    const picturePath = state.attributes?.entity_picture;

    if (picturePath) {
      const fullUrl = picturePath.startsWith('http') ? picturePath : `${HA_URL}${picturePath}`;
      try {
        const response = await fetch(fullUrl, {
          headers: { Authorization: `Bearer ${HA_TOKEN}` },
          signal: AbortSignal.timeout(4000),
        });
        if (response.ok) {
          res.set('Content-Type', response.headers.get('content-type') || 'image/jpeg');
          res.set('Cache-Control', 'no-store');
          const buffer = Buffer.from(await response.arrayBuffer());
          return res.send(buffer);
        }
      } catch {
        // Fall through to the iTunes fallback below — almost certainly an
        // unreachable Music-Assistant-internal address, not worth surfacing
        // as its own error.
      }
    }

    const title = state.attributes?.media_title;
    const artist = state.attributes?.media_artist;
    if (!title) {
      return res.status(404).json({ error: 'No entity_picture and no title to fall back on' });
    }

    const term = encodeURIComponent(artist ? `${artist} ${title}` : title);
    const itunesRes = await fetch(
      `https://itunes.apple.com/search?term=${term}&entity=song&limit=1`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!itunesRes.ok) {
      return res.status(404).json({ error: 'iTunes lookup failed' });
    }
    const itunesData = await itunesRes.json();
    const artworkUrl = itunesData?.results?.[0]?.artworkUrl100;
    if (!artworkUrl) {
      return res.status(404).json({ error: 'No artwork found via fallback lookup' });
    }

    // iTunes thumbnails default to 100x100 — bump to a larger size by
    // swapping the size in the filename (documented iTunes convention).
    const largerArtwork = artworkUrl.replace('100x100', '600x600');

    const artResponse = await fetch(largerArtwork, { signal: AbortSignal.timeout(4000) });
    if (!artResponse.ok) {
      return res.status(404).json({ error: 'Fallback artwork fetch failed' });
    }
    res.set('Content-Type', artResponse.headers.get('content-type') || 'image/jpeg');
    res.set('Cache-Control', 'no-store');
    const buffer = Buffer.from(await artResponse.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;