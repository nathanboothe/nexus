import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { airtable, ha } from '../api.js';
import styles from './Skylight.module.css';

const TEMP_ENTITIES = {
  'Hallway':      'sensor.hallway_temperature',
  'Rec Room':     'sensor.rec_room_air_monitor_temperature',
  'Loft':         'sensor.loft_air_monitor_temperature',
  "Sam's Room":   'sensor.sam_s_air_monitor_temperature',
  "Lucas's Room": 'sensor.lucqs_room_air_monitor_temperature',
};

const PRIORITY_COLOR = {
  'Critical': '#e74c3c',
  'High':     '#f39c12',
  'Medium':   '#4a7ec7',
  'Low':      '#5c6278',
};

// App launch buttons using intent:// URLs for Nova Launcher / Chrome on Android
const APPS = [
  {
    name: 'SPCK Editor',
    icon: '💻',
    intent: 'intent://open#Intent;package=io.spck;scheme=spck;end',
  },
  {
    name: 'Home Assistant',
    icon: '🏠',
    intent: 'intent://open#Intent;package=io.homeassistant.companion.android;scheme=homeassistant;end',
  },
  {
    name: 'OneDrive',
    icon: '☁️',
    intent: 'intent://open#Intent;package=com.microsoft.skydrive;scheme=ms-onedrive;end',
  },
  {
    name: 'Solid Explorer',
    icon: '📁',
    intent: 'intent://open#Intent;package=pl.solidexplorer2;scheme=solidexplorer;end',
  },
  {
    name: 'VLC',
    icon: '🎬',
    intent: 'intent://open#Intent;package=org.videolan.vlc;scheme=vlc;end',
  },
  {
    name: 'Split Screen',
    icon: '⬛⬛',
    intent: 'intent://open#Intent;package=com.hexiangtech.splitscreen;scheme=splitscreen;end',
  },
  {
    name: 'GitHub',
    icon: '🐙',
    intent: 'intent://open#Intent;package=com.github.android;scheme=github;end',
  },
];

function timeStr() {
  return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function dateStr() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function greet() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Skylight() {
  const nav = useNavigate();
  const [time, setTime] = useState(timeStr());
  const [date, setDate] = useState(dateStr());
  const [projects, setProjects] = useState([]);
  const [inboxCount, setInboxCount] = useState(0);
  const [temps, setTemps] = useState({});
  const [lastUpdated, setLastUpdated] = useState('');

  const loadData = useCallback(async () => {
    // STEM projects only
    try {
      const data = await airtable.list('projects', { maxRecords: 200 });
      const stem = (data.records || [])
        .filter(r => {
          const status = r.fields.Status || '';
          const tag = (r.fields['Module tag'] || '').toLowerCase();
          return status === 'Active' && tag === 'stem';
        })
        .sort((a, b) => {
          const order = { Critical: 0, High: 1, Medium: 2, Low: 3 };
          return (order[a.fields.Priority] ?? 9) - (order[b.fields.Priority] ?? 9);
        });
      setProjects(stem);
    } catch {}

    // Inbox count
    try {
      const data = await airtable.list('inbox', { maxRecords: 100 });
      const count = (data.records || []).filter(r => r.fields.Status === 'Unprocessed').length;
      setInboxCount(count);
    } catch {}

    // Temps
    try {
      const states = await ha.states();
      const stateMap = {};
      states.forEach(s => { stateMap[s.entity_id] = s; });
      const newTemps = {};
      Object.entries(TEMP_ENTITIES).forEach(([room, entity]) => {
        const s = stateMap[entity];
        if (s && !isNaN(s.state)) newTemps[room] = parseFloat(s.state).toFixed(1);
      });
      setTemps(newTemps);
    } catch {}

    setLastUpdated(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
  }, []);

  useEffect(() => {
    const tick = setInterval(() => {
      setTime(timeStr());
      setDate(dateStr());
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    loadData();
    const refresh = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(refresh);
  }, [loadData]);

  function launchApp(intent) {
    window.location.href = intent;
  }

  return (
    <div className={styles.display}>

      {/* ── LEFT: Clock + Temps ── */}
      <div className={styles.leftCol}>
        <div className={styles.clockBlock}>
          <div className={styles.time}>{time}</div>
          <div className={styles.date}>{date}</div>
          <div className={styles.greeting}>{greet()}, Nathan</div>
        </div>

        <div className={styles.tempsBlock}>
          <p className={styles.blockLabel}>Temperatures</p>
          {Object.entries(temps).map(([room, temp]) => (
            <div key={room} className={styles.tempRow}>
              <span className={styles.tempRoom}>{room}</span>
              <span className={styles.tempVal}>{temp}°F</span>
            </div>
          ))}
          {Object.keys(temps).length === 0 && (
            <p className={styles.empty}>HA not connected</p>
          )}
        </div>

        {inboxCount > 0 && (
          <div className={styles.inboxAlert} onClick={() => nav('/life')}>
            <span className={styles.inboxDot} />
            <span className={styles.inboxText}>{inboxCount} inbox item{inboxCount !== 1 ? 's' : ''}</span>
          </div>
        )}

        <button className={styles.nexusBtn} onClick={() => nav('/')}>
          ⌂ Nexus
        </button>

        <p className={styles.updated}>Updated {lastUpdated}</p>
      </div>

      {/* ── CENTER: STEM Projects ── */}
      <div className={styles.centerCol}>
        <p className={styles.blockLabel}>STEM Projects — Active</p>
        {projects.length === 0 ? (
          <p className={styles.empty}>No active STEM projects</p>
        ) : (
          <div className={styles.projectList}>
            {projects.map(rec => {
              const f = rec.fields;
              return (
                <div key={rec.id} className={styles.projectCard} onClick={() => nav('/life')}>
                  <div className={styles.projectName}>{f.Name}</div>
                  <div className={styles.projectMeta}>
                    {f.Priority && (
                      <span className={styles.priorityBadge}
                        style={{
                          background: `${PRIORITY_COLOR[f.Priority]}22`,
                          color: PRIORITY_COLOR[f.Priority],
                          border: `1px solid ${PRIORITY_COLOR[f.Priority]}44`
                        }}>
                        {f.Priority}
                      </span>
                    )}
                    {f.Area && <span className={styles.areaBadge}>{f.Area}</span>}
                    {f['Due date'] && (
                      <span className={styles.dueBadge}>
                        Due {new Date(f['Due date']).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                  {f.Notes && (
                    <p className={styles.projectNotes}>{f.Notes.slice(0, 80)}{f.Notes.length > 80 ? '...' : ''}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── RIGHT: App Buttons ── */}
      <div className={styles.rightCol}>
        <p className={styles.blockLabel}>Launch app</p>
        <div className={styles.appGrid}>
          {APPS.map(app => (
            <button
              key={app.name}
              className={styles.appBtn}
              onClick={() => launchApp(app.intent)}
            >
              <span className={styles.appIcon}>{app.icon}</span>
              <span className={styles.appName}>{app.name}</span>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
