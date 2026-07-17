// adapters/mqttDevices.js
// Connects to an MQTT broker, subscribes to configured topics, and keeps
// the latest payload per topic in memory. poll() just reads that cache —
// MQTT is push, but the dashboard reads it on the same polling cadence.

import mqtt from "mqtt";

export function createMqttAdapter(mqttConfig) {
  const latest = new Map(); // topic -> { value, updatedAt }

  if (!mqttConfig?.enabled) {
    return { poll: async () => [] };
  }

  const subsByTopic = new Map(
    (mqttConfig.subscriptions ?? []).map((s) => [s.topic, s])
  );

  const client = mqtt.connect(mqttConfig.brokerUrl, {
    username: mqttConfig.username || undefined,
    password: mqttConfig.password || undefined,
    reconnectPeriod: 5000,
  });

  client.on("connect", () => {
    for (const topic of subsByTopic.keys()) client.subscribe(topic);
  });

  client.on("message", (topic, payload) => {
    latest.set(topic, {
      value: payload.toString(),
      updatedAt: new Date().toISOString(),
    });
  });

  let connError = null;
  client.on("error", (err) => {
    connError = err.message;
  });

  async function poll() {
    return (mqttConfig.subscriptions ?? []).map((s) => {
      const cached = latest.get(s.topic);
      if (!cached) {
        return {
          id: s.id,
          name: s.name,
          source: "mqtt",
          ok: false,
          error: connError ?? "no message received yet",
        };
      }
      return {
        id: s.id,
        name: s.name,
        source: "mqtt",
        ok: true,
        value: cached.value,
        unit: s.unit ?? "",
        updatedAt: cached.updatedAt,
      };
    });
  }

  return { poll };
}
