import { useState, useEffect } from "react";
import { Icon } from "./Icon.jsx";

// POST a service call to the backend. Returns true on success.
async function callService(domain, service, data) {
  try {
    const res = await fetch("/api/service", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, service, data }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---- Light control: toggle, brightness, color ----
export function LightControl({ device }) {
  // Optimistic override: null = follow real state; true/false = show this
  // until the next poll confirms. Makes the toggle feel instant.
  const [optimisticOn, setOptimisticOn] = useState(null);
  const realOn = device.value === "on";
  const isOn = optimisticOn ?? realOn;

  // When real state catches up to our optimistic guess, stop overriding.
  useEffect(() => {
    if (optimisticOn !== null && optimisticOn === realOn) {
      setOptimisticOn(null);
    }
  }, [optimisticOn, realOn]);

  const brightnessPct = device.attrs?.brightness
    ? Math.round((device.attrs.brightness / 255) * 100)
    : isOn
    ? 100
    : 0;
  const supportsColor = (device.attrs?.supported_color_modes ?? []).includes(
    "rgb"
  );
  const rgb = device.attrs?.rgb_color;
  const swatch = rgb ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : "#ffffff";

  const [localBright, setLocalBright] = useState(brightnessPct);

  async function toggle() {
    const next = !isOn;
    setOptimisticOn(next); // flip UI immediately
    const ok = await callService("light", next ? "turn_on" : "turn_off", {
      entity_id: device.id,
    });
    if (!ok) setOptimisticOn(null); // revert on failure
  }

  async function setBrightness(pct) {
    setLocalBright(pct);
    await callService("light", "turn_on", {
      entity_id: device.id,
      brightness_pct: pct,
    });
  }

  async function setColor(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    await callService("light", "turn_on", {
      entity_id: device.id,
      rgb_color: [r, g, b],
    });
  }

  return (
    <article className={`ctl ${isOn ? "ctl-on" : ""}`}>
      <div className="ctl-head">
        <span className="ctl-name">{device.name}</span>
        <button
          className={`switch ${isOn ? "switch-on" : ""}`}
          onClick={toggle}
          aria-label={`Toggle ${device.name}`}
        >
          <span className="knob" />
        </button>
      </div>
      {isOn && (
        <div className="ctl-body">
          <input
            type="range"
            min="1"
            max="100"
            value={localBright}
            onChange={(e) => setLocalBright(Number(e.target.value))}
            onMouseUp={(e) => setBrightness(Number(e.target.value))}
            onTouchEnd={(e) => setBrightness(Number(e.target.value))}
            className="slider"
          />
          <div className="ctl-row">
            <span className="ctl-meta">{localBright}%</span>
            {supportsColor && (
              <label className="color-pick" style={{ background: swatch }}>
                <input
                  type="color"
                  defaultValue="#ffffff"
                  onChange={(e) => setColor(e.target.value)}
                />
              </label>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

// ---- Media control: power, play/pause, volume ----
export function MediaControl({ device }) {
  const state = device.value; // playing, paused, idle, off, on
  const isOff = state === "off" || state === "unavailable";
  const isPlaying = state === "playing";
  const vol = device.attrs?.volume_level;
  const [localVol, setLocalVol] = useState(vol != null ? Math.round(vol * 100) : 50);

  async function power() {
    await callService("media_player", isOff ? "turn_on" : "turn_off", {
      entity_id: device.id,
    });
  }
  async function playPause() {
    await callService("media_player", "media_play_pause", {
      entity_id: device.id,
    });
  }
  async function setVolume(pct) {
    setLocalVol(pct);
    await callService("media_player", "volume_set", {
      entity_id: device.id,
      volume_level: pct / 100,
    });
  }

  return (
    <article className={`ctl ${!isOff ? "ctl-on" : ""}`}>
      <div className="ctl-head">
        <span className="ctl-name">{device.name}</span>
        <span className="ctl-state">{state}</span>
      </div>
      <div className="ctl-body">
        <div className="media-buttons">
          <button className="mbtn" onClick={power}>
            {isOff ? "Turn on" : "Turn off"}
          </button>
          {!isOff && (
            <button className="mbtn mbtn-accent" onClick={playPause}>
              {isPlaying ? "Pause" : "Play"}
            </button>
          )}
        </div>
        {!isOff && vol != null && (
          <>
            <input
              type="range"
              min="0"
              max="100"
              value={localVol}
              onChange={(e) => setLocalVol(Number(e.target.value))}
              onMouseUp={(e) => setVolume(Number(e.target.value))}
              onTouchEnd={(e) => setVolume(Number(e.target.value))}
              className="slider"
            />
            <span className="ctl-meta">Volume {localVol}%</span>
          </>
        )}
      </div>
    </article>
  );
}

// ---- Purifier control: power switch + mode select ----
export function PurifierControl({ powerDevice, modeDevice }) {
  const [optimisticOn, setOptimisticOn] = useState(null);
  const realOn = powerDevice?.value === "on";
  const isOn = optimisticOn ?? realOn;
  useEffect(() => {
    if (optimisticOn !== null && optimisticOn === realOn) {
      setOptimisticOn(null);
    }
  }, [optimisticOn, realOn]);

  const options = modeDevice?.attrs?.options ?? [];
  const current = modeDevice?.value;

  async function togglePower() {
    const next = !isOn;
    setOptimisticOn(next);
    const ok = await callService("switch", next ? "turn_on" : "turn_off", {
      entity_id: powerDevice.id,
    });
    if (!ok) setOptimisticOn(null);
  }
  async function setMode(option) {
    await callService("select", "select_option", {
      entity_id: modeDevice.id,
      option,
    });
  }

  return (
    <article className={`ctl ${isOn ? "ctl-on" : ""}`}>
      <div className="ctl-head">
        <span className="ctl-name">Air Purifier</span>
        <button
          className={`switch ${isOn ? "switch-on" : ""}`}
          onClick={togglePower}
          aria-label="Toggle air purifier"
        >
          <span className="knob" />
        </button>
      </div>
      {isOn && options.length > 0 && (
        <div className="ctl-body">
          <div className="mode-chips">
            {options.map((opt) => (
              <button
                key={opt}
                className={`chip ${current === opt ? "chip-on" : ""}`}
                onClick={() => setMode(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

// ---- Activity controls: streaming, scripts, power, inputs ----
// All buttons are momentary (fire-and-forget), with brief visual feedback.
export function ActivityControls({ activities }) {
  const {
    remoteEntity,
    streamingScript,
    streaming = [],
    quickPlay = [],
    nav = null,
    volume = [],
    power = [],
    allOff = null,
  } = activities;

  const [flash, setFlash] = useState(null);
  function ping(label) {
    setFlash(label);
    setTimeout(() => setFlash((f) => (f === label ? null : f)), 600);
  }

  async function runStreaming(item) {
    ping(item.label);
    await callService("script", "turn_on", {
      entity_id: streamingScript,
      activity: item.activity,
    });
  }
  // Generic remote command. `item` may carry its own remote + optional device.
  async function sendRemote(item, remoteOverride) {
    ping(item.label);
    const data = { entity_id: remoteOverride || remoteEntity, command: item.command };
    if (item.device) data.device = item.device; // only when specified
    await callService("remote", "send_command", data);
  }
  async function runScriptEntity(item) {
    ping(item.label);
    await callService("script", "turn_on", { entity_id: item.script });
  }

  const Btn = ({ label, onClick, accent, cls }) => (
    <button
      className={`abtn ${accent ? "abtn-accent" : ""} ${cls || ""} ${
        flash === label ? "abtn-flash" : ""
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );

  // D-pad cell helper
  const NavBtn = ({ cell }) =>
    cell ? (
      <Btn
        label={cell.label}
        cls="dpad-btn"
        onClick={() => sendRemote(cell, nav.remote)}
      />
    ) : (
      <span className="dpad-spacer" />
    );

  return (
    <>
      {streaming.length > 0 && (
        <>
          <h3 className="sub">Watch</h3>
          <div className="abtn-grid">
            {streaming.map((s) => (
              <Btn key={s.label} label={s.label} accent onClick={() => runStreaming(s)} />
            ))}
          </div>
        </>
      )}

      {quickPlay.length > 0 && (
        <>
          <h3 className="sub">Quick Play</h3>
          <div className="abtn-grid abtn-grid-3">
            {quickPlay.map((q) => (
              <Btn key={q.label} label={q.label} onClick={() => sendRemote(q)} />
            ))}
          </div>
        </>
      )}

      {nav && (
        <>
          <h3 className="sub">TV Navigation</h3>
          <div className="dpad">
            <NavBtn cell={nav.home} />
            <NavBtn cell={nav.up} />
            <NavBtn cell={null} />
            <NavBtn cell={nav.left} />
            <NavBtn cell={nav.ok} />
            <NavBtn cell={nav.right} />
            <NavBtn cell={nav.back} />
            <NavBtn cell={nav.down} />
            <NavBtn cell={nav.menu} />
          </div>
          {nav.mute && (
            <div className="abtn-grid" style={{ marginTop: "0.6rem" }}>
              <Btn label={nav.mute.label} onClick={() => sendRemote(nav.mute, nav.remote)} />
            </div>
          )}
        </>
      )}

      {volume.length > 0 && (
        <>
          <h3 className="sub">Volume</h3>
          <div className="abtn-grid abtn-grid-3">
            {volume.map((v) => (
              <Btn key={v.label} label={v.label} onClick={() => sendRemote(v)} />
            ))}
          </div>
        </>
      )}

      {power.length > 0 && (
        <>
          <h3 className="sub">Power</h3>
          <div className="abtn-grid">
            {power.map((p) => (
              <Btn key={p.label} label={p.label} onClick={() => sendRemote(p)} />
            ))}
          </div>
        </>
      )}

      {allOff && (
        <div className="abtn-grid" style={{ marginTop: "0.8rem" }}>
          <Btn label={allOff.label} cls="abtn-danger" onClick={() => runScriptEntity(allOff)} />
        </div>
      )}
    </>
  );
}

// ---- Thermostat control (demonstrates status-based theming) ----
// The card's color follows hvac_action: heating=amber, cooling=blue, idle=neutral.
export function ThermostatControl({ device }) {
  const a = device.attrs || {};
  const action = a.hvac_action || device.value; // heating | cooling | idle | off
  const mode = device.value; // heat | cool | heat_cool | off | auto
  const current = a.current_temperature;
  const target = a.temperature;
  const modes = a.hvac_modes || ["off", "heat", "cool", "heat_cool"];

  // optimistic target so the number responds instantly to +/-
  const [optTarget, setOptTarget] = useState(null);
  const shownTarget = optTarget ?? target;
  useEffect(() => {
    if (optTarget !== null && optTarget === target) setOptTarget(null);
  }, [optTarget, target]);

  // status class drives the color — THIS is the status-based theming pattern
  const statusClass =
    action === "heating" ? "thermo-heating"
    : action === "cooling" ? "thermo-cooling"
    : mode === "off" ? "thermo-off"
    : "thermo-idle";

  async function nudge(delta) {
    if (shownTarget == null) return;
    const next = Math.round((shownTarget + delta) * 2) / 2; // 0.5 steps
    setOptTarget(next);
    await callService("climate", "set_temperature", {
      entity_id: device.id,
      temperature: next,
    });
  }
  async function setMode(m) {
    await callService("climate", "set_hvac_mode", { entity_id: device.id, hvac_mode: m });
  }

  return (
    <article className={`thermo ${statusClass}`}>
      <div className="thermo-readout">
        <div className="thermo-current">
          {current != null ? Math.round(current) : "--"}°
          <span className="thermo-current-label">current</span>
        </div>
        <div className="thermo-target-block">
          <button className="thermo-step" onClick={() => nudge(-1)} aria-label="Lower">−</button>
          <div className="thermo-target">
            {shownTarget != null ? shownTarget : "--"}°
            <span className="thermo-target-label">{action || mode}</span>
          </div>
          <button className="thermo-step" onClick={() => nudge(1)} aria-label="Raise">+</button>
        </div>
      </div>
      <div className="thermo-modes">
        {modes.map((m) => (
          <button
            key={m}
            className={`chip ${mode === m ? "chip-on" : ""}`}
            onClick={() => setMode(m)}
          >
            {m.replace("_", "/")}
          </button>
        ))}
      </div>
    </article>
  );
}

// ---- Air monitor card: temp + humidity + air quality together ----
export function AirMonitorCard({ monitor, byId }) {
  const temp = byId[monitor.temp];
  const humidity = byId[monitor.humidity];
  const aqi = byId[monitor.aqi];

  // air quality often comes as a small number or {"value":N}; normalize
  function aqiText(d) {
    if (!d || !d.ok) return null;
    let v = d.value;
    try { const p = JSON.parse(v); if (p && p.value != null) v = p.value; } catch {}
    const n = Number(v);
    if (Number.isNaN(n)) return String(v);
    // status-based label + class for color
    const label = n <= 1 ? "Good" : n <= 2 ? "Moderate" : n <= 3 ? "Poor" : "Bad";
    return { n, label, cls: n <= 1 ? "aqi-good" : n <= 2 ? "aqi-mod" : "aqi-bad" };
  }
  const aq = aqiText(aqi);

  return (
    <article className="air-card">
      <div className="air-room">{monitor.room}</div>
      <div className="air-metrics">
        {temp?.ok && (
          <div className="air-metric">
            <span className="air-val">{Math.round(Number(temp.value))}°</span>
            <span className="air-lbl">temp</span>
          </div>
        )}
        {humidity?.ok && (
          <div className="air-metric">
            <span className="air-val">{Math.round(Number(humidity.value))}%</span>
            <span className="air-lbl">humidity</span>
          </div>
        )}
        {aq && typeof aq === "object" && (
          <div className="air-metric">
            <span className={`air-pill ${aq.cls}`}>{aq.label}</span>
            <span className="air-lbl">air</span>
          </div>
        )}
      </div>
    </article>
  );
}

// ---- Camera snapshot card: auto-refreshing still image ----
// Pulls /api/camera/<entity> on an interval with a cache-busting query param.
// The server proxies the image from HA, so no token is exposed here.
export function CameraCard({ camera, refreshMs = 3000 }) {
  const [tick, setTick] = useState(Date.now());
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), refreshMs);
    return () => clearInterval(t);
  }, [refreshMs]);

  const src = `/api/camera/${camera.id}?t=${tick}`;

  return (
    <article className="cam-card">
      <div className="cam-frame">
        {errored ? (
          <div className="cam-error">
            <Icon name="camera" />
            <span>Unavailable</span>
          </div>
        ) : (
          <img
            className="cam-img"
            src={src}
            alt={camera.name}
            onError={() => setErrored(true)}
            onLoad={() => errored && setErrored(false)}
          />
        )}
      </div>
      <div className="cam-name">{camera.name}</div>
    </article>
  );
}
