import { useState, useEffect } from 'react';
import { airtable } from '../../api.js';
import styles from './TasksView.module.css';

const PRIORITY_BADGE = {
  'Critical': 'badge-red',
  'High':     'badge-amber',
  'Medium':   'badge-blue',
  'Low':      'badge-gray',
};

const AREAS = ['Home', 'Work', 'Health', 'Finance', 'Family', 'Learning', 'Personal', 'Genealogy'];

function dateLabel(dateStr) {
  if (!dateStr) return 'No due date';
  const d = new Date(dateStr);
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const taskDay = new Date(d); taskDay.setHours(0,0,0,0);
  if (taskDay < today) return 'Overdue';
  if (taskDay.getTime() === today.getTime()) return 'Today';
  if (taskDay.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  const today = new Date(); today.setHours(0,0,0,0);
  return d < today;
}

export default function TasksView() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('date');
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTask, setNewTask] = useState({ Title: '', Priority: 'Medium', Area: '', 'Due date': '' });

  function load() {
    setLoading(true);
    airtable.list('tasks', { maxRecords: 200 })
      .then(data => {
        const active = (data.records || []).filter(r =>
          r.fields.Status !== 'Done' && r.fields.Status !== 'Cancelled'
        );
        setTasks(active);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function toggleDone(recordId) {
    try {
      await airtable.update('tasks', recordId, { Status: 'Done' });
      setTasks(prev => prev.filter(r => r.id !== recordId));
    } catch {}
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!newTask.Title.trim()) return;
    setAdding(true);
    try {
      const fields = {
        Title: newTask.Title,
        Status: 'Not started',
        Priority: newTask.Priority,
      };
      if (newTask.Area) fields.Area = newTask.Area;
      if (newTask['Due date']) fields['Due date'] = newTask['Due date'];
      const rec = await airtable.create('tasks', fields);
      setTasks(prev => [...prev, rec]);
      setNewTask({ Title: '', Priority: 'Medium', Area: '', 'Due date': '' });
      setShowAdd(false);
    } catch {}
    setAdding(false);
  }

  // Group by date
  function groupByDate() {
    const groups = { 'Overdue': [], 'Today': [], 'Tomorrow': [], 'Upcoming': [], 'No due date': [] };
    tasks.forEach(r => {
      const label = dateLabel(r.fields['Due date']);
      if (groups[label]) {
        groups[label].push(r);
      } else {
        groups['Upcoming'].push(r);
      }
    });
    return groups;
  }

  // Group by project/area
  function groupByProject() {
    const groups = {};
    tasks.forEach(r => {
      const key = r.fields.Area || 'No area';
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    return groups;
  }

  if (loading) return <p className="text-muted">Loading tasks...</p>;

  const dateGroups = groupByDate();
  const projectGroups = groupByProject();

  return (
    <div>
      <div className={styles.toolbar}>
        <div className={styles.viewToggle}>
          <button className={`${styles.toggleBtn} ${view === 'date' ? styles.toggleActive : ''}`} onClick={() => setView('date')}>By date</button>
          <button className={`${styles.toggleBtn} ${view === 'project' ? styles.toggleActive : ''}`} onClick={() => setView('project')}>By area</button>
        </div>
        <button className={styles.addBtn} onClick={() => setShowAdd(s => !s)}>+ New task</button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className={styles.addForm}>
          <input
            type="text"
            placeholder="Task title"
            value={newTask.Title}
            onChange={e => setNewTask(t => ({ ...t, Title: e.target.value }))}
            style={{ flex: 2 }}
          />
          <select value={newTask.Priority} onChange={e => setNewTask(t => ({ ...t, Priority: e.target.value }))}
            style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px' }}>
            {['Critical','High','Medium','Low'].map(p => <option key={p}>{p}</option>)}
          </select>
          <input type="date" value={newTask['Due date']} onChange={e => setNewTask(t => ({ ...t, 'Due date': e.target.value }))}
            style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px' }} />
          <select value={newTask.Area} onChange={e => setNewTask(t => ({ ...t, Area: e.target.value }))}
            style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px' }}>
            <option value="">No area</option>
            {AREAS.map(a => <option key={a}>{a}</option>)}
          </select>
          <button type="submit" className={styles.addBtn} disabled={adding}>{adding ? '...' : 'Add'}</button>
          <button type="button" onClick={() => setShowAdd(false)}
            style={{ padding: '8px 12px', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', cursor: 'pointer' }}>
            Cancel
          </button>
        </form>
      )}

      {tasks.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ fontSize: 24, marginBottom: 8 }}>✓</p>
          <p className="text-muted">No active tasks</p>
        </div>
      )}

      {view === 'date' && (
        <div className={styles.groups}>
          {Object.entries(dateGroups).map(([label, items]) => {
            if (items.length === 0) return null;
            return (
              <div key={label} className={styles.group}>
                <h3 className={styles.groupLabel} style={{ color: label === 'Overdue' ? 'var(--red)' : label === 'Today' ? 'var(--green)' : 'var(--text2)' }}>
                  {label} <span className={styles.groupCount}>{items.length}</span>
                </h3>
                {items.map(rec => <TaskCard key={rec.id} rec={rec} onDone={toggleDone} />)}
              </div>
            );
          })}
        </div>
      )}

      {view === 'project' && (
        <div className={styles.groups}>
          {Object.entries(projectGroups).map(([label, items]) => (
            <div key={label} className={styles.group}>
              <h3 className={styles.groupLabel}>
                {label} <span className={styles.groupCount}>{items.length}</span>
              </h3>
              {items.map(rec => <TaskCard key={rec.id} rec={rec} onDone={toggleDone} />)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskCard({ rec, onDone }) {
  const f = rec.fields;
  const overdue = isOverdue(f['Due date']);
  return (
    <div className={styles.taskCard}>
      <button className={styles.checkbox} onClick={() => onDone(rec.id)} title="Mark done">○</button>
      <div className={styles.taskBody}>
        <span className={styles.taskTitle}>{f.Title || '—'}</span>
        <div className={styles.taskMeta}>
          {f.Priority && <span className={`badge ${PRIORITY_BADGE[f.Priority] || 'badge-gray'}`}>{f.Priority}</span>}
          {f['Due date'] && (
            <span className={`text-xs ${overdue ? '' : 'text-faint'}`} style={{ color: overdue ? 'var(--red)' : undefined }}>
              {new Date(f['Due date']).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          {f.Area && <span className="text-xs text-faint">{f.Area}</span>}
        </div>
      </div>
    </div>
  );
}
