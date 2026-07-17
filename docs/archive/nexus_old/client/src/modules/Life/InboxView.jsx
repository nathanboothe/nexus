import { useState, useEffect } from 'react';
import { airtable } from '../../api.js';
import styles from './InboxView.module.css';

const PROJECTS = ['Active', 'On Hold', 'Someday'];
const AREAS = ['Home', 'Work', 'Health', 'Finance', 'Family', 'Learning', 'Personal', 'Genealogy'];

export default function InboxView() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [actionItem, setActionItem] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [actionFields, setActionFields] = useState({});
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    airtable.list('inbox', { maxRecords: 100 })
      .then(data => {
        const unprocessed = (data.records || []).filter(r => r.fields.Status === 'Unprocessed');
        setRecords(unprocessed);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function dismiss(recordId) {
    setProcessing(recordId);
    try {
      await airtable.update('inbox', recordId, { Status: 'Dismissed' });
      setRecords(prev => prev.filter(r => r.id !== recordId));
    } catch {}
    setProcessing(null);
  }

  async function markDone(recordId) {
    setProcessing(recordId);
    try {
      await airtable.update('inbox', recordId, { Status: 'Done' });
      setRecords(prev => prev.filter(r => r.id !== recordId));
    } catch {}
    setProcessing(null);
  }

  function startAction(record, type) {
    setActionItem(record);
    setActionType(type);
    setActionFields({
      name: record.fields.Capture || '',
      priority: 'Medium',
      area: '',
      status: 'Active',
      due: '',
    });
  }

  async function confirmAction() {
    if (!actionItem) return;
    setSaving(true);
    try {
      if (actionType === 'task') {
        await airtable.create('tasks', {
          Title: actionFields.name,
          Status: 'Not started',
          Priority: actionFields.priority,
          Area: actionFields.area || undefined,
          'Due date': actionFields.due || undefined,
        });
      } else if (actionType === 'project') {
        await airtable.create('projects', {
          Name: actionFields.name,
          Status: actionFields.status,
          Priority: actionFields.priority,
          Area: actionFields.area || undefined,
        });
      } else if (actionType === 'note') {
        await airtable.create('notes', {
          Title: actionFields.name,
          Body: actionItem.fields.Capture,
          Area: actionFields.area || undefined,
        });
      }
      await airtable.update('inbox', actionItem.id, { Status: 'Done' });
      setRecords(prev => prev.filter(r => r.id !== actionItem.id));
      setActionItem(null);
      setActionType(null);
    } catch {}
    setSaving(false);
  }

  if (loading) return <p className="text-muted">Loading inbox...</p>;

  return (
    <div>
      <div className={styles.header}>
        <p className="text-muted text-sm">{records.length} unprocessed item{records.length !== 1 ? 's' : ''}</p>
      </div>

      {records.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ fontSize: 24, marginBottom: 8 }}>✓</p>
          <p className="text-muted">Inbox is clear</p>
        </div>
      )}

      {/* Action modal */}
      {actionItem && (
        <div className={styles.modal}>
          <div className={styles.modalBox}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
              Convert to {actionType}
            </h3>
            <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
              "{actionItem.fields.Capture}"
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                type="text"
                value={actionFields.name}
                onChange={e => setActionFields(f => ({ ...f, name: e.target.value }))}
                placeholder={actionType === 'task' ? 'Task title' : actionType === 'project' ? 'Project name' : 'Note title'}
              />
              {(actionType === 'task' || actionType === 'project') && (
                <select value={actionFields.priority}
                  onChange={e => setActionFields(f => ({ ...f, priority: e.target.value }))}
                  style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px' }}>
                  {['Critical','High','Medium','Low'].map(p => <option key={p}>{p}</option>)}
                </select>
              )}
              {actionType === 'project' && (
                <select value={actionFields.status}
                  onChange={e => setActionFields(f => ({ ...f, status: e.target.value }))}
                  style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px' }}>
                  {['Active','On Hold','Someday'].map(s => <option key={s}>{s}</option>)}
                </select>
              )}
              {actionType === 'task' && (
                <input type="date" value={actionFields.due}
                  onChange={e => setActionFields(f => ({ ...f, due: e.target.value }))}
                  style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px' }}
                />
              )}
              <select value={actionFields.area}
                onChange={e => setActionFields(f => ({ ...f, area: e.target.value }))}
                style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px' }}>
                <option value="">No area</option>
                {AREAS.map(a => <option key={a}>{a}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={styles.confirmBtn} onClick={confirmAction} disabled={saving}>
                  {saving ? '...' : 'Confirm'}
                </button>
                <button className={styles.cancelBtn} onClick={() => setActionItem(null)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={styles.list}>
        {records.map(rec => {
          const f = rec.fields;
          const isProc = processing === rec.id;
          return (
            <div key={rec.id} className={styles.item}>
              <div className={styles.itemTop}>
                <span className={styles.itemText}>{f.Capture}</span>
                {f.Type && <span className="badge badge-gray text-xs">{f.Type}</span>}
              </div>
              {f.Source && <p className="text-xs text-faint">via {f.Source}</p>}
              <div className={styles.itemActions}>
                <button className={styles.actionBtn} onClick={() => startAction(rec, 'task')} disabled={isProc}>
                  → Task
                </button>
                <button className={styles.actionBtn} onClick={() => startAction(rec, 'project')} disabled={isProc}>
                  → Project
                </button>
                <button className={styles.actionBtn} onClick={() => startAction(rec, 'note')} disabled={isProc}>
                  → Note
                </button>
                <button className={styles.doneBtn} onClick={() => markDone(rec.id)} disabled={isProc}>
                  ✓ Done
                </button>
                <button className={styles.dismissBtn} onClick={() => dismiss(rec.id)} disabled={isProc}>
                  Dismiss
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
