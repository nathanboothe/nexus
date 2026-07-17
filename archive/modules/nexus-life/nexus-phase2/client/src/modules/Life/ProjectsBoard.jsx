import { useState, useEffect } from 'react';
import { airtable } from '../../api.js';
import styles from './ProjectsBoard.module.css';

const COLUMNS = [
  { id: 'Active',   label: 'Active',   color: '#1D9E75' },
  { id: 'On Hold',  label: 'On Hold',  color: '#BA7517' },
  { id: 'Someday',  label: 'Someday',  color: '#5c6278' },
  { id: 'Complete', label: 'Complete', color: '#2E5FA3' },
];

const PRIORITY_BADGE = {
  'Critical': 'badge-red',
  'High':     'badge-amber',
  'Medium':   'badge-blue',
  'Low':      'badge-gray',
};

const AREAS = ['Home', 'Work', 'Health', 'Finance', 'Family', 'Learning', 'Personal', 'Genealogy'];

export default function ProjectsBoard() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [areaFilter, setAreaFilter] = useState('All');
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newProject, setNewProject] = useState({ Name: '', Status: 'Active', Priority: 'Medium', Area: '' });

  function load() {
    setLoading(true);
    airtable.list('projects', { maxRecords: 200 })
      .then(data => { setRecords(data.records || []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleStatusChange(recordId, newStatus) {
    try {
      await airtable.update('projects', recordId, { Status: newStatus });
      setRecords(prev => prev.map(r =>
        r.id === recordId ? { ...r, fields: { ...r.fields, Status: newStatus } } : r
      ));
    } catch {}
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!newProject.Name.trim()) return;
    setAdding(true);
    try {
      const rec = await airtable.create('projects', newProject);
      setRecords(prev => [...prev, rec]);
      setNewProject({ Name: '', Status: 'Active', Priority: 'Medium', Area: '' });
      setShowAdd(false);
    } catch {}
    setAdding(false);
  }

  const filtered = areaFilter === 'All'
    ? records
    : records.filter(r => r.fields.Area === areaFilter);

  const byStatus = (status) => filtered.filter(r => r.fields.Status === status);

  if (loading) return <p className="text-muted">Loading projects...</p>;

  return (
    <div>
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <button
            className={`${styles.filter} ${areaFilter === 'All' ? styles.filterActive : ''}`}
            onClick={() => setAreaFilter('All')}
          >All</button>
          {AREAS.map(a => (
            <button
              key={a}
              className={`${styles.filter} ${areaFilter === a ? styles.filterActive : ''}`}
              onClick={() => setAreaFilter(a)}
            >{a}</button>
          ))}
        </div>
        <button className={styles.addBtn} onClick={() => setShowAdd(s => !s)}>
          + New project
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className={styles.addForm}>
          <input
            type="text"
            placeholder="Project name"
            value={newProject.Name}
            onChange={e => setNewProject(p => ({ ...p, Name: e.target.value }))}
            style={{ flex: 2 }}
          />
          <select value={newProject.Status} onChange={e => setNewProject(p => ({ ...p, Status: e.target.value }))}
            style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px' }}>
            {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select value={newProject.Priority} onChange={e => setNewProject(p => ({ ...p, Priority: e.target.value }))}
            style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px' }}>
            {['Critical','High','Medium','Low'].map(p => <option key={p}>{p}</option>)}
          </select>
          <select value={newProject.Area} onChange={e => setNewProject(p => ({ ...p, Area: e.target.value }))}
            style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px' }}>
            <option value="">No area</option>
            {AREAS.map(a => <option key={a}>{a}</option>)}
          </select>
          <button type="submit" className={styles.addBtn} disabled={adding}>
            {adding ? '...' : 'Add'}
          </button>
          <button type="button" onClick={() => setShowAdd(false)}
            style={{ padding: '8px 12px', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', cursor: 'pointer' }}>
            Cancel
          </button>
        </form>
      )}

      <div className={styles.board}>
        {COLUMNS.map(col => {
          const colRecords = byStatus(col.id);
          return (
            <div key={col.id} className={styles.column}>
              <div className={styles.colHeader}>
                <span className={styles.colDot} style={{ background: col.color }} />
                <span className={styles.colLabel}>{col.label}</span>
                <span className={styles.colCount}>{colRecords.length}</span>
              </div>
              <div className={styles.cards}>
                {colRecords.length === 0 && (
                  <p className="text-faint text-sm" style={{ padding: '8px 0' }}>No projects</p>
                )}
                {colRecords.map(rec => {
                  const f = rec.fields;
                  return (
                    <div key={rec.id} className={styles.card}>
                      <div className={styles.cardTop}>
                        <span className={styles.cardName}>{f.Name || '—'}</span>
                        {f.Priority && (
                          <span className={`badge ${PRIORITY_BADGE[f.Priority] || 'badge-gray'}`}>
                            {f.Priority}
                          </span>
                        )}
                      </div>
                      {f.Area && <span className={styles.cardArea}>{f.Area}</span>}
                      {f['Due date'] && (
                        <span className="text-xs text-faint">Due {new Date(f['Due date']).toLocaleDateString()}</span>
                      )}
                      <div className={styles.cardActions}>
                        {COLUMNS.filter(c => c.id !== col.id).map(c => (
                          <button
                            key={c.id}
                            className={styles.moveBtn}
                            onClick={() => handleStatusChange(rec.id, c.id)}
                          >→ {c.label}</button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
