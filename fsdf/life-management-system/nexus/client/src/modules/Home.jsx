import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { modules } from '../moduleRegistry.js';
import { health, airtable, connectWebSocket } from '../api.js';
import styles from './Home.module.css';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function today() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

const PRIORITY_BADGE = {
  'Critical': 'badge-red',
  'High':     'badge-amber',
  'Medium':   'badge-blue',
  'Low':      'badge-gray',
};

export default function Home() {
  const nav = useNavigate();
  const [serverOk, setServerOk] = useState(null);
  const [projects, setProjects] = useState([]);
  const [inboxCount, setInboxCount] = useState(0);
  const [capture, setCapture] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [captureMsg, setCaptureMsg] = useState('');
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    health().then(() => setServerOk(true)).catch(() => setServerOk(false));
  }, []);

  useEffect(() => {
  airtable.list('projects', { maxRecords: 100 })
    .then(data => {
      const filtered = (data.records || []).filter(r => {
        const status = r.fields.Status || '';
        const priority = r.fields.Priority || '';
        return status === 'Active' &&
          (priority === 'Critical' || priority === 'High');
      });
      filtered.sort((a, b) => {
        const order = { 'Critical': 0, 'High': 1 };
        return (order[a.fields.Priority] ?? 9) - (order[b.fields.Priority] ?? 9);
      });
      setProjects(filtered.slice(0, 5));
    })
    .catch(() => {});
}, []);

  useEffect(() => {
    airtable.list('inbox', {
      filterByFormula: "{Status}='Unprocessed'",
      maxRecords: 100,
    })
      .then(data => setInboxCount((data.records || []).length))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const ws = connectWebSocket((msg) => {
      if (msg.type === 'alert') setAlerts(prev => [msg, ...prev].slice(0, 5));
    });
    return () => ws.close();
  }, []);

  async function handleCapture(e) {
    e.preventDefault();
    if (!capture.trim()) return;
    setCapturing(true);
    try {
      await airtable.create('inbox', {
        Capture: capture.trim(),
        Status: 'Unprocessed',
        Type: 'Thought',
      });
      setCapture('');
      setInboxCount(c => c + 1);
      setCaptureMsg('Captured');
      setTimeout(() => setCaptureMsg(''), 2000);
    } catch {
      setCaptureMsg('Failed — check Airtable config');
      setTimeout(() => setCaptureMsg(''), 3000);
    } finally {
      setCapturing(false);
    }
  }

  const nonHomeModules = modules.filter(m => m.id !== 'home');

  return (
    <div className="page">
      <div className={styles.header}>
        <div>
          <h1 className={styles.greeting}>{greeting()}, Nathan</h1>
          <p className="text-muted text-sm">{today()}</p>
        </div>
        <div className={styles.statusStrip}>
          <span className="flex-center gap-sm text-sm">
            <span className={`dot ${serverOk === null ? 'dot-gray' : serverOk ? 'dot-green' : 'dot-red'}`} />
            <span className="text-muted">Nexus {serverOk ? 'online' : serverOk === false ? 'offline' : '...'}</span>
          </span>
          {inboxCount > 0 && (
            <span className="flex-center gap-sm text-sm" style={{ cursor: 'pointer' }} onClick={() => nav('/life')}>
              <span className="dot dot-amber" />
              <span className="text-muted">{inboxCount} inbox</span>
            </span>
          )}
          {alerts.length > 0 && (
            <span className="flex-center gap-sm text-sm">
              <span className="dot dot-red" />
              <span className="text-muted">{alerts[0].message}</span>
            </span>
          )}
        </div>
      </div>

      <section className={styles.section}>
        <div className="grid-4">
          {nonHomeModules.map(m => (
            <button
              key={m.id}
              className={styles.moduleCard}
              onClick={() => nav(m.route)}
              style={{ '--mod-color': m.color }}
              disabled={!m.live}
              title={!m.live ? `Phase ${m.phase} — not yet built` : ''}
            >
              <span className={styles.moduleIcon}>{m.icon}</span>
              <span className={styles.moduleName}>{m.name}</span>
              <span className={styles.moduleDesc}>{m.description}</span>
              {!m.live && <span className={styles.modulePill}>Phase {m.phase}</span>}
            </button>
          ))}
        </div>
      </section>

      <div className={styles.columns}>
        <section>
          <h2 className={styles.sectionTitle}>Today's focus</h2>
          <div className="card">
            {projects.length === 0 ? (
              <p className="text-muted text-sm">No critical or high priority active projects</p>
            ) : (
              projects.map((rec, i) => {
                const f = rec.fields;
                const pri = f.Priority || 'Low';
                return (
                  <div key={rec.id}>
                    {i > 0 && <hr className="divider" />}
                    <div className="flex-between">
                      <span className="font-medium text-sm">{f.Name || '—'}</span>
                      <span className={`badge ${PRIORITY_BADGE[pri] || 'badge-gray'}`}>{pri}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section>
          <h2 className={styles.sectionTitle}>Quick capture</h2>
          <div className="card">
            <form onSubmit={handleCapture} className={styles.captureForm}>
              <input
                type="text"
                placeholder="Log a thought, task, or idea..."
                value={capture}
                onChange={e => setCapture(e.target.value)}
                disabled={capturing}
              />
              <button type="submit" className={styles.captureBtn} disabled={capturing || !capture.trim()}>
                {capturing ? '...' : 'Add'}
              </button>
            </form>
            {captureMsg && (
              <p className="text-sm" style={{ color: captureMsg === 'Captured' ? 'var(--text2)' : 'var(--red)', marginTop: 8 }}>
                {captureMsg}
              </p>
            )}
            {inboxCount > 0 && (
              <p className="text-sm text-muted" style={{ marginTop: 8 }}>
                {inboxCount} unprocessed item{inboxCount !== 1 ? 's' : ''} in inbox
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
