import { useState, useEffect } from 'react';
import { airtable } from '../../api.js';
import styles from './HealthViews.module.css';

const WORKOUT_TYPES = ['Run','Ride','Walk','Swim','Strength','HIIT','Yoga','Other'];

const TYPE_COLORS = {
  Run: '#c0392b', Ride: '#2E5FA3', Walk: '#1D9E75', Swim: '#0078D4',
  Strength: '#BA7517', HIIT: '#993556', Yoga: '#7F77DD', Other: '#5c6278',
};

export default function WorkoutsView() {
  const [workouts, setWorkouts] = useState([]);
  const [stravaStatus, setStravaStatus] = useState({ connected: false });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [typeFilter, setTypeFilter] = useState('All');
  const [newWorkout, setNewWorkout] = useState({
    Title: '', Date: new Date().toISOString().split('T')[0],
    Type: 'Run', 'Duration minutes': '', Distance: '',
    'Distance unit': 'miles', Calories: '', Notes: '',
  });

  async function load() {
    setLoading(true);
    try {
      const [wData, sData] = await Promise.all([
        airtable.list('workouts', { maxRecords: 200, 'sort[0][field]': 'Date', 'sort[0][direction]': 'desc' }),
        fetch('/api/health/strava/status').then(r => r.json()),
      ]);
      setWorkouts(wData.records || []);
      setStravaStatus(sData);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleStravaSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/health/strava/activities?per_page=30');
      const activities = await res.json();

      // Get existing Strava IDs to avoid duplicates
      const existingIds = new Set(workouts.map(w => w.fields['Strava ID']).filter(Boolean));

      let imported = 0;
      for (const activity of activities) {
        if (!activity['Strava ID'] || existingIds.has(activity['Strava ID'])) continue;
        const fields = {};
        Object.entries(activity).forEach(([k, v]) => { if (v !== null && v !== undefined) fields[k] = v; });
        await airtable.create('workouts', fields);
        imported++;
      }
      setSyncResult({ ok: true, message: `Synced ${imported} new activities from Strava` });
      load();
    } catch (err) {
      setSyncResult({ ok: false, message: `Sync failed: ${err.message}` });
    }
    setSyncing(false);
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!newWorkout.Title.trim()) return;
    setAdding(true);
    try {
      const fields = {
        Title:  newWorkout.Title,
        Date:   newWorkout.Date,
        Type:   newWorkout.Type,
        Source: 'Manual',
      };
      if (newWorkout['Duration minutes']) fields['Duration minutes'] = parseInt(newWorkout['Duration minutes']);
      if (newWorkout.Distance) fields.Distance = parseFloat(newWorkout.Distance);
      if (newWorkout['Distance unit']) fields['Distance unit'] = newWorkout['Distance unit'];
      if (newWorkout.Calories) fields.Calories = parseInt(newWorkout.Calories);
      if (newWorkout.Notes) fields.Notes = newWorkout.Notes;
      await airtable.create('workouts', fields);
      setShowAdd(false);
      setNewWorkout({ Title: '', Date: new Date().toISOString().split('T')[0], Type: 'Run', 'Duration minutes': '', Distance: '', 'Distance unit': 'miles', Calories: '', Notes: '' });
      load();
    } catch {}
    setAdding(false);
  }

  // Stats
  const thisMonth = new Date(); thisMonth.setDate(1);
  const monthWorkouts = workouts.filter(w => w.fields.Date && new Date(w.fields.Date) >= thisMonth);
  const totalDuration = monthWorkouts.reduce((s, w) => s + (w.fields['Duration minutes'] || 0), 0);
  const totalDistance = monthWorkouts.reduce((s, w) => s + (w.fields.Distance || 0), 0);

  const filtered = typeFilter === 'All' ? workouts : workouts.filter(w => w.fields.Type === typeFilter);

  if (loading) return <p className="text-muted">Loading workouts...</p>;

  return (
    <div>
      <div className={styles.toolbar}>
        <button className={styles.addBtn} onClick={() => setShowAdd(s => !s)}>+ Log workout</button>
        {stravaStatus.connected ? (
          <button className={styles.stravaBtn} onClick={handleStravaSync} disabled={syncing}>
            {syncing ? 'Syncing...' : 'Sync Strava'}
          </button>
        ) : (
          <a href="/api/health/strava/connect" className={styles.stravaBtn} target="_blank" rel="noopener noreferrer">
            Connect Strava
          </a>
        )}
      </div>

      {syncResult && (
        <div className={`${styles.syncResult} ${syncResult.ok ? styles.syncOk : styles.syncErr}`}>
          {syncResult.message}
        </div>
      )}

      {/* Monthly stats */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>This month</p>
          <p className={styles.statValue}>{monthWorkouts.length}</p>
          <p className="text-xs text-faint">workouts</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Total time</p>
          <p className={styles.statValue}>{Math.floor(totalDuration / 60)}h {totalDuration % 60}m</p>
          <p className="text-xs text-faint">this month</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Distance</p>
          <p className={styles.statValue}>{totalDistance.toFixed(1)}</p>
          <p className="text-xs text-faint">miles this month</p>
        </div>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className={styles.addForm}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Title</label>
              <input type="text" placeholder="Morning run" value={newWorkout.Title}
                onChange={e => setNewWorkout(n => ({ ...n, Title: e.target.value }))} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Date</label>
              <input type="date" value={newWorkout.Date}
                onChange={e => setNewWorkout(n => ({ ...n, Date: e.target.value }))} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Type</label>
              <select value={newWorkout.Type} onChange={e => setNewWorkout(n => ({ ...n, Type: e.target.value }))}
                className={styles.formSelect}>
                {WORKOUT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Duration (min)</label>
              <input type="number" value={newWorkout['Duration minutes']}
                onChange={e => setNewWorkout(n => ({ ...n, 'Duration minutes': e.target.value }))} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Distance</label>
              <input type="number" step="0.01" value={newWorkout.Distance}
                onChange={e => setNewWorkout(n => ({ ...n, Distance: e.target.value }))} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Calories</label>
              <input type="number" value={newWorkout.Calories}
                onChange={e => setNewWorkout(n => ({ ...n, Calories: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="submit" className={styles.addBtn} disabled={adding}>{adding ? '...' : 'Save'}</button>
            <button type="button" onClick={() => setShowAdd(false)} className={styles.cancelBtn}>Cancel</button>
          </div>
        </form>
      )}

      {/* Type filter */}
      <div className={styles.typeFilters}>
        {['All', ...WORKOUT_TYPES].map(t => (
          <button key={t}
            className={`${styles.typeBtn} ${typeFilter === t ? styles.typeBtnActive : ''}`}
            style={typeFilter === t && t !== 'All' ? { background: `${TYPE_COLORS[t]}22`, color: TYPE_COLORS[t], borderColor: `${TYPE_COLORS[t]}44` } : {}}
            onClick={() => setTypeFilter(t)}>{t}</button>
        ))}
      </div>

      {/* Workout list */}
      <div className={styles.workoutList}>
        {filtered.slice(0, 50).map(rec => {
          const f = rec.fields;
          const color = TYPE_COLORS[f.Type] || TYPE_COLORS.Other;
          return (
            <div key={rec.id} className={styles.workoutCard}>
              <div className={styles.workoutLeft}>
                <span className={styles.workoutType} style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>
                  {f.Type}
                </span>
                <div>
                  <p className={styles.workoutTitle}>{f.Title || f.Type}</p>
                  <p className="text-xs text-faint">
                    {f.Date ? new Date(f.Date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '—'}
                    {f.Source === 'Strava' && ' · Strava'}
                  </p>
                </div>
              </div>
              <div className={styles.workoutStats}>
                {f['Duration minutes'] && <span className={styles.workoutStat}>{f['Duration minutes']}m</span>}
                {f.Distance && <span className={styles.workoutStat}>{f.Distance} {f['Distance unit'] || 'mi'}</span>}
                {f.Calories && <span className={styles.workoutStat}>{f.Calories} cal</span>}
                {f['Heart rate avg'] && <span className={styles.workoutStat}>{f['Heart rate avg']} bpm</span>}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-muted text-sm">No workouts yet</p>}
      </div>
    </div>
  );
}
