import { useState, useEffect } from 'react';
import { airtable } from '../api.js';
import styles from './Notes.module.css';

const AREAS = ['Home', 'Work', 'Health', 'Finance', 'Family', 'Learning', 'Personal', 'Genealogy'];

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('All');
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState({});
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newNote, setNewNote] = useState({ Title: '', Body: '', Area: '', Pinned: false });

  function load() {
    setLoading(true);
    airtable.list('notes', { maxRecords: 200 })
      .then(data => {
        const sorted = (data.records || []).sort((a, b) => {
          if (a.fields.Pinned && !b.fields.Pinned) return -1;
          if (!a.fields.Pinned && b.fields.Pinned) return 1;
          return new Date(b.createdTime) - new Date(a.createdTime);
        });
        setNotes(sorted);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!newNote.Title.trim()) return;
    setAdding(true);
    try {
      const fields = { Title: newNote.Title, Body: newNote.Body };
      if (newNote.Area) fields.Area = newNote.Area;
      if (newNote.Pinned) fields.Pinned = true;
      const rec = await airtable.create('notes', fields);
      setNotes(prev => [rec, ...prev]);
      setNewNote({ Title: '', Body: '', Area: '', Pinned: false });
      setShowAdd(false);
      setSelected(rec);
    } catch {}
    setAdding(false);
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      await airtable.update('notes', selected.id, editFields);
      setNotes(prev => prev.map(r =>
        r.id === selected.id ? { ...r, fields: { ...r.fields, ...editFields } } : r
      ));
      setSelected(prev => ({ ...prev, fields: { ...prev.fields, ...editFields } }));
      setEditing(false);
    } catch {}
    setSaving(false);
  }

  async function togglePin(rec) {
    const newVal = !rec.fields.Pinned;
    try {
      await airtable.update('notes', rec.id, { Pinned: newVal });
      setNotes(prev => {
        const updated = prev.map(r =>
          r.id === rec.id ? { ...r, fields: { ...r.fields, Pinned: newVal } } : r
        );
        return updated.sort((a, b) => {
          if (a.fields.Pinned && !b.fields.Pinned) return -1;
          if (!a.fields.Pinned && b.fields.Pinned) return 1;
          return 0;
        });
      });
      if (selected?.id === rec.id) {
        setSelected(prev => ({ ...prev, fields: { ...prev.fields, Pinned: newVal } }));
      }
    } catch {}
  }

  async function handleDelete(rec) {
    if (!window.confirm(`Delete "${rec.fields.Title}"?`)) return;
    try {
      await airtable.delete('notes', rec.id);
      setNotes(prev => prev.filter(r => r.id !== rec.id));
      if (selected?.id === rec.id) setSelected(null);
    } catch {}
  }

  function startEdit(rec) {
    setEditFields({ Title: rec.fields.Title || '', Body: rec.fields.Body || '', Area: rec.fields.Area || '' });
    setEditing(true);
  }

  const filtered = notes.filter(r => {
    const matchArea = areaFilter === 'All' || r.fields.Area === areaFilter;
    const matchSearch = !search || (r.fields.Title || '').toLowerCase().includes(search.toLowerCase())
      || (r.fields.Body || '').toLowerCase().includes(search.toLowerCase());
    return matchArea && matchSearch;
  });

  const pinned   = filtered.filter(r => r.fields.Pinned);
  const unpinned = filtered.filter(r => !r.fields.Pinned);

  if (loading) return <div className="page"><p className="text-muted">Loading notes...</p></div>;

  return (
    <div className="page">
      <div className={styles.layout}>
        {/* Sidebar */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarTop}>
            <input
              type="text"
              placeholder="Search notes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button className={styles.addBtn} onClick={() => { setShowAdd(true); setSelected(null); setEditing(false); }}>
              + New
            </button>
          </div>

          <div className={styles.areaFilters}>
            {['All', ...AREAS].map(a => (
              <button
                key={a}
                className={`${styles.areaBtn} ${areaFilter === a ? styles.areaBtnActive : ''}`}
                onClick={() => setAreaFilter(a)}
              >{a}</button>
            ))}
          </div>

          <div className={styles.noteList}>
            {pinned.length > 0 && (
              <>
                <p className={styles.listLabel}>Pinned</p>
                {pinned.map(rec => (
                  <NoteListItem key={rec.id} rec={rec} selected={selected} onSelect={setSelected} />
                ))}
              </>
            )}
            {unpinned.length > 0 && (
              <>
                {pinned.length > 0 && <p className={styles.listLabel}>Notes</p>}
                {unpinned.map(rec => (
                  <NoteListItem key={rec.id} rec={rec} selected={selected} onSelect={setSelected} />
                ))}
              </>
            )}
            {filtered.length === 0 && (
              <p className="text-muted text-sm" style={{ padding: '12px 0' }}>No notes found</p>
            )}
          </div>
        </div>

        {/* Main panel */}
        <div className={styles.main}>
          {showAdd && (
            <form onSubmit={handleAdd} className={styles.addForm}>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>New note</h2>
              <input
                type="text"
                placeholder="Title"
                value={newNote.Title}
                onChange={e => setNewNote(n => ({ ...n, Title: e.target.value }))}
                style={{ marginBottom: 8 }}
              />
              <textarea
                placeholder="Body (optional)"
                value={newNote.Body}
                onChange={e => setNewNote(n => ({ ...n, Body: e.target.value }))}
                className={styles.textarea}
                rows={6}
              />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                <select value={newNote.Area} onChange={e => setNewNote(n => ({ ...n, Area: e.target.value }))}
                  style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', flex: 1 }}>
                  <option value="">No area</option>
                  {AREAS.map(a => <option key={a}>{a}</option>)}
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={newNote.Pinned} onChange={e => setNewNote(n => ({ ...n, Pinned: e.target.checked }))} />
                  Pin
                </label>
                <button type="submit" className={styles.addBtn} disabled={adding}>{adding ? '...' : 'Save'}</button>
                <button type="button" onClick={() => setShowAdd(false)}
                  style={{ padding: '8px 12px', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {selected && !showAdd && (
            <div className={styles.noteDetail}>
              {editing ? (
                <>
                  <input
                    type="text"
                    value={editFields.Title}
                    onChange={e => setEditFields(f => ({ ...f, Title: e.target.value }))}
                    style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, background: 'var(--surface2)' }}
                  />
                  <textarea
                    value={editFields.Body}
                    onChange={e => setEditFields(f => ({ ...f, Body: e.target.value }))}
                    className={styles.textarea}
                    rows={16}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <select value={editFields.Area} onChange={e => setEditFields(f => ({ ...f, Area: e.target.value }))}
                      style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px' }}>
                      <option value="">No area</option>
                      {AREAS.map(a => <option key={a}>{a}</option>)}
                    </select>
                    <button className={styles.addBtn} onClick={handleSave} disabled={saving}>{saving ? '...' : 'Save'}</button>
                    <button onClick={() => setEditing(false)}
                      style={{ padding: '8px 12px', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.detailHeader}>
                    <h2 className={styles.detailTitle}>{selected.fields.Title}</h2>
                    <div className={styles.detailActions}>
                      <button className={styles.iconBtn} onClick={() => togglePin(selected)} title={selected.fields.Pinned ? 'Unpin' : 'Pin'}>
                        {selected.fields.Pinned ? '📌' : '📍'}
                      </button>
                      <button className={styles.iconBtn} onClick={() => startEdit(selected)} title="Edit">✏️</button>
                      <button className={styles.iconBtn} onClick={() => handleDelete(selected)} title="Delete">🗑</button>
                    </div>
                  </div>
                  {selected.fields.Area && (
                    <span className="badge badge-gray" style={{ marginBottom: 12, display: 'inline-block' }}>{selected.fields.Area}</span>
                  )}
                  <div className={styles.detailBody}>
                    {selected.fields.Body
                      ? selected.fields.Body.split('\n').map((line, i) => (
                          <p key={i} style={{ marginBottom: 4 }}>{line || <br />}</p>
                        ))
                      : <p className="text-muted text-sm">No content — click edit to add.</p>
                    }
                  </div>
                  <p className="text-xs text-faint" style={{ marginTop: 16 }}>
                    Created {new Date(selected.createdTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </>
              )}
            </div>
          )}

          {!selected && !showAdd && (
            <div className={styles.empty}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>◻</p>
              <p className="text-muted">Select a note or create a new one</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NoteListItem({ rec, selected, onSelect }) {
  const f = rec.fields;
  const isSelected = selected?.id === rec.id;
  return (
    <button
      className={`${styles.noteItem} ${isSelected ? styles.noteItemActive : ''}`}
      onClick={() => onSelect(rec)}
    >
      <div className={styles.noteItemTop}>
        <span className={styles.noteItemTitle}>{f.Title || 'Untitled'}</span>
        {f.Pinned && <span style={{ fontSize: 10 }}>📌</span>}
      </div>
      {f.Body && (
        <p className={styles.noteItemPreview}>{f.Body.slice(0, 60)}{f.Body.length > 60 ? '...' : ''}</p>
      )}
      {f.Area && <span className="text-xs text-faint">{f.Area}</span>}
    </button>
  );
}
