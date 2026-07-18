import { useState, useEffect } from 'react';
import { ha } from '../api.js';

export default function SmartHome() {
  const [states, setStates] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ha.states()
      .then(data => { setStates(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  return (
    <div className="page">
      <div className="flex-between" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>Smart home</h1>
          <p className="text-muted text-sm">Devices · scenes · locks</p>
        </div>
      </div>

      {loading && <p className="text-muted">Connecting to Home Assistant...</p>}
      {error && (
        <div className="card" style={{ borderColor: 'var(--red)', marginBottom: 16 }}>
          <p style={{ color: 'var(--red)', fontSize: 14 }}>HA connection error: {error}</p>
          <p className="text-muted text-sm" style={{ marginTop: 4 }}>
            Check that HA IP and token are set in server/config.js
          </p>
        </div>
      )}

      {states.length > 0 && (
        <div className="grid-3">
          {states.map(s => (
            <div key={s.entity_id} className="card">
              <p className="text-sm text-muted" style={{ marginBottom: 2 }}>{s.entity_id}</p>
              <p className="font-medium">{s.state}
                {s.attributes?.unit_of_measurement && (
                  <span className="text-muted"> {s.attributes.unit_of_measurement}</span>
                )}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginTop: 24 }}>
        <p className="text-muted text-sm">
          Full Smart Home controls — device panels, scenes, and locks — will be built here in Phase 1.
          Entity states from Home Assistant are shown above once HA is connected.
        </p>
      </div>
    </div>
  );
}
