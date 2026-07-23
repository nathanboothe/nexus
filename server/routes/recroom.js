import { Router } from 'express';
import config from '../config.js';
import { callService } from './homeassistant.js';

const router = Router();

const BROADLINK_ENTITY = config.entities.broadlink;             // remote.base_station
const GOOGLE_TV_REMOTE_ENTITY = config.entities.googleTvRemote;  // remote.rec_room_google_tv
const DENON_ENTITY = config.entities.denon;                      // media_player.home_theater_2

const MASS_GROUP = [
  config.entities.massHomeTheater,
  config.entities.massKitchen,
  config.entities.massLivingRoom,
  config.entities.massLoft,
];

// Keyed the same way config.entities is, so the frontend can send which
// speakers it wants included without needing to know raw entity IDs.
const MASS_GROUP_MAP = {
  massHomeTheater: config.entities.massHomeTheater,
  massKitchen: config.entities.massKitchen,
  massLivingRoom: config.entities.massLivingRoom,
  massLoft: config.entities.massLoft,
};

// body.members is an array of keys from MASS_GROUP_MAP (e.g. ['massHomeTheater',
// 'massKitchen']). Home Theater is always included since it's the group leader
// every play_media call targets — omitting it would break playback entirely,
// not just skip that speaker. Empty/missing members = everyone (old behavior).
function resolveMembers(memberKeys) {
  if (!Array.isArray(memberKeys) || !memberKeys.length) {
    return MASS_GROUP;
  }
  const keys = new Set(memberKeys);
  keys.add('massHomeTheater');
  return [...keys].map((k) => MASS_GROUP_MAP[k]).filter(Boolean);
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── SAMSUNG TV (Broadlink IR via HA) ────────────────────────────────────────
// body: { command: 'power' | 'volume_up' | 'volume_down' | 'channel_up' | 'channel_down' | 'mute' }
router.post('/samsung/command', async (req, res) => {
  try {
    const { command } = req.body;
    await callService('remote', 'send_command', {
      entity_id: BROADLINK_ENTITY,
      device: 'TV',
      command,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GOOGLE TV NAVIGATION (HA Android TV integration) ────────────────────────
// Confirmed: ADB keyevents do NOT work on this device for D-pad/nav — only HA's
// Android TV integration works. body: { command: 'DPAD_UP' | 'DPAD_CENTER' | 'BACK' | 'HOME' | ... }
router.post('/googletv/nav', async (req, res) => {
  try {
    const { command } = req.body;
    await callService('remote', 'send_command', {
      entity_id: GOOGLE_TV_REMOTE_ENTITY,
      command,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GOOGLE TV APP LAUNCH ─────────────────────────────────────────────────────
// This device uses HA's official "Android TV Remote" integration, not the
// older ADB-based one — there's no adb_command service. Instead, remote.turn_on
// accepts an `activity` field targeting the remote entity (same one nav uses),
// and it takes the same package/activity format already used for these apps.
// body: { activity: 'com.netflix.ninja/.MainActivity' }
router.post('/googletv/launch', async (req, res) => {
  try {
    const { activity } = req.body;
    await callService('remote', 'turn_on', {
      entity_id: GOOGLE_TV_REMOTE_ENTITY,
      activity,
    });
    res.json({ ok: true, activity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── SPEAKER GROUPING: helper to switch Denon to HEOS Music + join the group ──
async function prepAndJoinGroup(members) {
  await callService('media_player', 'select_source', {
    entity_id: DENON_ENTITY,
    source: 'HEOS Music',
  });
  await delay(3000);
  await callService('media_player', 'join', {
    entity_id: config.entities.massHomeTheater,
    group_members: members,
  });
}

// ── SPEAKER GROUP: SEARCH & PLAY (YouTube Music) ──
// body: { query: 'Fear NF' }
router.post('/speakers/group-search', async (req, res) => {
  try {
    const { query, members } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'query is required' });
    }

    await prepAndJoinGroup(resolveMembers(members));

    const searchResult = await callService(
      'music_assistant',
      'search',
      {
        config_entry_id: config.musicAssistant.configEntryId,
        name: query.trim(),
        media_type: 'track',
        limit: 1,
      },
      { returnResponse: true }
    );

    // HA wraps response-returning service calls under service_response
    const payload = searchResult?.service_response ?? searchResult ?? {};
    const track = payload?.tracks?.[0];

    if (!track?.uri) {
      return res.status(404).json({ error: 'No matching track found', raw: payload });
    }

    await callService('music_assistant', 'play_media', {
      entity_id: config.entities.massHomeTheater,
      media_id: track.uri,
      media_type: 'track',
      enqueue: 'replace',
    });

    res.json({ ok: true, played: track.uri });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── SPEAKER GROUP: PLAY YOUTUBE MUSIC LIKED SONGS ──
router.post('/speakers/group-favorites', async (req, res) => {
  try {
    await prepAndJoinGroup(resolveMembers(req.body?.members));

    await callService('music_assistant', 'play_media', {
      entity_id: config.entities.massHomeTheater,
      media_id: config.musicAssistant.likedMusicUri,
      media_type: 'playlist',
      enqueue: 'replace',
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── LIBRARY: LIST SYNCED PLAYLISTS ──
// Pulls directly from Music Assistant's synced library (music_assistant.get_library),
// which now includes whatever YouTube Music has synced in — Liked Music, Episodes
// for Later, and any other personal playlists added via the YT Music web app.
// This is a read-only library query, NOT a play action, so it does not touch
// the Denon or join any group.
router.get('/speakers/playlists', async (req, res) => {
  try {
    const libraryResult = await callService(
      'music_assistant',
      'get_library',
      {
        config_entry_id: config.musicAssistant.configEntryId,
        media_type: 'playlist',
        limit: 50,
        order_by: 'name',
      },
      { returnResponse: true }
    );

    const payload = libraryResult?.service_response ?? libraryResult ?? {};
    const items = payload?.items ?? [];

    const playlists = items
      .filter((item) => item?.uri && item?.name)
      .map((item) => ({ name: item.name, uri: item.uri }));

    res.json({ ok: true, playlists });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── SPEAKER GROUP: PLAY A SPECIFIC SYNCED PLAYLIST ──
// body: { uri: 'library://playlist/12' }
router.post('/speakers/group-play-playlist', async (req, res) => {
  try {
    const { uri, members } = req.body;
    if (!uri) {
      return res.status(400).json({ error: 'uri is required' });
    }

    await prepAndJoinGroup(resolveMembers(members));

    await callService('music_assistant', 'play_media', {
      entity_id: config.entities.massHomeTheater,
      media_id: uri,
      media_type: 'playlist',
      enqueue: 'replace',
    });

    res.json({ ok: true, played: uri });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── SPEAKER GROUP: STOP ──
// Stops playback on the group leader. Since Music Assistant playback is
// driven through Home Theater regardless of which speakers are joined,
// stopping the leader stops the shared session for everyone in the group.
router.post('/speakers/stop', async (_req, res) => {
  try {
    await callService('media_player', 'media_stop', {
      entity_id: config.entities.massHomeTheater,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
