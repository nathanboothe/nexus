import { useState, useEffect } from 'react';
import { airtable } from '../../api.js';
import styles from './HealthViews.module.css';

const FREQUENCIES = ['Daily','Twice daily','Weekly','As needed'];
const TIMES = ['Morning','Afternoon','Evening','Bedtime'];

export default function MedicationsView() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [newMed, setNewMed] = useState({
    Name: '', Dose: '', Frequency: 'Daily', 'Time of day': [], Notes: '',
  });

  function load() {
    setLoading(true);
    airtable.list('medications', { maxRecords: 100 })
      .then(data => { setRecords(data.records || []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!newMed.Name.trim()) return;
    setAdding(true);
    try {
      const fields = {
        Name: newMed.Name,
        Frequency: newMed.Frequency,
        Active: true,
      };
      if (newMed.Dose) fields.Dose = newMed.Dose;
      if (newMed['Time of day'].length) fields['Time of day'] = newMed['Time of day'];
      if (newMed.Notes) fields.Notes = newMed.Notes;
      await airtable.create('medications', fields);
      setNewMed({ Name: '', Dose: '', Frequency: 'Daily', 'Time of day': [], Notes: '' });
      setShowAdd(false);
      load();
    } catch {}
    setAdding(false);
  }

  async function toggleActive(rec) {
    const newVal = !rec.fields.Active;
    try {
      await airtable.update('medications', rec.id, { Active: newVal });
      setRecords(prev => prev.map(r => r.id === rec.id ? { ...r, fields: { ...r.fields, Active: newVal } } : r));
    } catch {}
  }

  function toggleTime(time) {
    setNewMed(n => ({
      ...n,
      'Time of day': n['Time of day'].includes(time)
        ? n['Time of day'].filter(t => t !== time)
        : [...n['Time of day'], time],
    }));
  }

  const active   = records.filter(r => r.fields.Active !== false);
  const inactive = records.filter(r => r.fields.Active === false);

  if (loading) return <p className="text-muted">Loading medications...</p>;

  return (
    <div>
      <div className={styles.toolbar}>
        <button className={styles.addBtn} onClick={() => setShowAdd(s => !s)}>+ Add medication</button>
        {inactive.length > 0 && (
          <button className={styles.cancelBtn} onClick={() => setShowInactive(s => !s)}>
            {showInactive ? 'Hide' : 'Show'} inactive ({inactive.length})
          </button>
        )}
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className={styles.addForm}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Medication name</label>
              <input type="text" placeholder="Lisinopril" value={newMed.Name}
                onChange={e => setNewMed(n => ({ ...n, Name: e.target.value }))} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Dose</label>
              <input type="text" placeholder="10mg" value={newMed.Dose}
                onChange={e => setNewMed(n => ({ ...n, Dose: e.target.value }))} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Frequency</label>
              <select value={newMed.Frequency} onChange={e => setNewMed(n => ({ ...n, Frequency: e.target.value }))}
                className={styles.formSelect}>
                {FREQUENCIES.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
              <label className={styles.formLabel}>Time of day</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {TIMES.map(t => (
                  <button key={t} type="button"
                    className={`${styles.timeBtn} ${newMed['Time of day'].includes(t) ? styles.timeBtnActive : ''}`}
                    onClick={() => toggleTime(t)}>{t}</button>
                ))}
              </div>
            </div>
            <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
              <label className={styles.formLabel}>Notes</label>
              <input type="text" value={newMed.Notes}
                onChange={e => setNewMed(n => ({ ...n, Notes: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="submit" className={styles.addBtn} disabled={adding}>{adding ? '...' : 'Save'}</button>
            <button type="button" onClick={() => setShowAdd(false)} className={styles.cancelBtn}>Cancel</button>
          </div>
        </form>
      )}

      <div className={styles.medGrid}>
        {active.length === 0 && <p className="text-muted text-sm">No active medications</p>}
        {active.map(rec => {
          const f = rec.fields;
          const times = Array.isArray(f['Time of day']) ? f['Time of day'] : f['Time of day'] ? [f['Time of day']] : [];
          return (
            <div key={rec.id} className={styles.medCard}>
              <div className={styles.medTop}>
                <div>
                  <p className={styles.medName}>{f.Name}</p>
                  <p className="text-xs text-faint">{f.Dose} {f.Dose && f.Frequency ? '—' : ''} {f.Frequency}</p>
                </div>
                <button className={styles.deactivateBtn} onClick={() => toggleActive(rec)} title="Deactivate">
                  Pause
                </button>
              </div>
              {times.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                  {times.map(t => (
                    <span key={t} className="badge badge-blue" style={{ fontSize: 10 }}>{t}</span>
                  ))}
                </div>
              )}
              {f.Notes && <p className="text-xs text-faint" style={{ marginTop: 4 }}>{f.Notes}</p>}
            </div>
          );
        })}
      </div>

      {showInactive && inactive.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3 className={styles.sectionTitle} style={{ marginBottom: 10 }}>Inactive</h3>
          <div className={styles.medGrid}>
            {inactive.map(rec => (
              <div key={rec.id} className={`${styles.medCard} ${styles.medInactive}`}>
                <div className={styles.medTop}>
                  <p className={styles.medName} style={{ opacity: 0.5 }}>{rec.fields.Name}</p>
                  <button className={styles.addBtn} onClick={() => toggleActive(rec)} style={{ fontSize: 11, padding: '4px 10px' }}>
                    Resume
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
