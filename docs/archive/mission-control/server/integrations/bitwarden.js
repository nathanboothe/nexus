// ════════════════════════════════════════════════════════════════
// integrations/bitwarden.js
//
// Talks to the Bitwarden CLI's local REST API (`bw serve`).
//
// HOW BITWARDEN WORKS HERE (read this once and it'll click):
//   - The `bw` CLI can run a tiny local web server: `bw serve`.
//   - That server exposes endpoints like /status and /list/object/items.
//   - It only returns vault data when the vault is UNLOCKED.
//   - Because it's local-only (localhost), we never expose your vault
//     to the internet. That's why we run this whole dashboard at home.
//
// Same pattern as firewalla.js: read config from env, expose
// normalized functions (getStatus, getHealth).
// ════════════════════════════════════════════════════════════════

import axios from "axios";

// Where `bw serve` is listening. Default set in .env.example.
const BASE = process.env.BITWARDEN_SERVE_URL || "http://localhost:8087";

const client = axios.create({ baseURL: BASE, timeout: 8000 });

// ── getStatus ───────────────────────────────────────────────────
// Tells us whether the vault is unlocked, locked, or unreachable.
export async function getStatus() {
  try {
    // `bw serve` exposes /status; it returns { data: { template: {...} } }
    const res = await client.get("/status");
    const status = res.data?.data?.template?.status ?? "unknown";
    return {
      ok: status === "unlocked",
      configured: true,
      message: `Vault is ${status}`,
      status, // "unlocked" | "locked" | "unauthenticated"
    };
  } catch (err) {
    // If bw serve isn't running yet, we land here. Not an error the
    // user needs to panic about — just report it.
    return {
      ok: false,
      configured: false,
      message: "bw serve not running",
      status: "unreachable",
    };
  }
}

// ── getHealth ───────────────────────────────────────────────────
// Bitwarden has NO built-in "health score", so we compute our own
// from the raw item list. This is the fun part you can expand later.
//
// We measure:
//   - reused passwords (same password on 2+ logins)
//   - weak passwords (shorter than 12 chars — a simple starter rule)
//   - logins missing 2FA/TOTP
//   - total login count
export async function getHealth() {
  // First make sure we CAN read items (vault must be unlocked).
  const status = await getStatus();
  if (!status.ok) {
    return { available: false, reason: status.message };
  }

  // Fetch every item. /list/object/items returns { data: { data: [...] } }
  const res = await client.get("/list/object/items");
  const items = res.data?.data?.data ?? [];

  // We only care about login-type items (type === 1 in Bitwarden).
  const logins = items.filter((i) => i.type === 1 && i.login);

  // ── reused passwords ──
  // Count how many times each password appears, then flag the dupes.
  const passwordCounts = {};
  for (const item of logins) {
    const pw = item.login.password;
    if (pw) passwordCounts[pw] = (passwordCounts[pw] || 0) + 1;
  }
  const reused = logins.filter(
    (i) => i.login.password && passwordCounts[i.login.password] > 1
  ).length;

  // ── weak passwords (simple length rule to start) ──
  const weak = logins.filter(
    (i) => i.login.password && i.login.password.length < 12
  ).length;

  // ── logins without 2FA/TOTP ──
  const noTotp = logins.filter((i) => !i.login.totp).length;

  return {
    available: true,
    totalLogins: logins.length,
    reused,
    weak,
    noTotp,
  };
}
