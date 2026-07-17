import { useState, useEffect } from 'react';
import { airtable } from '../../api.js';
import styles from './HealthViews.module.css';

const TYPES = ['Doctor','Dentist','Eye','Specialist','Lab','Other'];
const TYPE_COLORS = {
  Doctor: '#2E5FA3', Dentist: '#1D9E75', Eye: '#7F77DD',
  Specialist: '#BA7517', Lab: '#c0392b', Other: '#5c6278',
};

export default function AppointmentsView() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [newAppt, setNewAppt] = useState({
    Title: '', Date: '', Provider: '', Type: 'Doctor', Location: '', Notes: '',
  });

  function load() {
    setLoading(true);
    airtable.list('appointments', { maxRecords: 100, 'sort[0][field]': 'Date', 'sort[0][direction]': 'asc' })
      .then(data => { setRecords(data.records || []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!newAppt.Title.trim() || !newAppt.Date) return;
    setAdding(true);
    try {
      const fields = { Title: newAppt.Title, Date: newAppt.Date, Type: newAppt.Type, Completed: false };
      if (newAppt.Provider) fields.Provider = newAppt.Provider;
      if (newAppt.Location) fields.Location = newAppt.Location;
      if (newAppt.Notes) fields.Notes = newAppt.Notes;
      await airtable.create('appointments', fields);
      setNewAppt({ Title: '', Date: '', Provider: '', Type: 'Doctor', Location: '', Notes: '' });
      setShowAdd(false);
      load();
    } catch {}
    setAdding(false);
  }

  async function toggleComplete(rec) {
    const newVal = !rec.fields.Completed;
    try {
      await airtable.update('appointments', rec.id, { Completed: newVal });
      setRecords(prev => prev.map(r => r.id === rec.id ? { ...r, fields: { ...r.fields, Completed: newVal } } : r));
    } catch {}
  }

  const upcoming  = records.filter(r => !r.fields.Completed);
  const completed = records.filter(r => r.fields.Completed);
  const today = new Date(); today.setHours(0,0,0,0);

  if (loading) return <p className="text-muted">Loading appointments...</p>;

  return (
    <div>
      <div className={styles.toolbar}>
        <button className={styles.addBtn} onClick={() => setShowAdd(s => !s)}>+ Add appointment</button>
        {completed.length > 0 && (
          <button className={styles.cancelBtn} onClick={() => setShowCompleted(s => !s)}>
            {showCompleted ? 'Hide' : 'Show'} completed ({completed.length})
          </button>
        )}
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className={styles.addForm}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Title</label>
              <input type="text" placeholder="Annual physical" value={newAppt.Title}
                onChange={e => setNewAppt(n => ({ ...n, Title: e.target.value }))} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Date & time</label>
              <input type="datetime-local" value={newAppt.Date}
                onChange={e => setNewAppt(n => ({ ...n, Date: e.target.value }))}
                style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px' }} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Type</label>
              <select value={newAppt.Type} onChange={e => setNewAppt(n => ({ ...n, Type: e.target.value }))}
                className={styles.formSelect}>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Provider</label>
              <input type="text" placeholder="Dr. Smith" value={newAppt.Provider}
                onChange={e => setNewAppt(n => ({ ...n, Provider: e.target.value }))} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Location</label>
              <input type="text" value={newAppt.Location}
                onChange={e => setNewAppt(n => ({ ...n, Location: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="submit" className={styles.addBtn} disabled={adding}>{adding ? '...' : 'Save'}</button>
            <button type="button" onClick={() => setShowAdd(false)} className={styles.cancelBtn}>Cancel</button>
          </div>
        </form>
      )}

      <div className={styles.apptList}>
        {upcoming.length === 0 && <p className="text-muted text-sm">No upcoming appointments</p>}
        {upcoming.map(rec => {
          const f = rec.fields;
          const d = f.Date ? new Date(f.Date) : null;
          const isPast = d && d < today;
          const color = TYPE_COLORS[f.Type] || TYPE_COLORS.Other;
          return (
            <div key={rec.id} className={`${styles.apptCard} ${isPast ? styles.apptPast : ''}`}>
              <div className={styles.apptLeft}>
                <span className={styles.apptType} style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>
                  {f.Type}
                </span>
                <div>
                  <p className={styles.apptTitle}>{f.Title}</p>
                  {f.Provider && <p className="text-xs text-faint">{f.Provider}</p>}
                  {f.Location && <p className="text-xs text-faint">{f.Location}</p>}
                </div>
              </div>
              <div className={styles.apptRight}>
                {d && (
                  <div style={{ textAlign: 'right' }}>
                    <p className="text-sm font-medium">{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    <p className="text-xs text-faint">{d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
                  </div>
                )}
                <button className={styles.completeBtn} onClick={() => toggleComplete(rec)} title="Mark complete">
                  ✓
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showCompleted && completed.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3 className={styles.sectionTitle} style={{ marginBottom: 10 }}>Completed</h3>
          {completed.map(rec => (
            <div key={rec.id} className={`${styles.apptCard} ${styles.apptCompleted}`}>
              <p className="text-sm text-muted line-through">{rec.fields.Title}</p>
              <button className={styles.cancelBtn} onClick={() => toggleComplete(rec)} style={{ fontSize: 11 }}>Reopen</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
