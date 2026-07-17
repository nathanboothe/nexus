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
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

export default function ProjectsBoard() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [areaFilter, setAreaFilter] = useState('All');
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newProject, setNewProject] = useState({ Name: '', Status: 'Active', Priority: 'Medium', Area: '' });
  const [selected, setSelected] = useState(null);
  const [editFields, setEditFields] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function load() {
    setLoading(true);
    airtable.list('projects', { maxRecords: 200 })
      .then(data => { setRecords(data.records || []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function handleSelect(rec) {
    setSelected(rec);
    setEditFields({
      Name: rec.fields.Name || '',
      Status: rec.fields.Status || 'Active',
      Priority: rec.fields.Priority || 'Medium',
      Area: rec.fields.Area || '',
      'Due date': rec.fields['Due date'] || '',
      Notes: rec.fields.Notes || '',
      'Module tag': rec.fields['Module tag'] || '',
    });
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await airtable.update('projects', selected.id, editFields);
      setRecords(prev => prev.map(r => r.id === selected.id ? { ...r, fields: { ...r.fields, ...editFields } } : r));
      setSelected(prev => ({ ...prev, fields: { ...prev.fields, ...editFields } }));
    } catch {}
    setSaving(false);
  }

  async function handleDelete() {
    if (!selected) return;
    if (!window.confirm(`Delete "${selected.fields.Name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await airtable.delete('projects', selected.id);
      setRecords(prev => prev.filter(r => r.id !== selected.id));
      setSelected(null);
    } catch {}
    setDeleting(false);
  }

  async function handleStatusChange(recordId, newStatus) {
    try {
      await airtable.update('projects', recordId, { Status: newStatus });
      setRecords(prev => prev.map(r =>
        r.id === recordId ? { ...r, fields: { ...r.fields, Status: newStatus } } : r
      ));
      if (selected?.id === recordId) {
        setSelected(prev => ({ ...prev, fields: { ...prev.fields, Status: newStatus } }));
        setEditFields(prev => ({ ...prev, Status: newStatus }));
      }
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
      handleSelect(rec);
    } catch {}
    setAdding(false);
  }

  const filtered = areaFilter === 'All'
    ? records
    : records.filter(r => r.fields.Area === areaFilter);

  const byStatus = (status) => filtered.filter(r => r.fields.Status === status);

  if (loading) return <p className="text-muted">Loading projects...</p>;

  return (
    <div className={styles.layout}>
      <div className={styles.boardPane}>
        <div className={styles.toolbar}>
          <div className={styles.filters}>
            <button className={`${styles.filter} ${areaFilter === 'All' ? styles.filterActive : ''}`}
              onClick={() => setAreaFilter('All')}>All</button>
            {AREAS.map(a => (
              <button key={a}
                className={`${styles.filter} ${areaFilter === a ? styles.filterActive : ''}`}
                onClick={() => setAreaFilter(a)}>{a}</button>
            ))}
          </div>
          <button className={styles.addBtn} onClick={() => setShowAdd(s => !s)}>+ New project</button>
        </div>

        {showAdd && (
          <form onSubmit={handleAdd} className={styles.addForm}>
            <input type="text" placeholder="Project name" value={newProject.Name}
              onChange={e => setNewProject(p => ({ ...p, Name: e.target.value }))} style={{ flex: 2 }} />
            <select value={newProject.Status} onChange={e => setNewProject(p => ({ ...p, Status: e.target.value }))}
              style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px' }}>
              {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <select value={newProject.Priority} onChange={e => setNewProject(p => ({ ...p, Priority: e.target.value }))}
              style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px' }}>
              {PRIORITIES.map(p => <option key={p}>{p}</option>)}
            </select>
            <select value={newProject.Area} onChange={e => setNewProject(p => ({ ...p, Area: e.target.value }))}
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
                    const isSelected = selected?.id === rec.id;
                    return (
                      <div key={rec.id}
                        className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
                        onClick={() => handleSelect(rec)}>
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
                          <span className="text-xs text-faint">
                            Due {new Date(f['Due date']).toLocaleDateString()}
                          </span>
                        )}
                        <div className={styles.cardActions} onClick={e => e.stopPropagation()}>
                          {COLUMNS.filter(c => c.id !== col.id).map(c => (
                            <button key={c.id} className={styles.moveBtn}
                              onClick={() => handleStatusChange(rec.id, c.id)}>
                              → {c.label}
                            </button>
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

      {/* Edit panel */}
      {selected && (
        <div className={styles.editPane}>
          <div className={styles.editHeader}>
            <h3 className={styles.editTitle}>Edit project</h3>
            <button className={styles.closeBtn} onClick={() => setSelected(null)}>✕</button>
          </div>

          <div className={styles.editForm}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Name</label>
              <input type="text" value={editFields.Name || ''}
                onChange={e => setEditFields(f => ({ ...f, Name: e.target.value }))} />
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Status</label>
                <select value={editFields.Status || ''}
                  onChange={e => setEditFields(f => ({ ...f, Status: e.target.value }))}
                  className={styles.formSelect}>
                  {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Priority</label>
                <select value={editFields.Priority || ''}
                  onChange={e => setEditFields(f => ({ ...f, Priority: e.target.value }))}
                  className={styles.formSelect}>
                  {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Area</label>
                <select value={editFields.Area || ''}
                  onChange={e => setEditFields(f => ({ ...f, Area: e.target.value }))}
                  className={styles.formSelect}>
                  <option value="">No area</option>
                  {AREAS.map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Due date</label>
                <input type="date" value={editFields['Due date'] || ''}
                  onChange={e => setEditFields(f => ({ ...f, 'Due date': e.target.value }))}
                  style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', width: '100%' }} />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Notes</label>
              <textarea value={editFields.Notes || ''}
                onChange={e => setEditFields(f => ({ ...f, Notes: e.target.value }))}
                className={styles.formTextarea} rows={4}
                placeholder="Project notes..." />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Module tag</label>
              <input type="text" value={editFields['Module tag'] || ''}
                onChange={e => setEditFields(f => ({ ...f, 'Module tag': e.target.value }))}
                placeholder="e.g. smarthome, genealogy, life" />
            </div>

            <div className={styles.formActions}>
              <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save changes'}
              </button>
              <button className={styles.deleteBtn} onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>

            <div className={styles.metaInfo}>
              <p className="text-xs text-faint">Record ID: {selected.id}</p>
              {selected.createdTime && (
                <p className="text-xs text-faint">
                  Created {new Date(selected.createdTime).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
