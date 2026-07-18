// adapters/httpDevices.js
// Polls each configured direct HTTP/REST device and normalizes the
// result via that device's own parse() function.

export function createHttpDevicesAdapter(devices = []) {
  async function pollOne(device) {
    try {
      const res = await fetch(device.url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) {
        return {
          id: device.id,
          name: device.name,
          source: "http",
          ok: false,
          error: `HTTP ${res.status}`,
        };
      }
      const json = await res.json();
      const { value, unit } = device.parse(json);
      return {
        id: device.id,
        name: device.name,
        source: "http",
        ok: true,
        value,
        unit: unit ?? "",
        updatedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        id: device.id,
        name: device.name,
        source: "http",
        ok: false,
        error: err.name === "TimeoutError" ? "timed out" : err.message,
      };
    }
  }

  async function poll() {
    return Promise.all(devices.map(pollOne));
  }

  return { poll };
}
