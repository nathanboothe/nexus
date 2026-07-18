import { useState, useEffect } from 'react';
import { airtable } from '../../api.js';
import styles from './ResearchView.module.css';

const STATUSES = ['Open', 'In Progress', 'Resolved', 'Parked'];
const STATUS_COLORS = {
  'Open':        'badge-red',
  'In Progress': 'badge-blue',
  'Resolved':    'badge-green',
  'Parked':      'badge-gray',
};

export default function ResearchView() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('Open');
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newQ, setNewQ] = useState({ Question: '', Status: 'Open', Priority: 'High' });
  const [expanded, setExpanded] = useState(null);

  function load() {
    setLoading(true);
    airtable.list('researchQuestions', { maxRecords: 200 })
      .then(data => { setQuestions(data.records || []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!newQ.Question.trim()) return;
    setAdding(true);
    try {
      const rec = await airtable.create('researchQuestions', {
        Question: newQ.Question,
        Status: newQ.Status,
        Priority: newQ.Priority,
      });
      setQuestions(prev => [rec, ...prev]);
      setNewQ({ Question: '', Status: 'Open', Priority: 'High' });
      setShowAdd(false);
    } catch {}
    setAdding(false);
  }

  async function handleStatusChange(recordId, newStatus) {
    try {
      await airtable.update('researchQuestions', recordId, { Status: newStatus });
      setQuestions(prev => prev.map(r =>
        r.id === recordId ? { ...r, fields: { ...r.fields, Status: newStatus } } : r
      ));
    } catch {}
  }

  const filtered = statusFilter === 'All'
    ? questions
    : questions.filter(r => r.fields.Status === statusFilter);

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = questions.filter(r => r.fields.Status === s).length;
    return acc;
  }, {});

  if (loading) return <p className="text-muted">Loading research questions...</p>;

  return (
    <div>
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <button
            className={`${styles.filterBtn} ${statusFilter === 'All' ? styles.filterActive : ''}`}
            onClick={() => setStatusFilter('All')}
          >All ({questions.length})</button>
          {STATUSES.map(s => (
            <button key={s}
              className={`${styles.filterBtn} ${statusFilter === s ? styles.filterActive : ''}`}
              onClick={() => setStatusFilter(s)}>
              {s} ({counts[s] || 0})
            </button>
          ))}
        </div>
        <button className={styles.addBtn} onClick={() => setShowAdd(s => !s)}>+ New question</button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className={styles.addForm}>
          <input type="text" placeholder="Research question"
            value={newQ.Question} onChange={e => setNewQ(q => ({ ...q, Question: e.target.value }))}
            style={{ flex: 2 }} />
          <select value={newQ.Priority} onChange={e => setNewQ(q => ({ ...q, Priority: e.target.value }))}
            style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px' }}>
            {['Critical','High','Medium','Low'].map(p => <option key={p}>{p}</option>)}
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

      {filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p className="text-muted">No {statusFilter.toLowerCase()} research questions</p>
        </div>
      )}

      <div className={styles.questionList}>
        {filtered.map(rec => {
          const f = rec.fields;
          const isExpanded = expanded === rec.id;
          return (
            <div key={rec.id} className={styles.questionCard}>
              <div className={styles.questionTop} onClick={() => setExpanded(isExpanded ? null : rec.id)}>
                <div className={styles.questionMain}>
                  <span className={styles.questionText}>{f.Question}</span>
                  <div className={styles.questionMeta}>
                    <span className={`badge ${STATUS_COLORS[f.Status] || 'badge-gray'}`}>{f.Status}</span>
                    {f.Priority && <span className="badge badge-gray">{f.Priority}</span>}
                  </div>
                </div>
                <span className={styles.expandIcon}>{isExpanded ? '▲' : '▼'}</span>
              </div>

              {isExpanded && (
                <div className={styles.questionDetail}>
                  {f.Answer && (
                    <div className={styles.answerBox}>
                      <p className="text-xs text-faint" style={{ marginBottom: 4 }}>Answer</p>
                      <p className="text-sm" style={{ lineHeight: 1.6 }}>{f.Answer}</p>
                    </div>
                  )}
                  {f.Notes && (
                    <p className="text-sm text-muted" style={{ marginTop: 8 }}>{f.Notes}</p>
                  )}
                  <div className={styles.statusActions}>
                    <span className="text-xs text-faint">Move to:</span>
                    {STATUSES.filter(s => s !== f.Status).map(s => (
                      <button key={s} className={styles.statusBtn}
                        onClick={() => handleStatusChange(rec.id, s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
