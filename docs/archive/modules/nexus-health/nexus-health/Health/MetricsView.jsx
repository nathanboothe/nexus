import { useState, useEffect } from 'react';
import { airtable } from '../../api.js';
import styles from './HealthViews.module.css';

const METRICS = [
  { key: 'Weight', label: 'Weight', unit: 'lbs', color: '#2E5FA3', decimals: 1 },
  { key: 'Heart rate', label: 'Heart rate', unit: 'bpm', color: '#c0392b', decimals: 0 },
  { key: 'Sleep hours', label: 'Sleep', unit: 'hrs', color: '#7F77DD', decimals: 1 },
  { key: 'Steps', label: 'Steps', unit: '', color: '#1D9E75', decimals: 0 },
  { key: 'Blood pressure systolic', label: 'Systolic', unit: 'mmHg', color: '#BA7517', decimals: 0 },
  { key: 'Blood pressure diastolic', label: 'Diastolic', unit: 'mmHg', color: '#993556', decimals: 0 },
];

export default function MetricsView() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newEntry, setNewEntry] = useState({
    Date: new Date().toISOString().split('T')[0],
    Weight: '', 'Heart rate': '', 'Sleep hours': '', Steps: '',
    'Blood pressure systolic': '', 'Blood pressure diastolic': '', Notes: '',
  });

  function load() {
    setLoading(true);
    airtable.list('healthMetrics', {
      maxRecords: 90,
      'sort[0][field]': 'Date',
      'sort[0][direction]': 'desc',
    })
      .then(data => { setRecords(data.records || []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setAdding(true);
    try {
      const fields = { Date: newEntry.Date };
      METRICS.forEach(m => {
        if (newEntry[m.key]) fields[m.key] = parseFloat(newEntry[m.key]);
      });
      if (newEntry.Notes) fields.Notes = newEntry.Notes;
      await airtable.create('healthMetrics', fields);
      setNewEntry({ Date: new Date().toISOString().split('T')[0], Weight: '', 'Heart rate': '', 'Sleep hours': '', Steps: '', 'Blood pressure systolic': '', 'Blood pressure diastolic': '', Notes: '' });
      setShowAdd(false);
      load();
    } catch {}
    setAdding(false);
  }

  // Latest values
  const latest = records[0]?.fields || {};

  // Sparkline data (last 14 days)
  function sparkData(key) {
    return records.slice(0, 14).reverse()
      .map(r => r.fields[key])
      .filter(v => v !== undefined && v !== null);
  }

  if (loading) return <p className="text-muted">Loading metrics...</p>;

  return (
    <div>
      <div className={styles.toolbar}>
        <button className={styles.addBtn} onClick={() => setShowAdd(s => !s)}>+ Log today</button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className={styles.addForm}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Date</label>
              <input type="date" value={newEntry.Date}
                onChange={e => setNewEntry(n => ({ ...n, Date: e.target.value }))} />
            </div>
            {METRICS.map(m => (
              <div key={m.key} className={styles.formGroup}>
                <label className={styles.formLabel}>{m.label} {m.unit && `(${m.unit})`}</label>
                <input type="number" step="any" placeholder="—"
                  value={newEntry[m.key]}
                  onChange={e => setNewEntry(n => ({ ...n, [m.key]: e.target.value }))} />
              </div>
            ))}
            <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
              <label className={styles.formLabel}>Notes</label>
              <input type="text" placeholder="Optional notes"
                value={newEntry.Notes}
                onChange={e => setNewEntry(n => ({ ...n, Notes: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="submit" className={styles.addBtn} disabled={adding}>{adding ? '...' : 'Save'}</button>
            <button type="button" onClick={() => setShowAdd(false)} className={styles.cancelBtn}>Cancel</button>
          </div>
        </form>
      )}

      {/* Latest snapshot */}
      <div className={styles.metricsGrid}>
        {METRICS.map(m => {
          const val = latest[m.key];
          const spark = sparkData(m.key);
          const prev = records[1]?.fields[m.key];
          const trend = val && prev ? val - prev : null;
          return (
            <div key={m.key} className={styles.metricCard}>
              <p className={styles.metricLabel}>{m.label}</p>
              <div className={styles.metricValue}>
                {val !== undefined && val !== null
                  ? <><span style={{ color: m.color, fontSize: 28, fontWeight: 600 }}>{typeof val === 'number' ? val.toFixed(m.decimals) : val}</span>
                      <span className="text-xs text-faint"> {m.unit}</span></>
                  : <span className="text-muted text-sm">No data</span>
                }
              </div>
              {trend !== null && (
                <p className="text-xs" style={{ color: trend > 0 ? 'var(--red)' : 'var(--green)' }}>
                  {trend > 0 ? '+' : ''}{trend.toFixed(m.decimals)} from last entry
                </p>
              )}
              {spark.length > 1 && <Sparkline data={spark} color={m.color} />}
            </div>
          );
        })}
      </div>

      {/* History table */}
      <h3 className={styles.sectionTitle} style={{ marginTop: 24, marginBottom: 10 }}>History</h3>
      <div className={styles.historyTable}>
        <div className={styles.historyHeader}>
          <span>Date</span>
          {METRICS.map(m => <span key={m.key}>{m.label}</span>)}
        </div>
        {records.slice(0, 30).map(rec => {
          const f = rec.fields;
          return (
            <div key={rec.id} className={styles.historyRow}>
              <span className="text-sm text-faint">
                {f.Date ? new Date(f.Date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
              </span>
              {METRICS.map(m => (
                <span key={m.key} className="text-sm">
                  {f[m.key] !== undefined && f[m.key] !== null
                    ? `${typeof f[m.key] === 'number' ? f[m.key].toFixed(m.decimals) : f[m.key]} ${m.unit}`
                    : '—'}
                </span>
              ))}
            </div>
          );
        })}
        {records.length === 0 && <p className="text-muted text-sm" style={{ padding: 12 }}>No metrics logged yet</p>}
      </div>
    </div>
  );
}

function Sparkline({ data, color }) {
  const w = 80, h = 24, pad = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} style={{ marginTop: 4 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
    </svg>
  );
}
