import { useState, useEffect } from 'react';
import { airtable } from '../api.js';
import styles from './Habits.module.css';

const AREAS = ['Home', 'Work', 'Health', 'Finance', 'Family', 'Learning', 'Personal', 'Genealogy'];
const FREQUENCIES = ['Daily', 'Weekly', 'Weekdays', 'Custom'];

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function isCompletedToday(lastDone) {
  if (!lastDone) return false;
  return lastDone.split('T')[0] === todayStr();
}

function streakColor(streak) {
  if (streak >= 30) return '#f39c12';
  if (streak >= 7)  return '#1D9E75';
  if (streak >= 1)  return '#2E5FA3';
  return 'var(--text3)';
}

export default function Habits() {
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [newHabit, setNewHabit] = useState({
    Name: '', Frequency: 'Daily', Area: '', Target: 1, Notes: ''
  });

  function load() {
    setLoading(true);
    airtable.list('habits', { maxRecords: 100 })
      .then(data => { setHabits(data.records || []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleCheckIn(rec) {
    const f = rec.fields;
    const alreadyDone = isCompletedToday(f['Last done']);
    if (alreadyDone) return;

    const newStreak = (f.Streak || 0) + 1;
    try {
      const updated = await airtable.update('habits', rec.id, {
        'Last done': todayStr(),
        Streak: newStreak,
      });
      setHabits(prev => prev.map(r => r.id === rec.id ? { ...r, fields: { ...r.fields, 'Last done': todayStr(), Streak: newStreak } } : r));
    } catch {}
  }

  async function toggleActive(rec) {
    const newVal = !rec.fields.Active;
    try {
      await airtable.update('habits', rec.id, { Active: newVal });
      setHabits(prev => prev.map(r => r.id === rec.id ? { ...r, fields: { ...r.fields, Active: newVal } } : r));
    } catch {}
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!newHabit.Name.trim()) return;
    setAdding(true);
    try {
      const fields = {
        Name: newHabit.Name,
        Frequency: newHabit.Frequency,
        Target: parseInt(newHabit.Target) || 1,
        Streak: 0,
        Active: true,
      };
      if (newHabit.Area) fields.Area = newHabit.Area;
      if (newHabit.Notes) fields.Notes = newHabit.Notes;
      const rec = await airtable.create('habits', fields);
      setHabits(prev => [...prev, rec]);
      setNewHabit({ Name: '', Frequency: 'Daily', Area: '', Target: 1, Notes: '' });
      setShowAdd(false);
    } catch {}
    setAdding(false);
  }

  const activeHabits   = habits.filter(r => r.fields.Active !== false);
  const inactiveHabits = habits.filter(r => r.fields.Active === false);
  const completedToday = activeHabits.filter(r => isCompletedToday(r.fields['Last done'])).length;
  const totalActive    = activeHabits.length;

  if (loading) return <p className="text-muted">Loading habits...</p>;

  return (
    <div className="page">
      <div className={styles.header}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>Habits</h1>
          <p className="text-muted text-sm">Streaks · check-ins</p>
        </div>
        <div className={styles.progress}>
          <span className={styles.progressLabel}>{completedToday} / {totalActive} today</span>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: totalActive > 0 ? `${(completedToday / totalActive) * 100}%` : '0%' }}
            />
          </div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <button className={styles.addBtn} onClick={() => setShowAdd(s => !s)}>+ New habit</button>
        {inactiveHabits.length > 0 && (
          <button className={styles.toggleInactive} onClick={() => setShowInactive(s => !s)}>
            {showInactive ? 'Hide' : 'Show'} paused ({inactiveHabits.length})
          </button>
        )}
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className={styles.addForm}>
          <input
            type="text"
            placeholder="Habit name"
            value={newHabit.Name}
            onChange={e => setNewHabit(h => ({ ...h, Name: e.target.value }))}
            style={{ flex: 2 }}
          />
          <select value={newHabit.Frequency} onChange={e => setNewHabit(h => ({ ...h, Frequency: e.target.value }))}
            style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px' }}>
            {FREQUENCIES.map(f => <option key={f}>{f}</option>)}
          </select>
          <select value={newHabit.Area} onChange={e => setNewHabit(h => ({ ...h, Area: e.target.value }))}
            style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px' }}>
            <option value="">No area</option>
            {AREAS.map(a => <option key={a}>{a}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className={styles.addBtn} disabled={adding}>{adding ? '...' : 'Add'}</button>
            <button type="button" onClick={() => setShowAdd(false)}
              style={{ padding: '8px 12px', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {activeHabits.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p className="text-muted">No active habits — add one to get started</p>
        </div>
      )}

      <div className={styles.grid}>
        {activeHabits.map(rec => {
          const f = rec.fields;
          const done = isCompletedToday(f['Last done']);
          const streak = f.Streak || 0;
          return (
            <div key={rec.id} className={`${styles.card} ${done ? styles.cardDone : ''}`}>
              <div className={styles.cardTop}>
                <div className={styles.cardInfo}>
                  <span className={styles.cardName}>{f.Name}</span>
                  <div className={styles.cardMeta}>
                    {f.Frequency && <span className="badge badge-gray">{f.Frequency}</span>}
                    {f.Area && <span className="text-xs text-faint">{f.Area}</span>}
                  </div>
                </div>
                <div className={styles.streak} style={{ color: streakColor(streak) }}>
                  <span className={styles.streakNum}>{streak}</span>
                  <span className={styles.streakLabel}>day{streak !== 1 ? 's' : ''}</span>
                </div>
              </div>

              <div className={styles.cardBottom}>
                <button
                  className={`${styles.checkBtn} ${done ? styles.checkBtnDone : ''}`}
                  onClick={() => handleCheckIn(rec)}
                  disabled={done}
                >
                  {done ? '✓ Done today' : 'Check in'}
                </button>
                <button className={styles.pauseBtn} onClick={() => toggleActive(rec)} title="Pause habit">
                  ⏸
                </button>
              </div>

              {f['Last done'] && !done && (
                <p className="text-xs text-faint" style={{ marginTop: 4 }}>
                  Last: {new Date(f['Last done']).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {showInactive && inactiveHabits.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 className={styles.inactiveLabel}>Paused habits</h3>
          <div className={styles.grid}>
            {inactiveHabits.map(rec => (
              <div key={rec.id} className={`${styles.card} ${styles.cardInactive}`}>
                <div className={styles.cardTop}>
                  <span className={styles.cardName} style={{ opacity: 0.5 }}>{rec.fields.Name}</span>
                  <button className={styles.resumeBtn} onClick={() => toggleActive(rec)}>Resume</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
