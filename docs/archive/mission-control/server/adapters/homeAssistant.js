// adapters/homeAssistant.js
// Polls the Home Assistant REST API and normalizes entities into the
// shared device shape the frontend consumes.

export function createHomeAssistantAdapter(haConfig) {
  if (!haConfig?.enabled) {
    return { poll: async () => [] };
  }

  const headers = {
    Authorization: `Bearer ${haConfig.token}`,
    "Content-Type": "application/json",
  };

  async function poll() {
    try {
      const res = await fetch(`${haConfig.baseUrl}/api/states`, { headers });
      if (!res.ok) {
        // 401 here almost always means a bad/expired long-lived token.
        return [
          {
            id: "homeassistant",
            name: "Home Assistant",
            source: "ha",
            ok: false,
            error: `HA returned HTTP ${res.status}`,
          },
        ];
      }
      const states = await res.json();
      const wanted = haConfig.entities ?? [];
      const filtered =
        wanted.length > 0
          ? states.filter((s) => wanted.includes(s.entity_id))
          : states;

      return filtered.map((s) => ({
        id: s.entity_id,
        name: s.attributes?.friendly_name ?? s.entity_id,
        source: "ha",
        ok: true,
        value: s.state,
        unit: s.attributes?.unit_of_measurement ?? "",
        updatedAt: s.last_updated,
        // Attributes used by control components on the frontend.
        attrs: {
          brightness: s.attributes?.brightness ?? null, // 0-255
          rgb_color: s.attributes?.rgb_color ?? null,
          supported_color_modes: s.attributes?.supported_color_modes ?? [],
          volume_level: s.attributes?.volume_level ?? null,
          options: s.attributes?.options ?? null,
          // Climate / thermostat
          current_temperature: s.attributes?.current_temperature ?? null,
          temperature: s.attributes?.temperature ?? null, // target
          target_temp_low: s.attributes?.target_temp_low ?? null,
          target_temp_high: s.attributes?.target_temp_high ?? null,
          hvac_modes: s.attributes?.hvac_modes ?? null,
          hvac_action: s.attributes?.hvac_action ?? null,
          current_humidity: s.attributes?.current_humidity ?? null,
          min_temp: s.attributes?.min_temp ?? null,
          max_temp: s.attributes?.max_temp ?? null,
        },
      }));
    } catch (err) {
      return [
        {
          id: "homeassistant",
          name: "Home Assistant",
          source: "ha",
          ok: false,
          error: err.message,
        },
      ];
    }
  }

  // Calls an HA service, e.g. domain="light", service="turn_on",
  // data={ entity_id, brightness_pct, ... }. Returns { ok, error? }.
  async function callService(domain, service, data) {
    if (!haConfig?.enabled) {
      return { ok: false, error: "Home Assistant is disabled in config." };
    }
    try {
      const res = await fetch(
        `${haConfig.baseUrl}/api/services/${domain}/${service}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(data ?? {}),
        }
      );
      if (!res.ok) {
        return { ok: false, error: `HA returned HTTP ${res.status}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  // Fetches a camera snapshot JPEG using the long-lived token (server-side,
  // so the token never reaches the browser and survives per-camera token
  // rotation). Returns { ok, buffer?, contentType?, error? }.
  async function getCameraSnapshot(entityId) {
    if (!haConfig?.enabled) {
      return { ok: false, error: "Home Assistant is disabled in config." };
    }
    // basic entity_id sanity check — only allow camera.* with safe chars
    if (!/^camera\.[a-z0-9_]+$/.test(entityId)) {
      return { ok: false, error: "Invalid camera entity id." };
    }
    try {
      const res = await fetch(
        `${haConfig.baseUrl}/api/camera_proxy/${entityId}`,
        { headers: { Authorization: `Bearer ${haConfig.token}` } }
      );
      if (!res.ok) {
        return { ok: false, error: `HA returned HTTP ${res.status}` };
      }
      const arrayBuf = await res.arrayBuffer();
      return {
        ok: true,
        buffer: Buffer.from(arrayBuf),
        contentType: res.headers.get("content-type") || "image/jpeg",
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  return { poll, callService, getCameraSnapshot };
}
