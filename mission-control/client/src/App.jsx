import { useEffect, useState } from "react";
import { PANELS } from "./layout.js";
import { Icon } from "./Icon.jsx";
import { LightControl, MediaControl, PurifierControl, ActivityControls, ThermostatControl, AirMonitorCard, CameraCard } from "./Controls.jsx";

const POLL_MS = 2000;

// Tiny hash router: #/ = landing, #/climate = the climate panel, etc.
function useHashRoute() {
  const [route, setRoute] = useState(
    () => window.location.hash.replace(/^#\//, "") || ""
  );
  useEffect(() => {
    const onHash = () =>
      setRoute(window.location.hash.replace(/^#\//, "") || "");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
}

function useDevices() {
  const [byId, setById] = useState({});
  const [updatedAt, setUpdatedAt] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/devices");
        const data = await res.json();
        if (!active) return;
        const map = {};
        for (const d of data.devices) map[d.id] = d;
        setById(map);
        setUpdatedAt(data.updatedAt);
        setError(null);
      } catch (err) {
        if (active) setError(err.message);
      }
    }
    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  return { byId, updatedAt, error };
}

export default function App() {
  const route = useHashRoute();
  const { byId, updatedAt, error } = useDevices();

  const panel = PANELS.find((p) => p.id === route);

  return (
    <div className="app">
      <header className="header">
        <a className="brand" href="#/">
          <span className="brand-mark" />
          <span className="brand-name">Home Control</span>
        </a>
        <span className="updated">
          {error
            ? "Connection issue"
            : updatedAt
            ? `Live · ${new Date(updatedAt).toLocaleTimeString()}`
            : "Connecting…"}
        </span>
      </header>

      {panel ? <PanelView panel={panel} byId={byId} /> : <Landing />}
    </div>
  );
}

function Landing() {
  const global = PANELS.filter((p) => p.group === "global");
  const rooms = PANELS.filter((p) => p.group === "room");

  return (
    <main>
      <h2 className="group-label">Overview</h2>
      <div className="tile-grid">
        {global.map((p, i) => (
          <NavTile key={p.id} panel={p} delay={i} />
        ))}
      </div>

      <h2 className="group-label">Rooms</h2>
      <div className="tile-grid">
        {rooms.map((p, i) => (
          <NavTile key={p.id} panel={p} delay={i + global.length} />
        ))}
      </div>
    </main>
  );
}

function NavTile({ panel, delay }) {
  const planned = panel.status === "planned";
  return (
    <a
      className={`tile ${planned ? "tile-planned" : ""}`}
      href={`#/${panel.id}`}
      style={{ animationDelay: `${delay * 40}ms` }}
    >
      <span className="tile-icon">
        <Icon name={panel.icon} />
      </span>
      <span className="tile-title">{panel.title}</span>
      {planned && <span className="tile-badge">soon</span>}
    </a>
  );
}

function PanelView({ panel, byId }) {
  if (panel.status === "planned") {
    return (
      <main>
        <PanelHeader panel={panel} />
        <div className="placeholder">
          <Icon name={panel.icon} />
          <p>
            {panel.kind === "camera"
              ? "Live camera feeds arrive in a later stage."
              : "Controls for this room arrive in a later stage."}
          </p>
        </div>
      </main>
    );
  }

  // Control panels (rooms) render interactive widgets.
  if (panel.kind === "control") {
    return <ControlPanel panel={panel} byId={byId} />;
  }

  // Climate panel: thermostat + air monitors + plain sensors.
  if (panel.kind === "climate") {
    return <ClimatePanel panel={panel} byId={byId} />;
  }

  // Cameras panel: grid of auto-refreshing snapshots.
  if (panel.kind === "cameras") {
    return (
      <main>
        <PanelHeader panel={panel} />
        <div className="cam-grid">
          {(panel.cameras ?? []).map((c) => (
            <CameraCard key={c.id} camera={c} />
          ))}
        </div>
        {(panel.cameras ?? []).length === 0 && (
          <p className="empty">No cameras configured yet.</p>
        )}
      </main>
    );
  }

  // Sensor panels render read-only value cards.
  const cards = panel.entities.map((id) => byId[id]).filter(Boolean);
  const missing = panel.entities.filter((id) => !byId[id]);

  return (
    <main>
      <PanelHeader panel={panel} />
      <div className="grid">
        {cards.map((d) => (
          <SensorCard key={d.id} device={d} />
        ))}
      </div>
      {cards.length === 0 && (
        <p className="empty">Waiting for data from Home Assistant…</p>
      )}
      {missing.length > 0 && (
        <p className="note">Not reporting yet: {missing.join(", ")}</p>
      )}
    </main>
  );
}

function ControlPanel({ panel, byId }) {
  const [showBulbs, setShowBulbs] = useState(false);
  const groups = (panel.lights?.groups ?? [])
    .map((id) => byId[id])
    .filter(Boolean);
  const bulbs = (panel.lights?.bulbs ?? [])
    .map((id) => byId[id])
    .filter(Boolean);
  const media = (panel.media ?? []).map((id) => byId[id]).filter(Boolean);
  const purifierPower = panel.purifier ? byId[panel.purifier.power] : null;
  const purifierMode = panel.purifier ? byId[panel.purifier.mode] : null;

  return (
    <main>
      <PanelHeader panel={panel} />

      {panel.activities && <ActivityControls activities={panel.activities} />}

      {groups.length > 0 && (
        <>
          <h3 className="sub">Lights</h3>
          <div className="ctl-grid">
            {groups.map((d) => (
              <LightControl key={d.id} device={d} />
            ))}
          </div>
          {bulbs.length > 0 && (
            <>
              <button
                className="disclosure"
                onClick={() => setShowBulbs((v) => !v)}
              >
                {showBulbs ? "Hide" : "Show"} individual bulbs ({bulbs.length})
              </button>
              {showBulbs && (
                <div className="ctl-grid">
                  {bulbs.map((d) => (
                    <LightControl key={d.id} device={d} />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {media.length > 0 && (
        <>
          <h3 className="sub">Media</h3>
          <div className="ctl-grid">
            {media.map((d) => (
              <MediaControl key={d.id} device={d} />
            ))}
          </div>
        </>
      )}

      {purifierPower && (
        <>
          <h3 className="sub">Air</h3>
          <div className="ctl-grid">
            <PurifierControl
              powerDevice={purifierPower}
              modeDevice={purifierMode}
            />
          </div>
        </>
      )}
    </main>
  );
}

function ClimatePanel({ panel, byId }) {
  const thermo = panel.thermostat ? byId[panel.thermostat] : null;
  const sensors = (panel.sensors ?? []).map((id) => byId[id]).filter(Boolean);

  return (
    <main>
      <PanelHeader panel={panel} />

      {thermo && (
        <>
          <h3 className="sub">Thermostat</h3>
          <ThermostatControl device={thermo} />
        </>
      )}

      {sensors.length > 0 && (
        <>
          <h3 className="sub">Hallway</h3>
          <div className="grid">
            {sensors.map((d) => (
              <SensorCard key={d.id} device={d} />
            ))}
          </div>
        </>
      )}

      {panel.airMonitors?.length > 0 && (
        <>
          <h3 className="sub">Air Monitors</h3>
          <div className="grid">
            {panel.airMonitors.map((m) => (
              <AirMonitorCard key={m.room} monitor={m} byId={byId} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function PanelHeader({ panel }) {
  return (
    <div className="panel-head">
      <a className="back" href="#/">← All</a>
      <h1 className="panel-title">
        <Icon name={panel.icon} /> {panel.title}
      </h1>
    </div>
  );
}

function SensorCard({ device }) {
  const isBinary = device.id.startsWith("binary_sensor.");
  const on = ["on", "connected", "home", "true"].includes(
    String(device.value).toLowerCase()
  );
  return (
    <article className={`card ${device.ok ? "" : "card-bad"}`}>
      <div className="card-name">{device.name}</div>
      {device.ok ? (
        isBinary ? (
          <div className={`card-state ${on ? "state-on" : "state-off"}`}>
            <span className="dot" /> {device.value}
          </div>
        ) : (
          <div className="card-value">
            {device.value}
            {device.unit && <span className="card-unit"> {device.unit}</span>}
          </div>
        )
      ) : (
        <div className="card-error">{device.error}</div>
      )}
    </article>
  );
}
