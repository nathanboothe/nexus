// ════════════════════════════════════════════════════════════════
// integrations/raindrop.js
//
// Talks to the Raindrop.io REST API for your bookmarks.
// Same pattern as the others.
// ════════════════════════════════════════════════════════════════

import axios from "axios";

const TOKEN = process.env.RAINDROP_TOKEN;

function isConfigured() {
  return TOKEN && !TOKEN.startsWith("REPLACE_ME");
}

const client = isConfigured()
  ? axios.create({
      baseURL: "https://api.raindrop.io/rest/v1",
      headers: { Authorization: `Bearer ${TOKEN}` },
      timeout: 8000,
    })
  : null;

// ── getStatus ───────────────────────────────────────────────────
export async function getStatus() {
  if (!isConfigured()) {
    return { ok: false, configured: false, message: "Raindrop not set up yet" };
  }
  try {
    // /user returns your account info; a success means the token works.
    await client.get("/user");
    return { ok: true, configured: true, message: "Connected" };
  } catch {
    return { ok: false, configured: true, message: "Could not reach Raindrop" };
  }
}

// ── getBookmarks ────────────────────────────────────────────────
// Returns recent bookmarks. collectionId 0 = "all bookmarks".
export async function getBookmarks() {
  if (!isConfigured()) return [];
  try {
    const res = await client.get("/raindrops/0", {
      params: { perpage: 20, sort: "-created" }, // 20 newest
    });
    // Raindrop wraps the list in res.data.items
    return res.data?.items ?? [];
  } catch {
    throw new Error("Could not fetch Raindrop bookmarks");
  }
}
